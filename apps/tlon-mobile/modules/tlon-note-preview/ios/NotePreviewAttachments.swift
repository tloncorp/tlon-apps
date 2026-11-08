import SDWebImage
import UIKit

// Reserves a full-width line for a view as tall as `height`. The attachment
// itself draws nothing: a read-only UITextView doesn't load attachment views,
// so TlonNotePreviewView places `view` over the reserved line after layout.
final class NoteViewAttachment: NSTextAttachment {
  let view: UIView
  let height: CGFloat

  private static let blank = UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1))
    .image { _ in }

  init(view: UIView, height: CGFloat) {
    self.view = view
    self.height = height
    super.init(data: nil, ofType: nil)
    allowsTextAttachmentView = false
    image = Self.blank
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func attachmentBounds(
    for attributes: [NSAttributedString.Key: Any],
    location: NSTextLocation,
    textContainer: NSTextContainer?,
    proposedLineFragment: CGRect,
    position: CGPoint
  ) -> CGRect {
    CGRect(x: 0, y: 0, width: proposedLineFragment.width, height: height)
  }
}

final class NoteImageView: UIImageView {
  private let onPress: () -> Void

  init(src: String, alt: String, background: UIColor, onPress: @escaping () -> Void) {
    self.onPress = onPress
    super.init(frame: .zero)
    contentMode = .scaleAspectFill
    clipsToBounds = true
    layer.cornerRadius = NoteMetrics.cornerRadius
    backgroundColor = background
    accessibilityLabel = alt.isEmpty ? nil : alt
    isAccessibilityElement = true
    accessibilityTraits = [.image, .button]
    isUserInteractionEnabled = true
    addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(press)))
    sd_setImage(with: URL(string: src))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  @objc private func press() { onPress() }
}

final class NoteVideoView: UIView {
  private let onPress: () -> Void

  init(posterUri: String?, background: UIColor, onPress: @escaping () -> Void) {
    self.onPress = onPress
    super.init(frame: .zero)
    clipsToBounds = true
    layer.cornerRadius = NoteMetrics.cornerRadius
    backgroundColor = background

    let poster = UIImageView()
    poster.contentMode = .scaleAspectFill
    poster.translatesAutoresizingMaskIntoConstraints = false
    if let posterUri { poster.sd_setImage(with: URL(string: posterUri)) }
    addSubview(poster)

    let play = UIImageView(image: UIImage(systemName: "play.circle.fill"))
    play.tintColor = .white
    play.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 44)
    play.translatesAutoresizingMaskIntoConstraints = false
    addSubview(play)

    NSLayoutConstraint.activate([
      poster.leadingAnchor.constraint(equalTo: leadingAnchor),
      poster.trailingAnchor.constraint(equalTo: trailingAnchor),
      poster.topAnchor.constraint(equalTo: topAnchor),
      poster.bottomAnchor.constraint(equalTo: bottomAnchor),
      play.centerXAnchor.constraint(equalTo: centerXAnchor),
      play.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])
    accessibilityLabel = "Play video"
    isAccessibilityElement = true
    accessibilityTraits = .button
    addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(press)))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  @objc private func press() { onPress() }
}

// Column widths fit the widest cell (within limits), as the React table does.
struct NoteTableLayout {
  let header: [NSAttributedString]
  let rows: [[NSAttributedString]]
  let align: [String?]
  let columnWidths: [CGFloat]
  let rowHeights: [CGFloat]
  let size: CGSize

  static let cellPadding: CGFloat = 8
  static let minColumn: CGFloat = 60
  static let maxColumn: CGFloat = 280

  init(header: [NSAttributedString], rows: [[NSAttributedString]], align: [String?]) {
    self.header = header
    self.rows = rows
    self.align = align
    let all = [header] + rows
    let columns = all.map(\.count).max() ?? 0
    let pad = Self.cellPadding * 2
    let widths = (0..<columns).map { column -> CGFloat in
      let widest = all.compactMap { $0.indices.contains(column) ? $0[column] : nil }
        .map {
          ceil(
            $0.boundingRect(
              with: CGSize(width: Self.maxColumn, height: .greatestFiniteMagnitude),
              options: [.usesLineFragmentOrigin], context: nil
            ).width)
        }
        .max() ?? 0
      return min(max(widest + pad, Self.minColumn), Self.maxColumn + pad)
    }
    let heights = all.map { row -> CGFloat in
      row.enumerated().map { column, cell in
        ceil(
          cell.boundingRect(
            with: CGSize(width: widths[column] - pad, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin], context: nil
          ).height) + pad
      }.max() ?? (NoteMetrics.bodyLineHeight + pad)
    }
    columnWidths = widths
    rowHeights = heights
    size = CGSize(width: widths.reduce(0, +) + 1, height: heights.reduce(0, +) + 1)
  }
}

// A horizontally scrolling grid; wide tables scroll instead of squeezing.
final class NoteTableView: UIScrollView {
  init(layout: NoteTableLayout, border: UIColor, onPressURL: @escaping (URL) -> Void) {
    super.init(frame: .zero)
    showsHorizontalScrollIndicator = false
    alwaysBounceHorizontal = false
    contentSize = layout.size

    let grid = UIView(frame: CGRect(origin: .zero, size: layout.size))
    grid.layer.borderColor = border.cgColor
    grid.layer.borderWidth = 1
    grid.layer.cornerRadius = NoteMetrics.cornerRadius
    grid.clipsToBounds = true
    addSubview(grid)

    let pad = NoteTableLayout.cellPadding
    var y: CGFloat = 0
    for (rowIndex, row) in ([layout.header] + layout.rows).enumerated() {
      var x: CGFloat = 0
      for (column, width) in layout.columnWidths.enumerated() {
        let alignment: NSTextAlignment
        switch layout.align.indices.contains(column) ? layout.align[column] : nil {
        case "center": alignment = .center
        case "right": alignment = .right
        default: alignment = .natural
        }
        let cell = NoteTableCellView(
          text: row.indices.contains(column) ? row[column] : nil,
          alignment: alignment,
          onPressURL: onPressURL)
        cell.frame = CGRect(
          x: x + pad, y: y + pad, width: width - pad * 2,
          height: layout.rowHeights[rowIndex] - pad * 2)
        grid.addSubview(cell)
        if column > 0 {
          let line = UIView(frame: CGRect(x: x, y: y, width: 1, height: layout.rowHeights[rowIndex]))
          line.backgroundColor = border
          grid.addSubview(line)
        }
        x += width
      }
      y += layout.rowHeights[rowIndex]
      if rowIndex < layout.rows.count {
        let line = UIView(frame: CGRect(x: 0, y: y, width: layout.size.width, height: 1))
        line.backgroundColor = border
        grid.addSubview(line)
      }
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}

// A cell's text, read-only. Unlike a label it passes link and mention taps on.
final class NoteTableCellView: UITextView, UITextViewDelegate {
  private let onPressURL: (URL) -> Void

  init(text: NSAttributedString?, alignment: NSTextAlignment, onPressURL: @escaping (URL) -> Void) {
    self.onPressURL = onPressURL
    super.init(frame: .zero, textContainer: nil)
    isEditable = false
    isSelectable = true
    isScrollEnabled = false
    backgroundColor = .clear
    textContainerInset = .zero
    textContainer.lineFragmentPadding = 0
    linkTextAttributes = [:]
    attributedText = text
    textAlignment = alignment
    delegate = self
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  @available(iOS 17.0, *)
  func textView(
    _ textView: UITextView,
    primaryActionFor textItem: UITextItem,
    defaultAction: UIAction
  ) -> UIAction? {
    guard case .link(let url) = textItem.content else { return defaultAction }
    return UIAction { [weak self] _ in self?.onPressURL(url) }
  }

  func textView(
    _ textView: UITextView,
    shouldInteractWith URL: URL,
    in characterRange: NSRange,
    interaction: UITextItemInteraction
  ) -> Bool {
    if interaction == .invokeDefaultAction {
      onPressURL(URL)
    }
    return false
  }
}
