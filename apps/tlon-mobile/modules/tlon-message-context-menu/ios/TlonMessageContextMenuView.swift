import ExpoModulesCore
import UIKit

// Coordinates long-press tracking with the native message-menu presentation.
final class TlonMessageContextMenuView: ExpoView, UIGestureRecognizerDelegate {
    private enum Animation {
        static let pressIndicationDelay: TimeInterval = 0.25
        static let menuDelay: TimeInterval = 0.47
        static let pressDuration: TimeInterval = 0.22
        static let pressScale: CGFloat = 0.985
        static let pressAlpha: CGFloat = 0.92
        static let pressRestoreDuration: TimeInterval = 0.18
    }

    let onAction = EventDispatcher()
    let onReaction = EventDispatcher()
    let onMoreReactions = EventDispatcher()

    var actions: [TlonMessageMenuAction] = []
    var reactions: [String] = []
    var selectedReaction: String?
    var alignment: TlonMessageMenuAlignment = .leading
    var previewBackgroundColor: UIColor = .secondarySystemBackground

    private weak var presentationView: TlonMessageMenuPresentationView?
    private var initialGestureLocation: CGPoint?
    private var gestureExitedDeadZone = false
    private var indicationBaseTransform: CGAffineTransform?
    private var indicationBaseAlpha: CGFloat?
    private var indicationRestingFrameInWindow: CGRect?
    private let gestureDeadZoneRadius: CGFloat = 40

    private lazy var pressIndicationGestureRecognizer: UILongPressGestureRecognizer = {
        let recognizer = UILongPressGestureRecognizer(
            target: self,
            action: #selector(handlePressIndication(_:))
        )
        recognizer.minimumPressDuration = Animation.pressIndicationDelay
        recognizer.allowableMovement = gestureDeadZoneRadius
        recognizer.cancelsTouchesInView = false
        recognizer.delegate = self
        return recognizer
    }()

    private lazy var longPressGestureRecognizer: UILongPressGestureRecognizer = {
        let recognizer = UILongPressGestureRecognizer(
            target: self,
            action: #selector(handleLongPress(_:))
        )
        recognizer.minimumPressDuration = Animation.menuDelay
        recognizer.allowableMovement = gestureDeadZoneRadius
        recognizer.cancelsTouchesInView = true
        recognizer.delegate = self
        return recognizer
    }()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        addGestureRecognizer(pressIndicationGestureRecognizer)
        addGestureRecognizer(longPressGestureRecognizer)
        isAccessibilityElement = false
    }

    deinit {
        presentationView?.dismiss()
    }

    @objc
    private func handlePressIndication(_ recognizer: UILongPressGestureRecognizer) {
        switch recognizer.state {
        case .began:
            beginPressIndication()
        case .ended, .cancelled, .failed:
            endPressIndication(animated: presentationView == nil)
        default:
            break
        }
    }

    @objc
    private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
        guard !actions.isEmpty else {
            return
        }

        switch recognizer.state {
        case .began:
            presentMenu(for: recognizer)
            // Capture and hide the pressed state before restoring the source.
            // Resetting first creates a visible pop between the chat message
            // and its floating preview.
            endPressIndication(animated: false)
        case .changed:
            updateGesture(for: recognizer)
        case .ended:
            finishGesture(for: recognizer)
        case .cancelled, .failed:
            presentationView?.dismiss()
            resetGestureState()
        default:
            break
        }
    }

    private func beginPressIndication() {
        guard !actions.isEmpty, presentationView == nil,
              indicationBaseTransform == nil
        else {
            return
        }

        indicationBaseTransform = transform
        indicationBaseAlpha = alpha
        indicationRestingFrameInWindow = window.map {
            convert(bounds, to: $0)
        }

        UIView.animate(
            withDuration: Animation.pressDuration,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
        ) {
            self.transform = self.transform.scaledBy(
                x: Animation.pressScale,
                y: Animation.pressScale
            )
            self.alpha *= Animation.pressAlpha
        }
    }

    private func endPressIndication(animated: Bool) {
        guard let baseTransform = indicationBaseTransform,
              let baseAlpha = indicationBaseAlpha
        else {
            return
        }

        indicationBaseTransform = nil
        indicationBaseAlpha = nil
        indicationRestingFrameInWindow = nil

        if !animated {
            layer.removeAllAnimations()
            transform = baseTransform
            alpha = baseAlpha
            return
        }

        UIView.animate(
            withDuration: Animation.pressRestoreDuration,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
        ) {
            self.transform = baseTransform
            self.alpha = baseAlpha
        }
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // The short press indication and menu long press deliberately overlap.
        // Every other recognizer, especially the chat list pan, should arbitrate
        // normally so scrolling cannot continue behind an open menu.
        (gestureRecognizer === pressIndicationGestureRecognizer
            && otherGestureRecognizer === longPressGestureRecognizer)
            || (gestureRecognizer === longPressGestureRecognizer
                && otherGestureRecognizer === pressIndicationGestureRecognizer)
    }

    func gestureRecognizer(
        _: UIGestureRecognizer,
        shouldReceive touch: UITouch
    ) -> Bool {
        var touchedView = touch.view
        while let view = touchedView, view !== self {
            // Reaction pills own their long press so users can inspect who
            // reacted instead of opening the message-level action menu.
            if view.accessibilityIdentifier?.hasPrefix("ReactionDisplay") == true {
                return false
            }
            touchedView = view.superview
        }
        return true
    }

    private func presentMenu(for recognizer: UILongPressGestureRecognizer) {
        guard presentationView == nil, !actions.isEmpty, let window else {
            return
        }

        let location = recognizer.location(in: window)
        initialGestureLocation = location
        gestureExitedDeadZone = false

        let presentation = TlonMessageMenuPresentationView(
            sourceView: self,
            restingSourceFrame: indicationRestingFrameInWindow,
            actions: actions,
            reactions: reactions,
            selectedReaction: selectedReaction,
            alignment: alignment,
            previewBackgroundColor: previewBackgroundColor
        ) { [weak self] selection in
            guard let self else {
                return
            }

            presentationView = nil
            resetGestureState()

            switch selection {
            case let .action(id):
                onAction(["id": id])
            case let .reaction(value):
                onReaction(["value": value])
            case .moreReactions:
                onMoreReactions([:])
            case nil:
                break
            }
        }
        indicationRestingFrameInWindow = nil

        presentationView = presentation

        let feedback = UIImpactFeedbackGenerator(style: .medium)
        feedback.prepare()
        feedback.impactOccurred(intensity: 0.8)

        presentation.present(in: window)
    }

    private func updateGesture(for recognizer: UILongPressGestureRecognizer) {
        guard let window, let initialGestureLocation else {
            return
        }

        let location = recognizer.location(in: window)
        if !gestureExitedDeadZone {
            let distance = hypot(
                location.x - initialGestureLocation.x,
                location.y - initialGestureLocation.y
            )
            gestureExitedDeadZone = distance >= gestureDeadZoneRadius
        }

        presentationView?.updateGesture(
            at: location,
            isSelecting: gestureExitedDeadZone
        )
    }

    private func finishGesture(for recognizer: UILongPressGestureRecognizer) {
        guard let window else {
            resetGestureState()
            return
        }

        let location = recognizer.location(in: window)
        presentationView?.finishGesture(
            at: location,
            shouldSelect: gestureExitedDeadZone
        )
        resetGestureState()
    }

    private func resetGestureState() {
        initialGestureLocation = nil
        gestureExitedDeadZone = false
    }
}
