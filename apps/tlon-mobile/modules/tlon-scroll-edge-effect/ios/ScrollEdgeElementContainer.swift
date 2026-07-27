import ExpoModulesCore
import UIKit

public final class ScrollEdgeElementContainer: ExpoView {
    private var scrollViewNativeID: String?
    private var edgeInteraction: AnyObject?
    private var pendingAttachment: DispatchWorkItem?
    private var attachmentAttempts = 0
    private var edge: UIRectEdge = .bottom

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
        pendingAttachment?.cancel()

        if #available(iOS 26.0, *),
           let interaction = edgeInteraction as? UIScrollEdgeElementContainerInteraction
        {
            removeInteraction(interaction)
        }
    }

    override public func didMoveToWindow() {
        super.didMoveToWindow()
        attachmentAttempts = 0
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
        attachmentAttempts = 0
        pendingAttachment?.cancel()

        if #available(iOS 26.0, *),
           let interaction = edgeInteraction as? UIScrollEdgeElementContainerInteraction
        {
            interaction.scrollView = nil
        }

        attachToScrollViewIfPossible()
    }

    func setEdge(_ edge: String?) {
        self.edge = edge == "top" ? .top : .bottom

        if #available(iOS 26.0, *),
           let interaction = edgeInteraction as? UIScrollEdgeElementContainerInteraction
        {
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

        if #available(iOS 26.0, *),
           let interaction = edgeInteraction as? UIScrollEdgeElementContainerInteraction
        {
            if let attachedScrollView = interaction.scrollView,
               attachedScrollView.window != nil
            {
                configureEdgeEffect(on: attachedScrollView)
                return
            }

            if let scrollView = ScrollEdgeViewFinder.findScrollView(
                nativeID: scrollViewNativeID,
                from: self
            ) {
                pendingAttachment?.cancel()
                pendingAttachment = nil
                attachmentAttempts = 0
                interaction.scrollView = scrollView
                configureEdgeEffect(on: scrollView)

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

    private func scheduleAttachmentRetry() {
        guard attachmentAttempts < 100, pendingAttachment == nil else {
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
}

private enum ScrollEdgeViewFinder {
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
