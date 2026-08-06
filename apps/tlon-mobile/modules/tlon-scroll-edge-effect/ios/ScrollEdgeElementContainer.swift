import ExpoModulesCore
import UIKit

public final class TlonScrollEdgeEffectModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonScrollEdgeEffect")

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

public final class ScrollEdgeElementContainer: ExpoView {
    private static let maxAttachmentAttempts = 100

    private var scrollViewNativeID: String?
    // Held as AnyObject because UIScrollEdgeElementContainerInteraction is iOS
    // 26+ and this type is not. Unbox through `scrollEdgeInteraction` rather
    // than casting at each use site.
    private var edgeInteraction: AnyObject?
    private var pendingAttachment: DispatchWorkItem?
    private var pendingAttachmentValidation: DispatchWorkItem?
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
        }
    }

    deinit {
        cancelPendingAttachmentWork()

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

    private func attachToScrollViewIfPossible() {
        guard window != nil, let scrollViewNativeID else {
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
