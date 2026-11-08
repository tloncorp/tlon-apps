import ExpoModulesCore
import UIKit

extension NSAttributedString.Key {
  // What is drawn behind a block's text: see NoteDecorationView.
  static let noteDecoration = NSAttributedString.Key("TlonNoteDecoration")
  // What Copy puts on the pasteboard for an attachment character.
  static let noteCopyText = NSAttributedString.Key("TlonNoteCopyText")
}

private let mentionScheme = "tlon-mention"

// A rendered note as one selectable TextKit 2 text view. Images, video and
// tables hold a line each as attachments, with their views laid over those
// lines, so a selection runs through them; code backgrounds, quote bars and
// rules are drawn behind the text.
final class TlonNotePreviewView: ExpoView, UITextViewDelegate {
  let onContentHeight = EventDispatcher()
  let onPressLink = EventDispatcher()
  let onPressMention = EventDispatcher()
  let onPressImage = EventDispatcher()
  let onPressVideo = EventDispatcher()

  var documentJson = "[]" {
    didSet { needsRebuild = true; setNeedsLayout() }
  }
  var themeJson = "{}" {
    didSet { needsRebuild = true; setNeedsLayout() }
  }

  private let decorationView = NoteDecorationView()
  private let textView = NotePreviewTextView(usingTextLayoutManager: true)
  private var needsRebuild = true
  private var builtWidth: CGFloat = 0
  private var reportedHeight: CGFloat = -1
  private var codeBlocks: [(range: NSRange, text: String)] = []
  private var copyButtons: [UIButton] = []
  private var attachments: [(location: Int, attachment: NoteViewAttachment)] = []
  private var theme = NoteTheme()
  private var fontScale: CGFloat = 1

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false
    textView.backgroundColor = .clear
    textView.textContainerInset = UIEdgeInsets(
      top: NoteMetrics.edgeSpacing, left: 0, bottom: NoteMetrics.edgeSpacing, right: 0)
    textView.textContainer.lineFragmentPadding = 0
    textView.linkTextAttributes = [:]
    textView.delegate = self
    decorationView.isUserInteractionEnabled = false
    decorationView.backgroundColor = .clear
    addSubview(decorationView)
    addSubview(textView)
  }

  // Text sizes follow Dynamic Type, so a new preferred size rebuilds.
  override func traitCollectionDidChange(_ previous: UITraitCollection?) {
    super.traitCollectionDidChange(previous)
    if previous?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
      needsRebuild = true
      setNeedsLayout()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    decorationView.frame = bounds
    guard bounds.width > 0 else { return }
    // Image and table sizes depend on the width, so a new width rebuilds.
    if needsRebuild || bounds.width != builtWidth {
      rebuild()
    }
    if let layoutManager = textView.textLayoutManager {
      layoutManager.ensureLayout(for: layoutManager.documentRange)
    }
    let height = ceil(
      textView.sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude)).height)
    if abs(height - reportedHeight) > 0.5 {
      reportedHeight = height
      onContentHeight(["height": height])
    }
    layoutDecorations()
    layoutAttachmentViews()
    layoutCopyButtons()
  }

  private func rebuild() {
    needsRebuild = false
    builtWidth = bounds.width
    theme = NoteTheme(json: themeJson)
    let blocks =
      (try? JSONDecoder().decode([NoteBlock].self, from: Data(documentJson.utf8))) ?? []
    fontScale =
      UIFontMetrics(forTextStyle: .body).scaledValue(for: 100, compatibleWith: traitCollection)
      / 100
    let builder = NoteAttributedBuilder(
      theme: theme,
      width: bounds.width,
      fontScale: fontScale,
      onPressURL: { [weak self] url in self?.handle(url) },
      onPressImage: { [weak self] src in self?.onPressImage(["src": src]) },
      onPressVideo: { [weak self] src, posterUri in
        var payload: [String: Any] = ["src": src]
        if let posterUri { payload["posterUri"] = posterUri }
        self?.onPressVideo(payload)
      })
    let result = builder.build(blocks)
    codeBlocks = result.codeBlocks
    textView.attributedText = result.text
    rebuildAttachmentViews()
    rebuildCopyButtons()
  }

  // MARK: Attachment views

  private func rebuildAttachmentViews() {
    attachments.forEach { $0.attachment.view.removeFromSuperview() }
    attachments = []
    guard let text = textView.attributedText else { return }
    text.enumerateAttribute(.attachment, in: NSRange(location: 0, length: text.length)) {
      value, range, _ in
      guard let attachment = value as? NoteViewAttachment else { return }
      attachments.append((range.location, attachment))
      textView.addSubview(attachment.view)
    }
  }

  // Each view covers the line its attachment reserves, which is exactly the
  // view's height (see NoteAttributedBuilder.attachmentBlock).
  private func layoutAttachmentViews() {
    guard let layoutManager = textView.textLayoutManager else { return }
    for (location, attachment) in attachments {
      guard
        let textLocation = layoutManager.location(
          layoutManager.documentRange.location, offsetBy: location),
        let fragment = layoutManager.textLayoutFragment(for: textLocation)
      else { continue }
      let lineTop = fragment.textLineFragments.first?.typographicBounds.minY ?? 0
      attachment.view.frame = CGRect(
        x: 0,
        y: textView.textContainerInset.top + fragment.layoutFragmentFrame.minY + lineTop,
        width: bounds.width,
        height: attachment.height)
    }
  }

  // MARK: Code copy buttons

  // The Copy button's row grows with the text size, as its label does.
  private var codeHeader: CGFloat { NoteMetrics.codeHeader * fontScale }

  private func rebuildCopyButtons() {
    copyButtons.forEach { $0.removeFromSuperview() }
    copyButtons = codeBlocks.enumerated().map { index, _ in
      var config = UIButton.Configuration.plain()
      config.title = "Copy"
      config.baseForegroundColor = theme.tertiaryText
      config.contentInsets = NSDirectionalEdgeInsets(top: 2, leading: 8, bottom: 2, trailing: 8)
      let button = UIButton(configuration: config)
      button.tag = index
      button.addTarget(self, action: #selector(copyCode(_:)), for: .touchUpInside)
      textView.addSubview(button)
      return button
    }
  }

  private func layoutCopyButtons() {
    guard let layoutManager = textView.textLayoutManager else { return }
    for (index, block) in codeBlocks.enumerated() where index < copyButtons.count {
      guard
        let location = layoutManager.location(
          layoutManager.documentRange.location, offsetBy: block.range.location),
        let fragment = layoutManager.textLayoutFragment(for: location)
      else { continue }
      let button = copyButtons[index]
      let size = button.intrinsicContentSize
      let frame = fragment.layoutFragmentFrame
      let lineTop = fragment.textLineFragments.first?.typographicBounds.minY ?? 0
      button.frame = CGRect(
        x: bounds.width - size.width - 4,
        y: textView.textContainerInset.top + frame.minY + lineTop - NoteMetrics.codePadding
          - codeHeader + (codeHeader - size.height) / 2 + 4,
        width: size.width,
        height: size.height)
    }
  }

  @objc private func copyCode(_ sender: UIButton) {
    guard sender.tag < codeBlocks.count else { return }
    UIPasteboard.general.string = codeBlocks[sender.tag].text
    var config = sender.configuration
    config?.title = "Copied"
    sender.configuration = config
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak sender] in
      var config = sender?.configuration
      config?.title = "Copy"
      sender?.configuration = config
    }
  }

  // MARK: Links and mentions

  private func handle(_ url: URL) {
    if url.scheme == mentionScheme {
      let contactId = url.host ?? url.absoluteString.replacingOccurrences(
        of: "\(mentionScheme)://", with: "")
      onPressMention(["contactId": contactId.removingPercentEncoding ?? contactId])
    } else {
      onPressLink(["url": url.absoluteString])
    }
  }

  @available(iOS 17.0, *)
  func textView(
    _ textView: UITextView,
    primaryActionFor textItem: UITextItem,
    defaultAction: UIAction
  ) -> UIAction? {
    guard case .link(let url) = textItem.content else { return defaultAction }
    return UIAction { [weak self] _ in self?.handle(url) }
  }

  func textView(
    _ textView: UITextView,
    shouldInteractWith URL: URL,
    in characterRange: NSRange,
    interaction: UITextItemInteraction
  ) -> Bool {
    if interaction == .invokeDefaultAction {
      handle(URL)
    }
    return false
  }

  // MARK: Decorations

  // Each decorated block's lines, in this view's coordinates, from the
  // finished layout: the code background spans the column and pads the
  // block, the quote bar runs down its left edge, the rule crosses its middle.
  private func layoutDecorations() {
    guard let layoutManager = textView.textLayoutManager,
      let text = textView.attributedText
    else { return }
    var items: [NoteDecorationView.Item] = []
    text.enumerateAttribute(
      .noteDecoration, in: NSRange(location: 0, length: text.length)
    ) { value, range, _ in
      guard let decoration = value as? NoteDecoration,
        let start = layoutManager.location(
          layoutManager.documentRange.location, offsetBy: range.location),
        let end = layoutManager.location(start, offsetBy: range.length)
      else { return }
      var lines = CGRect.null
      layoutManager.enumerateTextLayoutFragments(from: start, options: [.ensuresLayout]) {
        fragment in
        guard fragment.rangeInElement.location.compare(end) == .orderedAscending else {
          return false
        }
        for line in fragment.textLineFragments {
          lines = lines.union(
            line.typographicBounds.offsetBy(
              dx: fragment.layoutFragmentFrame.minX, dy: fragment.layoutFragmentFrame.minY))
        }
        return true
      }
      guard !lines.isNull else { return }
      let top = textView.textContainerInset.top
      let rect: CGRect
      switch decoration.kind {
      case .code:
        rect = CGRect(
          x: 0, y: top + lines.minY - NoteMetrics.codePadding - codeHeader,
          width: bounds.width,
          height: lines.height + NoteMetrics.codePadding * 2 + codeHeader)
      case .quote:
        rect = CGRect(x: 0, y: top + lines.minY, width: 2, height: lines.height)
      case .rule:
        rect = CGRect(x: 0, y: top + lines.midY - 0.5, width: bounds.width, height: 1)
      }
      items.append(.init(rect: rect, color: decoration.color, rounded: decoration.kind == .code))
    }
    decorationView.items = items
  }
}

final class NoteDecorationView: UIView {
  struct Item {
    let rect: CGRect
    let color: UIColor
    let rounded: Bool
  }

  var items: [Item] = [] {
    didSet { setNeedsDisplay() }
  }

  override func draw(_ rect: CGRect) {
    for item in items {
      item.color.setFill()
      if item.rounded {
        UIBezierPath(roundedRect: item.rect, cornerRadius: NoteMetrics.cornerRadius).fill()
      } else {
        UIBezierPath(rect: item.rect).fill()
      }
    }
  }
}

final class NotePreviewTextView: UITextView {
  // Copies plain text, with each attachment's own text (an image's address,
  // a table's tab-separated rows) in place of its placeholder character.
  override func copy(_ sender: Any?) {
    let range = selectedRange
    guard range.length > 0, let text = attributedText else {
      super.copy(sender)
      return
    }
    let selected = text.attributedSubstring(from: range)
    var plain = ""
    selected.enumerateAttribute(
      .noteCopyText, in: NSRange(location: 0, length: selected.length)
    ) { value, subrange, _ in
      if let copyText = value as? String {
        plain += copyText
      } else {
        plain += (selected.string as NSString).substring(with: subrange)
      }
    }
    UIPasteboard.general.string = plain
  }
}
