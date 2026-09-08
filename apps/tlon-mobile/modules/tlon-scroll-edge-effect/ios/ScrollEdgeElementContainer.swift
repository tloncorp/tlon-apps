import ExpoModulesCore
import QuartzCore
import UIKit

public final class TlonScrollEdgeEffectModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonScrollEdgeEffect")

        AsyncFunction("captureScrollGeometry") {
            (requestID: String, rootID: String, scrollID: String,
             rowIDs: [String], composerID: String) -> [String: Any] in
            ScrollGeometryCapture.capture(requestID: requestID, rootID: rootID,
                                          scrollID: scrollID, rowIDs: rowIDs,
                                          composerID: composerID)
        }.runOnQueue(.main)

        AsyncFunction("startScrollGeometryRecording") {
            (recordingID: String, rootID: String, scrollID: String,
             rowPrefix: String, composerID: String, durationMs: Double,
             maximumFrames: Int) -> [String: Any] in
            ScrollGeometryRecording.start(recordingID: recordingID, rootID: rootID,
                                          scrollID: scrollID, rowPrefix: rowPrefix,
                                          composerID: composerID, durationMs: durationMs,
                                          maximumFrames: maximumFrames)
        }.runOnQueue(.main)

        AsyncFunction("startScrollGeometryItineraryRecording") {
            (recordingID: String, itineraryJSON: String, rowPrefix: String,
             composerID: String, durationMs: Double, maximumFrames: Int) -> [String: Any] in
            ScrollGeometryRecording.startItinerary(recordingID: recordingID,
                itineraryJSON: itineraryJSON, rowPrefix: rowPrefix,
                composerID: composerID, durationMs: durationMs, maximumFrames: maximumFrames)
        }.runOnQueue(.main)

        AsyncFunction("markScrollGeometryRecording") {
            (recordingID: String, name: String) -> [String: Any] in
            ScrollGeometryRecording.mark(recordingID: recordingID, name: name)
        }.runOnQueue(.main)

        AsyncFunction("stopScrollGeometryRecording") {
            (recordingID: String) -> [String: Any] in
            ScrollGeometryRecording.stop(recordingID: recordingID)
        }.runOnQueue(.main)

        View(ScrollEdgeElementContainer.self) {
            Prop("edge") { (view: ScrollEdgeElementContainer, edge: String?) in
                view.setEdge(edge)
            }

            Prop("scrollViewNativeID") { (view: ScrollEdgeElementContainer, nativeID: String?) in
                view.setScrollViewNativeID(nativeID)
            }
        }

        View(ScrollReadScopeContainer.self) {
            Prop("descriptor") { (view: ScrollReadScopeContainer, descriptor: String?) in
                view.setDescriptor(descriptor)
            }
        }

        View(ScrollReadItemContainer.self) {
            Prop("descriptor") { (view: ScrollReadItemContainer, descriptor: String?) in
                view.setDescriptor(descriptor)
            }
        }
    }
}

public final class ScrollEdgeElementContainer: ExpoView {
    private static let maxAttachmentAttempts = 100
    // The custom-topic sheet starts its 250 ms close animation on the frame
    // after the keyboard finishes hiding, then keeps a 100 ms teardown grace.
    private static let keyboardDismissalAttachmentDelay: TimeInterval = 0.4

    private var scrollViewNativeID: String?
    // Held as AnyObject because UIScrollEdgeElementContainerInteraction is iOS
    // 26+ and this type is not. Unbox through `scrollEdgeInteraction` rather
    // than casting at each use site.
    private var edgeInteraction: AnyObject?
    private var pendingAttachment: DispatchWorkItem?
    private var pendingAttachmentValidation: DispatchWorkItem?
    private var pendingKeyboardDismissalAttachment: DispatchWorkItem?
    private var attachmentAttempts = 0
    private var didLogAttachmentFailure = false
    private var edge: UIRectEdge = .bottom

    @available(iOS 26.0, *)
    private var scrollEdgeInteraction: UIScrollEdgeElementContainerInteraction? {
        edgeInteraction as? UIScrollEdgeElementContainerInteraction
    }

    public required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = false

        if #available(iOS 26.0, *) {
            let interaction = UIScrollEdgeElementContainerInteraction()
            interaction.edge = edge
            edgeInteraction = interaction
            addInteraction(interaction)

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(keyboardDidHide),
                name: UIResponder.keyboardDidHideNotification,
                object: nil
            )
        }
    }

    deinit {
        cancelPendingAttachmentWork()
        NotificationCenter.default.removeObserver(self)

        if #available(iOS 26.0, *), let interaction = scrollEdgeInteraction {
            removeInteraction(interaction)
        }
    }

    override public func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil {
            cancelPendingAttachmentWork()
            return
        }

        resetAttachmentSearch()
        attachToScrollViewIfPossible()
    }

    override public func layoutSubviews() {
        super.layoutSubviews()
        attachToScrollViewIfPossible()
    }

    override public func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hitView = super.hitTest(point, with: event) else {
            return nil
        }

        // GlassContainer fills the composer row so its surfaces can merge, but
        // its empty area should not block gestures bound for the scroll view.
        // A hit inside a GlassView is real input chrome; reaching its parent
        // GlassContainer first means the hit is only on the decorative host.
        var ancestor: UIView? = hitView
        while let view = ancestor, view !== self {
            switch NSStringFromClass(type(of: view)) {
            case "ExpoGlassEffect.GlassView":
                return hitView
            case "ExpoGlassEffect.GlassContainer":
                return nil
            default:
                ancestor = view.superview
            }
        }

        return hitView
    }

    func setScrollViewNativeID(_ nativeID: String?) {
        guard scrollViewNativeID != nativeID else {
            return
        }

        scrollViewNativeID = nativeID
        resetAttachmentSearch()
        cancelPendingAttachmentWork()

        if #available(iOS 26.0, *), let interaction = scrollEdgeInteraction {
            interaction.scrollView = nil
        }

        attachToScrollViewIfPossible()
    }

    func setEdge(_ edge: String?) {
        self.edge = edge == "top" ? .top : .bottom

        if #available(iOS 26.0, *), let interaction = scrollEdgeInteraction {
            interaction.edge = self.edge
            if let scrollView = interaction.scrollView {
                configureEdgeEffect(on: scrollView)
            }
        }
    }

    private func configureEdgeEffect(on scrollView: UIScrollView) {
        guard #available(iOS 26.0, *) else {
            return
        }

        let edgeEffect = edge == .top
            ? scrollView.topEdgeEffect
            : scrollView.bottomEdgeEffect
        edgeEffect.isHidden = false
        edgeEffect.style = .soft
    }

    @objc private func keyboardDidHide() {
        guard edge == .bottom, window != nil else {
            return
        }

        if #available(iOS 26.0, *), let interaction = scrollEdgeInteraction {
            // KeyboardStickyView moves the composer with a transform. UIKit's
            // edge interaction can retain the keyboard-open container geometry
            // after that transform settles, leaving a tall soft fade over the
            // conversation. Keep every attachment path paused through the
            // sheet's close and teardown, then reattach once with the final
            // keyboard-closed geometry. Establish the pause even when the
            // interaction is already detached so a pending lookup cannot
            // attach it during dismissal.
            interaction.scrollView = nil
            cancelPendingAttachmentWork()
            resetAttachmentSearch()

            let workItem = DispatchWorkItem { [weak self] in
                guard let self else {
                    return
                }
                pendingKeyboardDismissalAttachment = nil
                attachToScrollViewIfPossible()
            }
            pendingKeyboardDismissalAttachment = workItem
            DispatchQueue.main.asyncAfter(
                deadline: .now() + Self.keyboardDismissalAttachmentDelay,
                execute: workItem
            )
        }
    }

    private func attachToScrollViewIfPossible() {
        guard pendingKeyboardDismissalAttachment == nil,
              window != nil,
              let scrollViewNativeID
        else {
            return
        }

        if #available(iOS 26.0, *), let interaction = scrollEdgeInteraction {
            if let attachedScrollView = interaction.scrollView,
               attachedScrollView.window != nil
            {
                configureEdgeEffect(on: attachedScrollView)
                scheduleAttachmentValidation()
                return
            }

            if let scrollView = ScrollEdgeViewFinder.findScrollView(
                nativeID: scrollViewNativeID,
                from: self
            ) {
                pendingAttachment?.cancel()
                pendingAttachment = nil
                resetAttachmentSearch()
                interaction.scrollView = scrollView
                configureEdgeEffect(on: scrollView)
                scheduleAttachmentValidation()

                // React Native Screens may apply its screen options after the
                // list mounts. Reassert the same style on the following run
                // loop so a late-mounted upright chat list gets this edge.
                DispatchQueue.main.async { [weak self, weak scrollView] in
                    guard let self, let scrollView else {
                        return
                    }
                    self.configureEdgeEffect(on: scrollView)
                }
                return
            }

            scheduleAttachmentRetry()
        }
    }

    private func scheduleAttachmentValidation() {
        guard pendingAttachmentValidation == nil else {
            return
        }

        // React Native Screens can replace the mounted scroll view without
        // notifying this sibling module. Polling at 4 Hz is intentionally
        // low-frequency: it repairs that attachment without doing per-frame work.
        let workItem = DispatchWorkItem { [weak self] in
            guard let self else {
                return
            }
            pendingAttachmentValidation = nil

            guard window != nil else {
                return
            }

            if #available(iOS 26.0, *),
               let interaction = scrollEdgeInteraction,
               let attachedScrollView = interaction.scrollView,
               attachedScrollView.window == nil
            {
                interaction.scrollView = nil
                self.resetAttachmentSearch()
            }

            attachToScrollViewIfPossible()
        }
        pendingAttachmentValidation = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: workItem)
    }

    private func scheduleAttachmentRetry() {
        guard pendingAttachment == nil else {
            return
        }

        guard attachmentAttempts < Self.maxAttachmentAttempts else {
            // Stop retrying, but say so once. Otherwise the effect simply never
            // appears with nothing in the log to explain why - the usual cause
            // is the list's testID being renamed or stripped, since the lookup
            // matches against accessibilityIdentifier.
            if !didLogAttachmentFailure {
                didLogAttachmentFailure = true
                log.warn(
                    "ScrollEdgeElementContainer: no scroll view with identifier "
                        + "'\(scrollViewNativeID ?? "")' found after "
                        + "\(Self.maxAttachmentAttempts) attempts; scroll edge "
                        + "effects are inactive for this element."
                )
            }
            return
        }

        attachmentAttempts += 1
        let workItem = DispatchWorkItem { [weak self] in
            self?.pendingAttachment = nil
            self?.attachToScrollViewIfPossible()
        }
        pendingAttachment = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: workItem)
    }

    private func cancelPendingAttachmentWork() {
        pendingAttachment?.cancel()
        pendingAttachment = nil
        pendingAttachmentValidation?.cancel()
        pendingAttachmentValidation = nil
        pendingKeyboardDismissalAttachment?.cancel()
        pendingKeyboardDismissalAttachment = nil
    }

    private func resetAttachmentSearch() {
        attachmentAttempts = 0
        didLogAttachmentFailure = false
    }
}

private enum ScrollEdgeViewFinder {
    // V1 deliberately binds by React Native's testID/accessibilityIdentifier
    // contract. Expo view props cannot carry a UIScrollView handle directly;
    // the low-frequency validation above repairs Screens replacing the view
    // without introducing a second native registry in this migration PR.
    static func findScrollView(nativeID: String, from view: UIView) -> UIScrollView? {
        var containingCellIdentity: String?
        var ancestor: UIView? = view

        while let candidateRoot = ancestor {
            if let taggedView = findTaggedView(in: candidateRoot, nativeID: nativeID),
               let scrollView = findDescendantScrollView(in: taggedView)
            {
                return scrollView
            }
            ancestor = candidateRoot.superview
        }

        return nil
    }

    private static func findTaggedView(in view: UIView, nativeID: String) -> UIView? {
        if view.accessibilityIdentifier == nativeID {
            return view
        }

        for child in view.subviews {
            if let match = findTaggedView(in: child, nativeID: nativeID) {
                return match
            }
        }

        return nil
    }

    private static func findDescendantScrollView(in view: UIView) -> UIScrollView? {
        if let scrollView = view as? UIScrollView {
            return scrollView
        }

        for child in view.subviews {
            if let scrollView = findDescendantScrollView(in: child) {
                return scrollView
            }
        }

        return nil
    }
}

/// Opt-in model geometry only. No layout forcing or scroll mutations.
enum ScrollGeometryCapture {
    static let maximumRows = 128
    static let maximumViews = 20_000

    static func capture(requestID: String, rootID: String, scrollID: String,
                        rowIDs: [String], composerID: String,
                        discoverRowPrefix: String? = nil,
                        itinerary: [[String: String]]? = nil) -> [String: Any] {
        let startedAt = CACurrentMediaTime() * 1000
        var result: [String: Any] = [
            "version": 1, "requestId": requestID, "rootId": rootID,
            "scrollViewId": scrollID, "rowIds": rowIDs, "composerId": composerID,
            "clock": "CACurrentMediaTime milliseconds",
            "coordinateSpace": "window-model-points", "startedAt": startedAt
        ]
        var issues: [String] = []
        func finish() -> [String: Any] {
            result["issues"] = issues
            result["status"] = issues.isEmpty ? "ok" : "unavailable"
            result["finishedAt"] = CACurrentMediaTime() * 1000
            return result
        }
        guard Thread.isMainThread else {
            issues.append("not-main-thread")
            return finish()
        }
        guard !requestID.isEmpty, !rootID.isEmpty, !scrollID.isEmpty,
              !composerID.isEmpty, rowIDs.count <= maximumRows,
              Set(rowIDs).count == rowIDs.count,
              rowIDs.allSatisfy({ !$0.isEmpty }),
              Set([rootID, scrollID, composerID] + rowIDs).count == rowIDs.count + 3
        else {
            issues.append("invalid-request")
            return finish()
        }
        // One bounded walk locates the root, then one walk inventories its views.
        // A duplicate hidden root is still ambiguous; do not pick whichever came first.
        var visited = 0
        func walk(_ roots: [UIView], visit: (UIView) -> Void) -> Bool {
            var pending = roots
            while let view = pending.popLast() {
                visited += 1
                if visited > maximumViews { return false }
                visit(view)
                pending.append(contentsOf: view.subviews)
            }
            return true
        }
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
        var roots: [UIView] = []
        guard walk(windows, visit: { view in
            if view.accessibilityIdentifier == rootID { roots.append(view) }
        }) else {
            issues.append("view-traversal-limit")
            return finish()
        }
        guard roots.count == 1, let root = roots.first, let window = root.window else {
            issues.append("missing-or-duplicate-root")
            return finish()
        }
        result["root"] = geometry(root, in: window, scrollView: nil)
        var ownerIndex: Int?
        if let itinerary {
            guard let value = root.accessibilityValue?.data(using: .utf8),
                  let metadata = (try? JSONSerialization.jsonObject(with: value)) as? [String: Any],
                  let scope = metadata["scope"] as? String,
                  let index = itinerary.firstIndex(where: { $0["scope"] == scope }) else {
                issues.append("unexpected-native-root-scope")
                return finish()
            }
            ownerIndex = index
        }
        var matches: [String: [UIView]] = [:]
        let wanted = Set([scrollID, composerID] + rowIDs)
        var discoveredRowIDs = Set<String>()
        var rulerIDs = Set<String>()
        var taggedScrollHosts: [UIView] = []
        guard walk([root], visit: { view in
            guard let id = view.accessibilityIdentifier else { return }
            let discovered = discoverRowPrefix.map { id.hasPrefix($0) } ?? false
            let discoveredScroll = itinerary != nil && id.hasPrefix("tlon-conversation-scroll-edge-content-")
            if discoveredScroll { taggedScrollHosts.append(view) }
            if discovered { discoveredRowIDs.insert(id) }
            let ruler = id.hasPrefix("scroll-cell-") || id.hasPrefix("scroll-surface-")
            if ruler { rulerIDs.insert(id) }
            if wanted.contains(id) || discovered || discoveredScroll || ruler {
                matches[id, default: []].append(view)
            }
        }) else {
            issues.append("view-traversal-limit")
            return finish()
        }
        let measuredRowIDs = Array(Set(rowIDs).union(discoveredRowIDs)).sorted()
        // Preserve original request order for the existing one-shot protocol.
        let resolvedRowIDs = discoverRowPrefix == nil ? rowIDs : measuredRowIDs
        result["rowIds"] = resolvedRowIDs
        guard resolvedRowIDs.count <= maximumRows else {
            issues.append("row-inventory-limit")
            return finish()
        }
        result["visitedViews"] = visited
        var resolvedScrollID = scrollID
        if let itinerary, let ownerIndex {
            result["ownerHosts"] = taggedScrollHosts.map { ["id": $0.accessibilityIdentifier ?? "", "identity": identity($0)] }
            guard taggedScrollHosts.count == 1,
                  let discoveredID = taggedScrollHosts[0].accessibilityIdentifier,
                  (ownerIndex == 0 ? discoveredID == scrollID : discoveredID != scrollID) else {
                issues.append("missing-duplicate-or-mixed-native-scroll-owner")
                return finish()
            }
            resolvedScrollID = discoveredID
            result["scrollViewId"] = discoveredID
            result["owner"] = ["index": ownerIndex, "scope": itinerary[ownerIndex]["scope"]!,
                               "rootId": rootID, "scrollViewId": discoveredID] as [String: Any]
        }
        guard let tagged = matches[resolvedScrollID], tagged.count == 1 else {
            issues.append("missing-or-duplicate-scroll-host")
            return finish()
        }
        // Stop at the outer scroll view. Nested code/media scroll views are rows' children.
        var scrollViews: [UIScrollView] = []
        var pending = tagged
        while let view = pending.popLast() {
            if let scrollView = view as? UIScrollView {
                scrollViews.append(scrollView)
            } else {
                pending.append(contentsOf: view.subviews)
            }
        }
        guard scrollViews.count == 1, let scrollView = scrollViews.first,
              scrollView.window === window else {
            issues.append("missing-or-duplicate-native-scroll-view")
            return finish()
        }
        result["scroll"] = [
            "view": geometry(scrollView, in: window, scrollView: scrollView),
            "hostIdentity": identity(tagged[0]),
            "offset": ["x": scrollView.contentOffset.x, "y": scrollView.contentOffset.y],
            "contentSize": ["width": scrollView.contentSize.width, "height": scrollView.contentSize.height],
            "bounds": rect(scrollView.bounds),
            "contentInset": inset(scrollView.contentInset),
            "adjustedContentInset": inset(scrollView.adjustedContentInset),
            "zoomScale": scrollView.zoomScale,
            "tracking": scrollView.isTracking, "dragging": scrollView.isDragging,
            "decelerating": scrollView.isDecelerating
        ]
        // Existing trace diagnostics only: this neither admits a READ lease
        // nor counts its state as a geometry/presentation verdict.
        let measuredRows = Dictionary(uniqueKeysWithValues: resolvedRowIDs.map { ($0, matches[$0] ?? []) })
        let measuredCells = Dictionary(uniqueKeysWithValues: rulerIDs.filter { $0.hasPrefix("scroll-cell-") }
            .map { ($0, matches[$0] ?? []) })
        result["nativeReading"] = TlonReadRegistration.readPointDiagnostic(
            for: scrollView, measuredRows: measuredRows, indexedCells: measuredCells)
        if let composers = matches[composerID], composers.count == 1 {
            result["composer"] = geometry(composers[0], in: window, scrollView: scrollView)
        } else {
            issues.append("missing-or-duplicate-composer")
        }
        if !rulerIDs.isEmpty {
            let cells = rulerIDs.filter { $0.hasPrefix("scroll-cell-") }.sorted()
            let surfaces = rulerIDs.filter { $0.hasPrefix("scroll-surface-") && $0 != "scroll-surface-manifest" }.sorted()
            guard cells.count <= maximumRows, surfaces.count <= 16 else {
                issues.append("ruler-inventory-limit")
                return finish()
            }
            func item(_ id: String) -> [String: Any] {
                let views = matches[id] ?? []
                var value: [String: Any] = ["id": id, "matches": views.count]
                if views.count == 1 { value["view"] = geometry(views[0], in: window, scrollView: scrollView) }
                return value
            }
            result["ruler"] = ["version": 1, "cells": cells.map(item),
                               "manifest": item("scroll-surface-manifest"), "surfaces": surfaces.map(item)]
        }
        result["rows"] = resolvedRowIDs.map { id -> [String: Any] in
            let views = matches[id] ?? []
            var row: [String: Any] = ["id": id, "matches": views.count]
            if views.count == 1 {
                row["view"] = geometry(views[0], in: window, scrollView: scrollView)
            } else if views.count > 1 {
                issues.append("duplicate-row")
            }
            return row
        }
        return finish()
    }

    private static func identity(_ view: UIView) -> String {
        String(describing: ObjectIdentifier(view))
    }
    private static func rect(_ frame: CGRect) -> [String: CGFloat] {
        ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
    }
    private static func inset(_ value: UIEdgeInsets) -> [String: CGFloat] {
        ["top": value.top, "right": value.right, "bottom": value.bottom, "left": value.left]
    }
    private static func geometry(_ view: UIView, in window: UIWindow,
                                 scrollView: UIScrollView?) -> [String: Any] {
        let frame = view.convert(view.bounds, to: window)
        var clipped = frame.intersection(window.bounds)
        var alpha: CGFloat = 1
        var hidden = false
        var translationOnly = true
        var containingCellIdentity: String?
        var ancestor: UIView? = view
        while let current = ancestor {
            if containingCellIdentity == nil,
               current.accessibilityIdentifier?.hasPrefix("scroll-cell-") == true {
                containingCellIdentity = identity(current)
            }
            alpha *= current.alpha
            hidden = hidden || current.isHidden
            let t = current.transform
            translationOnly = translationOnly && abs(t.a - 1) < 0.000001
                && abs(t.d - 1) < 0.000001 && abs(t.b) < 0.000001 && abs(t.c) < 0.000001
            if current !== view && current.clipsToBounds {
                clipped = clipped.intersection(current.convert(current.bounds, to: window))
            }
            ancestor = current.superview
        }
        var result: [String: Any] = [
            "identity": identity(view), "windowIdentity": identity(window),
            "lifetimeIdentity": TlonReadRegistration.readPointIdentity(for: view),
            "frame": rect(frame), "clipFrame": rect(clipped.isNull ? .zero : clipped),
            "attached": view.window === window, "effectiveAlpha": alpha,
            "hidden": hidden, "translationOnly": translationOnly,
            "descendantOfScroll": scrollView.map { view === $0 || view.isDescendant(of: $0) } ?? false
        ]
        if let value = view.accessibilityValue { result["semanticValue"] = value }
        if let cell = containingCellIdentity { result["containingCellIdentity"] = cell }
        return result
    }
}

/// One explicitly requested, bounded fixture recording. Dormant in ordinary chats.
private final class ScrollGeometryRecording: NSObject {
    private static var retained: ScrollGeometryRecording?
    private let recordingID: String
    private let rootID: String
    private let scrollID: String
    private let rowPrefix: String
    private let composerID: String
    private let durationMs: Double
    private let maximumFrames: Int
    private let itinerary: [[String: String]]?
    private var lastOwnerIndex = -1
    private var ownerIdentities: [Int: [String]] = [:]
    private var physicalRootIdentity: String?
    private let startedAt = CACurrentMediaTime() * 1000
    private var stoppedAt: Double?
    private var stopReason: String?
    private var frames: [[String: Any]] = []
    private var markers: [[String: Any]] = []
    private var displayLink: CADisplayLink?
    private var deadline: DispatchWorkItem?

    private init(recordingID: String, rootID: String, scrollID: String,
                 rowPrefix: String, composerID: String, durationMs: Double,
                 maximumFrames: Int, itinerary: [[String: String]]? = nil) {
        self.recordingID = recordingID
        self.rootID = rootID
        self.scrollID = scrollID
        self.rowPrefix = rowPrefix
        self.composerID = composerID
        self.durationMs = durationMs
        self.maximumFrames = maximumFrames
        self.itinerary = itinerary
        super.init()
    }

    static func start(recordingID: String, rootID: String, scrollID: String,
                      rowPrefix: String, composerID: String, durationMs: Double,
                      maximumFrames: Int, itinerary: [[String: String]]? = nil) -> [String: Any] {
        guard retained == nil else {
            return ["status": "unavailable", "issues": ["recording-not-consumed"]]
        }
        guard !recordingID.isEmpty, !rootID.isEmpty, !scrollID.isEmpty,
              !composerID.isEmpty, rowPrefix == "scroll-row-",
              durationMs.isFinite, durationMs >= 100, durationMs <= 15_000,
              maximumFrames >= 3, maximumFrames <= 900,
              Set([rootID, scrollID, composerID]).count == 3 else {
            return ["status": "unavailable", "issues": ["invalid-recording-request"]]
        }
        let recording = ScrollGeometryRecording(recordingID: recordingID,
            rootID: rootID, scrollID: scrollID, rowPrefix: rowPrefix,
            composerID: composerID, durationMs: durationMs,
            maximumFrames: maximumFrames, itinerary: itinerary)
        retained = recording
        recording.sample(link: nil)
        let link = CADisplayLink(target: recording, selector: #selector(tick(_:)))
        link.preferredFramesPerSecond = 60
        recording.displayLink = link
        link.add(to: .main, forMode: .common)
        let deadline = DispatchWorkItem { [weak recording] in
            recording?.finish(reason: "deadline")
        }
        recording.deadline = deadline
        DispatchQueue.main.asyncAfter(deadline: .now() + durationMs / 1000,
                                      execute: deadline)
        return ["status": "ok", "recordingId": recordingID,
                "startedAt": recording.startedAt,
                "clock": "CACurrentMediaTime milliseconds"]
    }

    static func startItinerary(recordingID: String, itineraryJSON: String,
                               rowPrefix: String, composerID: String,
                               durationMs: Double, maximumFrames: Int) -> [String: Any] {
        guard itineraryJSON.utf8.count <= 16_384,
              let data = itineraryJSON.data(using: .utf8),
              let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              value["version"] as? Int == 1,
              let owners = value["owners"] as? [[String: String]], owners.count == 2,
              owners.allSatisfy({ $0.count == 3 && !($0["rootId"] ?? "").isEmpty && !($0["scope"] ?? "").isEmpty }),
              let rootID = owners[0]["rootId"], owners[1]["rootId"] == rootID,
              owners[0]["scope"] != owners[1]["scope"],
              let scrollID = owners[0]["scrollViewId"], !scrollID.isEmpty,
              owners[1]["scrollViewPrefix"] == "tlon-conversation-scroll-edge-content-" else {
            return ["status": "unavailable", "issues": ["invalid-native-owner-itinerary"]]
        }
        return start(recordingID: recordingID, rootID: rootID, scrollID: scrollID,
                     rowPrefix: rowPrefix, composerID: composerID, durationMs: durationMs,
                     maximumFrames: maximumFrames, itinerary: owners)
    }

    static func mark(recordingID: String, name: String) -> [String: Any] {
        guard let recording = retained, recording.recordingID == recordingID,
              recording.stoppedAt == nil, !name.isEmpty, name.count <= 128,
              recording.markers.count < 128 else {
            return ["status": "unavailable", "issues": ["invalid-recording-marker"]]
        }
        let marker: [String: Any] = ["sequence": recording.markers.count,
                                    "name": name, "time": CACurrentMediaTime() * 1000]
        recording.markers.append(marker)
        return ["status": "ok", "recordingId": recordingID, "marker": marker]
    }

    static func stop(recordingID: String) -> [String: Any] {
        guard let recording = retained, recording.recordingID == recordingID else {
            return ["status": "unavailable", "issues": ["recording-owner-mismatch"]]
        }
        recording.finish(reason: "requested")
        let result = recording.result()
        retained = nil
        return result
    }

    @objc private func tick(_ link: CADisplayLink) { sample(link: link) }

    private func sample(link: CADisplayLink?) {
        guard stoppedAt == nil else { return }
        if frames.count >= maximumFrames {
            finish(reason: "capacity")
            return
        }
        let sequence = frames.count
        var geometry = ScrollGeometryCapture.capture(
            requestID: "\(recordingID):\(sequence)", rootID: rootID,
            scrollID: scrollID, rowIDs: [], composerID: composerID,
            discoverRowPrefix: rowPrefix, itinerary: itinerary)
        var frame: [String: Any] = ["sequence": sequence,
                                   "trigger": link == nil ? "start" : "display-link"]
        if let itinerary, let owner = geometry["owner"] as? [String: Any],
           let index = owner["index"] as? Int,
           let root = geometry["root"] as? [String: Any], let rootIdentity = root["identity"] as? String,
           let scroll = geometry["scroll"] as? [String: Any], let view = scroll["view"] as? [String: Any],
           let hostIdentity = scroll["hostIdentity"] as? String,
           let scrollIdentity = view["identity"] as? String, let tag = owner["scrollViewId"] as? String {
            frame["owner"] = owner
            var issues = geometry["issues"] as? [String] ?? []
            if (lastOwnerIndex < 0 && index != 0) || index < lastOwnerIndex { issues.append("native-owner-itinerary-order") }
            lastOwnerIndex = max(lastOwnerIndex, index)
            if let physicalRootIdentity, physicalRootIdentity != rootIdentity { issues.append("native-itinerary-root-replaced") }
            physicalRootIdentity = physicalRootIdentity ?? rootIdentity
            let identity = [rootIdentity, scrollIdentity, hostIdentity, tag]
            if let previous = ownerIdentities[index], previous != identity { issues.append("same-scope-native-owner-replaced") }
            ownerIdentities[index] = ownerIdentities[index] ?? identity
            // Metadata is read from each actual row in this same main-thread operation.
            for row in geometry["rows"] as? [[String: Any]] ?? [] {
                guard let rowView = row["view"] as? [String: Any],
                      let encoded = rowView["semanticValue"] as? String,
                      let data = encoded.data(using: .utf8),
                      let revision = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                      revision["scope"] as? String == itinerary[index]["scope"] else {
                    issues.append("mixed-native-owner-row-scope")
                    continue
                }
            }
            geometry["issues"] = issues
            geometry["status"] = issues.isEmpty ? "ok" : "unavailable"
        }
        frame["geometry"] = geometry
        if let link {
            frame["displayLinkTimestamp"] = link.timestamp * 1000
            frame["displayLinkTargetTimestamp"] = link.targetTimestamp * 1000
        }
        frames.append(frame)
    }

    private func finish(reason: String) {
        guard stoppedAt == nil else { return }
        stoppedAt = CACurrentMediaTime() * 1000
        stopReason = reason
        displayLink?.invalidate()
        displayLink = nil
        deadline?.cancel()
        deadline = nil
    }

    private func result() -> [String: Any] {
        var result: [String: Any] = ["version": 1, "recordingId": recordingID,
         "clock": "CACurrentMediaTime milliseconds",
         "coordinateSpace": "window-model-points",
         "request": ["rootId": rootID, "scrollViewId": scrollID,
                     "composerId": composerID, "rowPrefix": rowPrefix,
                     "durationMs": durationMs, "maximumFrames": maximumFrames],
         "startedAt": startedAt, "stoppedAt": stoppedAt ?? startedAt,
         "stopReason": stopReason ?? "unavailable", "frames": frames,
         "markers": markers, "nativePresentation": "INCOMPLETE"]
        if let itinerary { result["itinerary"] = ["version": 1, "owners": itinerary] }
        return result
    }
}
