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

    var actions: [TlonMessageMenuAction] = [] {
        didSet {
            guard !actions.elementsEqual(oldValue, by: Self.actionsMatch) else {
                return
            }
            presentationView?.dismiss()
        }
    }

    var reactions: [String] = [] {
        didSet {
            if reactions != oldValue {
                presentationView?.dismiss()
            }
        }
    }

    var selectedReaction: String? {
        didSet {
            if selectedReaction != oldValue {
                presentationView?.dismiss()
            }
        }
    }

    var contentKey = "" {
        didSet {
            if contentKey != oldValue {
                presentationView?.dismiss()
            }
        }
    }

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
              indicationBaseTransform == nil,
              !UIAccessibility.isReduceMotionEnabled
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
        let isMenuPair = (gestureRecognizer === pressIndicationGestureRecognizer
            && otherGestureRecognizer === longPressGestureRecognizer)
            || (gestureRecognizer === longPressGestureRecognizer
                && otherGestureRecognizer === pressIndicationGestureRecognizer)
        if isMenuPair {
            return true
        }

        // Once the earlier indication has recognized, it must not pin the chat
        // list. Only that recognizer may coexist with a scroll view's pan; the
        // menu long press still competes normally so scrolling wins.
        let otherRecognizer = gestureRecognizer === pressIndicationGestureRecognizer
            ? otherGestureRecognizer
            : otherGestureRecognizer === pressIndicationGestureRecognizer
            ? gestureRecognizer
            : nil
        return otherRecognizer is UIPanGestureRecognizer
            && otherRecognizer?.view is UIScrollView
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
        let presentedContentKey = contentKey

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
                // Props can change while dismissal is finishing. Never dispatch
                // an action that is no longer present in the latest model.
                if contentKey == presentedContentKey,
                   actions.contains(where: { $0.id == id })
                {
                    onAction(["id": id])
                }
            case let .reaction(value):
                if reactions.contains(value) {
                    onReaction(["value": value])
                }
            case .moreReactions:
                if !reactions.isEmpty {
                    onMoreReactions([:])
                }
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

    private static func actionsMatch(
        _ lhs: TlonMessageMenuAction,
        _ rhs: TlonMessageMenuAction
    ) -> Bool {
        lhs.id == rhs.id
            && lhs.title == rhs.title
            && lhs.systemImage == rhs.systemImage
            && lhs.destructive == rhs.destructive
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
