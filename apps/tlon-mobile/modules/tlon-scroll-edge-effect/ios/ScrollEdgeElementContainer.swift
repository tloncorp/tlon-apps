import ExpoModulesCore
import UIKit

public final class TlonScrollEdgeEffectModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonScrollEdgeEffect")

        View(ConversationViewport.self) {
            Prop("anchorToEnd") { (view: ConversationViewport, enabled: Bool) in
                view.anchorToEnd = enabled
            }
        }

        View(ScrollEdgeElementContainer.self) {
            Prop("edge") { (view: ScrollEdgeElementContainer, edge: String?) in
                view.setEdge(edge)
            }

            Prop("scrollViewNativeID") { (view: ScrollEdgeElementContainer, nativeID: String?) in
                view.setScrollViewNativeID(nativeID)
            }
        }
    }
}

/// Keeps a docked conversation at its end in the same native layout pass that
/// resizes the scroll view. A JS onLayout -> scrollToEnd round trip trails the
/// keyboard's frames and makes messages catch up in visible steps.
///
/// It also owns following the end when content grows. LegendList first sizes a
/// new row from its estimate and corrects it once measured; each JS
/// scrollToEnd restarts UIKit's fixed-duration animation toward a stale end.
/// A spring retargeted every frame absorbs those corrections in one motion.
public final class ConversationViewport: ExpoView {
    var anchorToEnd = false {
        didSet {
            guard anchorToEnd, !oldValue, let scrollView else {
                if !anchorToEnd {
                    stopFollowing()
                }
                return
            }
            // A send or return-to-end resumed following; settle rows that
            // arrived while it was suspended.
            if endOffset(of: scrollView) - scrollView.contentOffset.y <= scrollView.bounds.height {
                followEnd()
            }
        }
    }
    private weak var scrollView: UIScrollView?
    private var frameObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var boundsBeforeResize: CGRect?
    private var displayLink: CADisplayLink?
    private var velocity: CGFloat = 0
    private var lastTimestamp: CFTimeInterval = 0

    override public func layoutSubviews() {
        super.layoutSubviews()
        if let scrollView, scrollView.isDescendant(of: self) {
            return
        }
        stopFollowing()
        frameObservation = nil
        contentSizeObservation = nil
        scrollView = findScrollView(in: self)
        frameObservation = scrollView?.observe(\.frame, options: [.prior]) { [weak self] scrollView, change in
            guard let self else {
                return
            }
            // Observe frame rather than bounds: UIKit resizes bounds internally
            // in setFrame. Capture the offset before that setter can clamp it.
            if change.isPrior {
                self.boundsBeforeResize = scrollView.bounds
                return
            }
            let newBounds = scrollView.bounds
            let oldBounds = self.boundsBeforeResize
            self.boundsBeforeResize = nil
            guard self.anchorToEnd,
                  !Self.isUserScrolling(scrollView),
                  let oldBounds,
                  oldBounds.height > 0,
                  newBounds.height > 0,
                  oldBounds.height != newBounds.height
            else {
                return
            }

            let insets = scrollView.adjustedContentInset
            let oldEnd = max(
                -insets.top,
                scrollView.contentSize.height + insets.bottom - oldBounds.height
            )
            // Use the pre-resize offset: UIKit may already have clamped it when
            // the viewport grows. History within the arrival-follow threshold
            // must stay put, so only follow from the actual end.
            guard abs(oldEnd - oldBounds.origin.y) <= 2 else {
                return
            }
            scrollView.setContentOffset(
                CGPoint(x: newBounds.origin.x, y: self.endOffset(of: scrollView)),
                animated: false
            )
        }
        contentSizeObservation = scrollView?.observe(\.contentSize, options: [.old, .new]) { [weak self] scrollView, change in
            guard let self,
                  self.anchorToEnd,
                  !Self.isUserScrolling(scrollView),
                  let oldSize = change.oldValue,
                  let newSize = change.newValue,
                  oldSize.height != newSize.height
            else {
                return
            }
            let insets = scrollView.adjustedContentInset
            let oldEnd = max(
                -insets.top,
                oldSize.height + insets.bottom - scrollView.bounds.height
            )
            // Keep following through consecutive corrections, but never pull
            // a reader who is away from the end.
            guard self.displayLink != nil || abs(oldEnd - scrollView.contentOffset.y) <= 2 else {
                return
            }
            self.followEnd()
        }
    }

    override public func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil {
            stopFollowing()
            frameObservation = nil
            contentSizeObservation = nil
            scrollView = nil
        } else {
            setNeedsLayout()
        }
    }

    private func endOffset(of scrollView: UIScrollView) -> CGFloat {
        let insets = scrollView.adjustedContentInset
        return max(
            -insets.top,
            scrollView.contentSize.height + insets.bottom - scrollView.bounds.height
        )
    }

    private static func isUserScrolling(_ scrollView: UIScrollView) -> Bool {
        scrollView.isTracking || scrollView.isDragging || scrollView.isDecelerating
    }

    private func followEnd() {
        guard let scrollView else {
            return
        }
        if UIAccessibility.isReduceMotionEnabled {
            stopFollowing()
            scrollView.setContentOffset(
                CGPoint(x: scrollView.contentOffset.x, y: endOffset(of: scrollView)),
                animated: false
            )
            return
        }
        guard displayLink == nil else {
            return
        }
        velocity = 0
        lastTimestamp = 0
        let link = CADisplayLink(target: DisplayLinkTarget(self), selector: #selector(DisplayLinkTarget.step(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopFollowing() {
        displayLink?.invalidate()
        displayLink = nil
    }

    fileprivate func step(_ link: CADisplayLink) {
        guard let scrollView, anchorToEnd, !Self.isUserScrolling(scrollView) else {
            stopFollowing()
            return
        }
        let dt = lastTimestamp == 0
            ? link.targetTimestamp - link.timestamp
            : min(link.timestamp - lastTimestamp, 1.0 / 30.0)
        lastTimestamp = link.timestamp
        // Critically damped spring toward the current end, read each frame so
        // row measurements and external offset changes retarget it smoothly.
        let target = endOffset(of: scrollView)
        let current = scrollView.contentOffset.y
        let omega: CGFloat = 22
        velocity += (-2 * omega * velocity - omega * omega * (current - target)) * dt
        var next = current + velocity * dt
        if abs(next - target) < 0.5 && abs(velocity) < 20 {
            next = target
            stopFollowing()
        }
        scrollView.contentOffset = CGPoint(x: scrollView.contentOffset.x, y: next)
    }

    private func findScrollView(in view: UIView) -> UIScrollView? {
        for child in view.subviews {
            if let scrollView = child as? UIScrollView {
                return scrollView
            }
            if let scrollView = findScrollView(in: child) {
                return scrollView
            }
        }
        return nil
    }
}

/// CADisplayLink retains its target; this breaks the cycle with the view.
private final class DisplayLinkTarget {
    private weak var owner: ConversationViewport?

    init(_ owner: ConversationViewport) {
        self.owner = owner
    }

    @objc func step(_ link: CADisplayLink) {
        guard let owner else {
            link.invalidate()
            return
        }
        owner.step(link)
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
