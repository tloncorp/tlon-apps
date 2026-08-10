import UIKit

private final class TlonMessageMenuButton: UIButton {
    var restingBackgroundColor: UIColor = .clear {
        didSet {
            if !isHighlighted {
                backgroundColor = restingBackgroundColor
            }
        }
    }

    var highlightedBackgroundColor = UIColor.white.withAlphaComponent(0.12)

    override var isHighlighted: Bool {
        didSet {
            backgroundColor = isHighlighted
                ? highlightedBackgroundColor
                : restingBackgroundColor
        }
    }
}

protocol TlonMessageMenuButtonCollection: AnyObject {
    associatedtype Payload
    var buttons: [(payload: Payload, button: UIButton)] { get }
}

extension TlonMessageMenuButtonCollection where Self: UIView {
    func updateHighlight(at point: CGPoint?) {
        for (_, button) in buttons {
            guard let point else {
                button.isHighlighted = false
                continue
            }
            let localPoint = button.convert(point, from: self)
            button.isHighlighted = button.bounds.contains(localPoint)
        }
    }

    func selectedButton(at point: CGPoint) -> (payload: Payload, button: UIButton)? {
        for (payload, button) in buttons {
            let localPoint = button.convert(point, from: self)
            if button.bounds.contains(localPoint) {
                return (payload, button)
            }
        }
        return nil
    }
}

private final class TlonMessageActionRowView: UIView {
    let button = TlonMessageMenuButton(type: .custom)
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let separator = UIView()
    private let showsSeparator: Bool

    init(showsSeparator: Bool) {
        self.showsSeparator = showsSeparator
        super.init(frame: .zero)
        addSubview(button)
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        addSubview(iconView)
        titleLabel.font = .preferredFont(forTextStyle: .body)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.isUserInteractionEnabled = false
        addSubview(titleLabel)
        separator.backgroundColor = UIColor.white.withAlphaComponent(0.14)
        addSubview(separator)
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        button.frame = bounds
        let horizontalInset: CGFloat = 16
        let iconSize: CGFloat = 24
        let iconSpacing: CGFloat = 12
        let titleX: CGFloat
        if iconView.image == nil {
            iconView.frame = .zero
            titleX = horizontalInset
        } else {
            iconView.frame = CGRect(
                x: horizontalInset,
                y: (bounds.height - iconSize) / 2,
                width: iconSize,
                height: iconSize
            )
            titleX = iconView.frame.maxX + iconSpacing
        }
        titleLabel.frame = CGRect(
            x: titleX,
            y: 0,
            width: max(0, bounds.width - titleX - horizontalInset),
            height: bounds.height
        )
        separator.frame = CGRect(
            x: 16,
            y: bounds.height - 0.5,
            width: max(0, bounds.width - 32),
            height: showsSeparator ? 0.5 : 0
        )
    }

    func configure(
        title: String,
        image: UIImage?,
        foregroundColor: UIColor
    ) {
        titleLabel.text = title
        titleLabel.textColor = foregroundColor
        iconView.image = image
        iconView.tintColor = foregroundColor
        setNeedsLayout()
    }
}

final class TlonMessageActionListView: UIView, TlonMessageMenuButtonCollection {
    private let blurView = UIVisualEffectView(
        effect: UIBlurEffect(style: .systemMaterialDark)
    )
    private let scrollView = UIScrollView()
    private let stackView = UIStackView()
    var buttons: [(payload: String, button: UIButton)] = []

    var onSelection: ((String) -> Void)?

    let menuWidth: CGFloat = 252
    private let rowHeight = max(
        50,
        ceil(UIFont.preferredFont(forTextStyle: .body).lineHeight + 28)
    )
    var contentHeight: CGFloat {
        CGFloat(buttons.count) * rowHeight
    }

    init(actions: [TlonMessageMenuAction]) {
        super.init(frame: .zero)

        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        clipsToBounds = true

        addSubview(blurView)
        blurView.contentView.addSubview(scrollView)
        scrollView.addSubview(stackView)
        scrollView.showsVerticalScrollIndicator = actions.count > 6
        scrollView.alwaysBounceVertical = false

        stackView.axis = .vertical
        stackView.alignment = .fill
        stackView.distribution = .fill

        for (index, action) in actions.enumerated() {
            let row = makeRow(action: action, showsSeparator: index < actions.count - 1)
            stackView.addArrangedSubview(row)
            row.heightAnchor.constraint(equalToConstant: rowHeight).isActive = true
        }

        isAccessibilityElement = false
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        blurView.frame = bounds
        scrollView.frame = bounds
        stackView.frame = CGRect(
            x: 0,
            y: 0,
            width: bounds.width,
            height: contentHeight
        )
        stackView.setNeedsLayout()
        stackView.layoutIfNeeded()
        scrollView.contentSize = stackView.bounds.size
    }

    func selection(at point: CGPoint) -> String? {
        selectedButton(at: point)?.payload
    }

    private func makeRow(
        action: TlonMessageMenuAction,
        showsSeparator: Bool
    ) -> UIView {
        let row = TlonMessageActionRowView(showsSeparator: showsSeparator)
        let button = row.button
        button.accessibilityLabel = action.title
        button.accessibilityTraits = .button
        button.tag = buttons.count
        button.addTarget(self, action: #selector(actionPressed(_:)), for: .touchUpInside)
        let foregroundColor: UIColor = action.destructive
            ? .systemRed
            : .white
        row.configure(
            title: action.title,
            image: action.systemImage.flatMap(UIImage.init(systemName:)),
            foregroundColor: foregroundColor
        )

        buttons.append((action.id, button))
        return row
    }

    @objc
    private func actionPressed(_ sender: UIButton) {
        guard sender.tag < buttons.count else {
            return
        }
        onSelection?(buttons[sender.tag].payload)
    }
}

final class TlonMessageReactionBarView: UIView, TlonMessageMenuButtonCollection {
    private let blurView = UIVisualEffectView(
        effect: UIBlurEffect(style: .systemMaterialDark)
    )
    private let stackView = UIStackView()
    var buttons: [(payload: String?, button: UIButton)] = []

    var onReaction: ((String) -> Void)?
    var onMoreReactions: (() -> Void)?

    let barHeight: CGFloat = 58
    var barWidth: CGFloat {
        min(300, CGFloat(buttons.count) * 46 + 16)
    }

    init(reactions: [String], selectedReaction: String?) {
        super.init(frame: .zero)

        layer.cornerRadius = barHeight / 2
        layer.cornerCurve = .continuous
        clipsToBounds = true

        addSubview(blurView)
        blurView.contentView.addSubview(stackView)
        stackView.axis = .horizontal
        stackView.alignment = .center
        stackView.distribution = .fillEqually
        stackView.spacing = 2

        for reaction in reactions {
            let button = makeButton(
                title: reaction,
                value: reaction,
                selected: reaction == selectedReaction
            )
            stackView.addArrangedSubview(button)
        }

        let moreButton = makeButton(title: "", value: nil, selected: false)
        moreButton.setImage(UIImage(systemName: "chevron.down"), for: .normal)
        moreButton.setPreferredSymbolConfiguration(
            UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold),
            forImageIn: .normal
        )
        moreButton.tintColor = .white
        moreButton.accessibilityLabel = "More reactions"
        stackView.addArrangedSubview(moreButton)
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        blurView.frame = bounds
        stackView.frame = bounds.insetBy(dx: 8, dy: 6)
    }

    func selection(at point: CGPoint) -> TlonMessageMenuSelection? {
        guard let selection = selectedButton(at: point) else {
            return nil
        }
        if let value = selection.payload {
            return .reaction(value)
        }
        return .moreReactions
    }

    private func makeButton(
        title: String,
        value: String?,
        selected: Bool
    ) -> UIButton {
        let button = TlonMessageMenuButton(type: .custom)
        button.setTitle(title, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 26)
        button.accessibilityLabel = value ?? "More reactions"
        button.accessibilityTraits = .button
        button.layer.cornerRadius = 20
        button.layer.cornerCurve = .continuous
        button.restingBackgroundColor = selected
            ? UIColor.white.withAlphaComponent(0.14)
            : .clear
        button.tag = buttons.count
        button.addTarget(self, action: #selector(reactionPressed(_:)), for: .touchUpInside)
        buttons.append((value, button))
        return button
    }

    @objc
    private func reactionPressed(_ sender: UIButton) {
        guard sender.tag < buttons.count else {
            return
        }
        if let value = buttons[sender.tag].payload {
            onReaction?(value)
        } else {
            onMoreReactions?()
        }
    }
}
