import UIKit

struct MenuLayout: Equatable {
    let previewFrame: CGRect
    let actionFrame: CGRect
    let reactionFrame: CGRect?
}

// Presents the native message preview, reaction bar, and action list.
final class TlonMessageMenuPresentationView: UIView, UIGestureRecognizerDelegate {
    private enum Animation {
        static let presentationDuration: TimeInterval = 0.48
        static let presentationDamping: CGFloat = 0.82
        static let presentationVelocity: CGFloat = 0.25
        static let scaleBounce: Double = 0.025
        static let scaleBounceDuration: TimeInterval = 0.36
        static let scaleBouncePeak: Double = 0.52
        static let scaleBounceDelay: TimeInterval = 0.05
    }

    private static let backdropColor = UIColor.black.withAlphaComponent(0.32)
    private static let scaleBounceValues: [NSNumber] = {
        let sampleCount = max(
            30,
            Int(ceil(Animation.scaleBounceDuration * 120))
        )
        return (0 ... sampleCount).map { index in
            let time = Double(index) / Double(sampleCount)
            let normalizedProgress: Double
            let scaleProgress: Double

            if time <= Animation.scaleBouncePeak {
                normalizedProgress = time / Animation.scaleBouncePeak
                scaleProgress = smootherStep(normalizedProgress)
            } else {
                normalizedProgress = (time - Animation.scaleBouncePeak)
                    / (1 - Animation.scaleBouncePeak)
                scaleProgress = 1 - smootherStep(normalizedProgress)
            }

            return NSNumber(
                value: 1 + Animation.scaleBounce * scaleProgress
            )
        }
    }()

    private weak var sourceView: UIView?
    private let sourceSnapshot: UIView
    private let restingSourceFrame: CGRect?
    private let previewContainer = UIView()
    private let dimView = UIView()
    private let actionList: TlonMessageActionListView
    private let actionMotionView = UIView()
    private let actionRevealView = UIView()
    private let reactionBar: TlonMessageReactionBarView?
    private let alignment: TlonMessageMenuAlignment
    private let previewBackgroundColor: UIColor
    private let completion: (TlonMessageMenuSelection?) -> Void
    private let accessoryGap: CGFloat = 8

    private var sourceFrame = CGRect.zero
    private var targetPreviewFrame = CGRect.zero
    private var targetActionFrame = CGRect.zero
    private var targetReactionFrame = CGRect.zero
    private var isPresenting = false
    private var isDismissing = false
    private var appDidEnterBackgroundObserver: NSObjectProtocol?

    init(
        sourceView: UIView,
        restingSourceFrame: CGRect?,
        actions: [TlonMessageMenuAction],
        reactions: [String],
        selectedReaction: String?,
        alignment: TlonMessageMenuAlignment,
        previewBackgroundColor: UIColor,
        completion: @escaping (TlonMessageMenuSelection?) -> Void
    ) {
        self.sourceView = sourceView
        sourceSnapshot = sourceView.snapshotView(afterScreenUpdates: false) ?? UIView()
        self.restingSourceFrame = restingSourceFrame
        actionList = TlonMessageActionListView(actions: actions)
        reactionBar = reactions.isEmpty
            ? nil
            : TlonMessageReactionBarView(
                reactions: reactions,
                selectedReaction: selectedReaction
            )
        self.alignment = alignment
        self.previewBackgroundColor = previewBackgroundColor
        self.completion = completion

        super.init(frame: .zero)

        actionList.onSelection = { [weak self] id in
            self?.dismiss(with: .action(id))
        }
        reactionBar?.onReaction = { [weak self] value in
            self?.dismiss(with: .reaction(value))
        }
        reactionBar?.onMoreReactions = { [weak self] in
            self?.dismiss(with: .moreReactions)
        }

        configureView()
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        if let appDidEnterBackgroundObserver {
            NotificationCenter.default.removeObserver(appDidEnterBackgroundObserver)
        }
    }

    func present(in window: UIWindow) {
        frame = window.bounds
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        sourceFrame = sourceView?.convert(sourceView?.bounds ?? .zero, to: window) ?? .zero

        window.addSubview(self)
        setNeedsLayout()
        layoutIfNeeded()
        isPresenting = true

        previewContainer.frame = sourceFrame
        sourceSnapshot.frame = previewContainer.bounds
        sourceView?.isHidden = true

        actionMotionView.frame = actionFrame(attachedTo: sourceFrame)
        actionRevealView.frame = CGRect(
            x: 0,
            y: 0,
            width: targetActionFrame.width,
            height: 0
        )
        actionList.frame = CGRect(origin: .zero, size: targetActionFrame.size)
        reactionBar?.frame = reactionFrame(attachedTo: sourceFrame)
        reactionBar?.alpha = 0

        // Commit the source-frame snapshot before assigning animated target
        // values. Otherwise a newly-added view can draw first at its target
        // frame, making the entrance appear to snap while dismissal animates.
        DispatchQueue.main.async { [weak self] in
            guard let self, superview != nil, !self.isDismissing else {
                return
            }
            animatePresentation()
        }
    }

    private func animatePresentation() {
        UIView.animate(
            withDuration: Animation.presentationDuration,
            delay: 0,
            usingSpringWithDamping: Animation.presentationDamping,
            initialSpringVelocity: Animation.presentationVelocity,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            self.previewContainer.frame = self.targetPreviewFrame
            let previewScale = self.sourceFrame.width > 0
                ? self.targetPreviewFrame.width / self.sourceFrame.width
                : 1
            self.sourceSnapshot.frame = CGRect(
                origin: .zero,
                size: CGSize(
                    width: self.targetPreviewFrame.width,
                    height: self.sourceFrame.height * previewScale
                )
            )
            self.previewContainer.backgroundColor = self.previewBackgroundColor
            self.actionMotionView.frame = self.targetActionFrame
            self.actionRevealView.frame = CGRect(
                origin: .zero,
                size: self.targetActionFrame.size
            )
            self.reactionBar?.frame = self.targetReactionFrame
        } completion: { _ in
            self.isPresenting = false
            guard !self.isDismissing else {
                return
            }
            self.applyTargetLayout()
        }

        animateScaleBounce()

        UIView.animate(
            withDuration: 0.22,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseInOut]
        ) {
            self.dimView.backgroundColor = Self.backdropColor
        }

        UIView.animate(
            withDuration: 0.16,
            delay: 0.10,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
        ) {
            self.reactionBar?.alpha = 1
        } completion: { _ in
            UIAccessibility.post(
                notification: .screenChanged,
                argument: self.reactionBar ?? self.actionList
            )
        }
    }

    private func animateScaleBounce() {
        let animation = CAKeyframeAnimation(keyPath: "transform.scale")
        animation.values = Self.scaleBounceValues
        animation.calculationMode = .linear
        animation.duration = Animation.scaleBounceDuration
        animation.beginTime = CACurrentMediaTime()
            + Animation.scaleBounceDelay
        let layers = [
            reactionBar?.layer,
            previewContainer.layer,
            actionMotionView.layer,
        ].compactMap { $0 }
        for layer in layers {
            layer.add(animation, forKey: "tlonScaleBounce")
        }
    }

    private static func smootherStep(_ value: Double) -> Double {
        let progress = min(max(value, 0), 1)
        return progress * progress * progress
            * (progress * (progress * 6 - 15) + 10)
    }

    func updateGesture(at windowPoint: CGPoint, isSelecting: Bool) {
        guard isSelecting else {
            actionList.updateHighlight(at: nil)
            reactionBar?.updateHighlight(at: nil)
            return
        }

        actionList.updateHighlight(at: presentationPoint(windowPoint, in: actionList))
        if let reactionBar {
            reactionBar.updateHighlight(
                at: presentationPoint(windowPoint, in: reactionBar)
            )
        }
    }

    func finishGesture(at windowPoint: CGPoint, shouldSelect: Bool) {
        guard shouldSelect else {
            actionList.updateHighlight(at: nil)
            reactionBar?.updateHighlight(at: nil)
            return
        }

        if let reactionBar {
            let point = presentationPoint(windowPoint, in: reactionBar)
            if let selection = reactionBar.selection(at: point) {
                dismiss(with: selection)
                return
            }
        }

        let actionPoint = presentationPoint(windowPoint, in: actionList)
        if let actionId = actionList.selection(at: actionPoint) {
            dismiss(with: .action(actionId))
            return
        }

        dismiss()
    }

    private func presentationPoint(_ windowPoint: CGPoint, in view: UIView) -> CGPoint {
        guard let window,
              let windowLayer = window.layer.presentation(),
              let viewLayer = view.layer.presentation()
        else {
            return view.convert(windowPoint, from: window)
        }

        return viewLayer.convert(windowPoint, from: windowLayer)
    }

    func dismiss() {
        dismiss(with: nil)
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        dimView.frame = bounds

        let safeInsets = window?.safeAreaInsets ?? safeAreaInsets
        let layout = Self.resolveLayout(
            bounds: bounds,
            safeInsets: safeInsets,
            sourceFrame: sourceFrame,
            actionContentHeight: actionList.contentHeight,
            actionWidth: actionList.menuWidth,
            reactionSize: reactionBar.map {
                CGSize(width: $0.barWidth, height: $0.barHeight)
            },
            alignment: alignment,
            accessoryGap: accessoryGap
        )

        targetPreviewFrame = layout.previewFrame
        targetActionFrame = layout.actionFrame
        targetReactionFrame = layout.reactionFrame ?? .zero

        if !isPresenting, !isDismissing {
            applyTargetLayout()
        }
    }

    static func resolveLayout(
        bounds: CGRect,
        safeInsets: UIEdgeInsets,
        sourceFrame: CGRect,
        actionContentHeight: CGFloat,
        actionWidth: CGFloat,
        reactionSize: CGSize?,
        alignment: TlonMessageMenuAlignment,
        accessoryGap: CGFloat
    ) -> MenuLayout {
        let horizontalMargin: CGFloat = 16
        let verticalMargin: CGFloat = 12
        let safeFrame = bounds.inset(by: UIEdgeInsets(
            top: safeInsets.top + verticalMargin,
            left: safeInsets.left + horizontalMargin,
            bottom: safeInsets.bottom + verticalMargin,
            right: safeInsets.right + horizontalMargin
        ))

        let previewWidth = min(sourceFrame.width, safeFrame.width)
        let previewScale = sourceFrame.width > 0
            ? previewWidth / sourceFrame.width
            : 1
        let scaledSourceHeight = sourceFrame.height * previewScale
        let reactionHeight = reactionSize?.height ?? 0
        let reactionGap = reactionSize == nil ? 0 : accessoryGap
        let minimumPreviewHeight = min(scaledSourceHeight, 72)
        let maximumActionHeight = max(
            50,
            safeFrame.height
                - reactionHeight
                - reactionGap
                - minimumPreviewHeight
                - accessoryGap
        )
        let actionHeight = min(actionContentHeight, maximumActionHeight)
        let maximumPreviewHeight = max(
            minimumPreviewHeight,
            safeFrame.height
                - reactionHeight
                - reactionGap
                - actionHeight
                - accessoryGap
        )
        let previewHeight = min(scaledSourceHeight, maximumPreviewHeight)
        // Preserve the message's original position whenever the accessories fit
        // around it. When they do not, move it only as far as the safe area
        // requires.
        let minimumPreviewY = safeFrame.minY + reactionHeight + reactionGap
        let maximumPreviewY = safeFrame.maxY
            - actionHeight
            - accessoryGap
            - previewHeight
        let previewY: CGFloat
        if minimumPreviewY <= maximumPreviewY {
            previewY = min(
                max(sourceFrame.minY, minimumPreviewY),
                maximumPreviewY
            )
        } else {
            previewY = minimumPreviewY
        }
        let reactionY = previewY - reactionHeight - reactionGap
        let actionY = previewY + previewHeight + accessoryGap
        let previewX = min(
            max(sourceFrame.minX, safeFrame.minX),
            safeFrame.maxX - previewWidth
        )

        let previewFrame = CGRect(
            x: previewX,
            y: previewY,
            width: previewWidth,
            height: previewHeight
        )

        func alignedAccessoryX(width: CGFloat) -> CGFloat {
            let desiredX: CGFloat
            switch alignment {
            case .leading:
                desiredX = previewFrame.minX
            case .trailing:
                desiredX = previewFrame.maxX - width
            }

            return min(
                max(desiredX, safeFrame.minX),
                safeFrame.maxX - width
            )
        }

        let actionFrame = CGRect(
            x: alignedAccessoryX(width: actionWidth),
            y: actionY,
            width: actionWidth,
            height: actionHeight
        )

        let reactionFrame = reactionSize.map {
            CGRect(
                x: alignedAccessoryX(width: $0.width),
                y: reactionY,
                width: $0.width,
                height: $0.height
            )
        }

        return MenuLayout(
            previewFrame: previewFrame,
            actionFrame: actionFrame,
            reactionFrame: reactionFrame
        )
    }

    private func applyTargetLayout() {
        previewContainer.frame = targetPreviewFrame
        actionMotionView.frame = targetActionFrame
        actionRevealView.frame = actionMotionView.bounds
        actionList.frame = actionMotionView.bounds
        reactionBar?.frame = targetReactionFrame
    }

    private func actionFrame(attachedTo previewFrame: CGRect) -> CGRect {
        CGRect(
            x: targetActionFrame.minX,
            y: previewFrame.maxY + accessoryGap,
            width: targetActionFrame.width,
            height: targetActionFrame.height
        )
    }

    private func reactionFrame(attachedTo previewFrame: CGRect) -> CGRect {
        CGRect(
            x: targetReactionFrame.minX,
            y: previewFrame.minY - targetReactionFrame.height - accessoryGap,
            width: targetReactionFrame.width,
            height: targetReactionFrame.height
        )
    }

    private func configureView() {
        accessibilityViewIsModal = true
        backgroundColor = .clear

        dimView.backgroundColor = .clear
        addSubview(dimView)

        previewContainer.backgroundColor = .clear
        previewContainer.clipsToBounds = true
        previewContainer.layer.cornerRadius = 16
        previewContainer.layer.cornerCurve = .continuous
        previewContainer.addSubview(sourceSnapshot)
        actionRevealView.clipsToBounds = true
        actionMotionView.addSubview(actionRevealView)
        actionRevealView.addSubview(actionList)
        addSubview(previewContainer)
        addSubview(actionMotionView)
        if let reactionBar {
            addSubview(reactionBar)
        }

        let dismissGesture = UITapGestureRecognizer(
            target: self,
            action: #selector(backgroundTapped(_:))
        )
        dismissGesture.delegate = self
        addGestureRecognizer(dismissGesture)

        appDidEnterBackgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.dismiss()
        }
    }

    private func dismiss(with selection: TlonMessageMenuSelection?) {
        guard !isDismissing else {
            return
        }
        isDismissing = true
        actionList.updateHighlight(at: nil)
        reactionBar?.updateHighlight(at: nil)
        previewContainer.layer.removeAnimation(forKey: "tlonScaleBounce")
        actionMotionView.layer.removeAnimation(forKey: "tlonScaleBounce")
        reactionBar?.layer.removeAnimation(forKey: "tlonScaleBounce")

        // Return to the resting frame captured before the pressed-scale
        // transform. Re-resolving the React Native view after a layout pass can
        // produce a slightly different frame and cause a dismissal stutter.
        let destinationFrame = restingSourceFrame ?? sourceFrame

        UIView.animate(
            withDuration: 0.18,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseIn]
        ) {
            self.dimView.backgroundColor = .clear
            self.actionRevealView.frame.size.height = 0
            self.actionRevealView.alpha = 0
        }

        UIView.animate(
            withDuration: 0.14,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseIn]
        ) {
            self.previewContainer.backgroundColor = .clear
            self.reactionBar?.alpha = 0
        }

        UIView.animate(
            withDuration: 0.32,
            delay: 0,
            usingSpringWithDamping: 0.90,
            initialSpringVelocity: 0.30,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            self.previewContainer.frame = destinationFrame
            self.sourceSnapshot.frame = CGRect(
                origin: .zero,
                size: destinationFrame.size
            )
            self.actionMotionView.frame = self.actionFrame(attachedTo: destinationFrame)
            self.reactionBar?.frame = self.reactionFrame(attachedTo: destinationFrame)
        } completion: { _ in
            self.sourceView?.isHidden = false
            self.removeFromSuperview()
            self.completion(selection)
        }
    }

    @objc
    private func backgroundTapped(_: UITapGestureRecognizer) {
        dismiss()
    }

    func gestureRecognizer(
        _: UIGestureRecognizer,
        shouldReceive touch: UITouch
    ) -> Bool {
        guard let touchedView = touch.view else {
            return true
        }
        let touchedAction = touchedView.isDescendant(of: actionList)
        let touchedReaction = reactionBar.map {
            touchedView.isDescendant(of: $0)
        } ?? false
        return !touchedAction && !touchedReaction
    }
}
