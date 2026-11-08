import UIKit

// The React renderer's metrics (packages/ui TextV2 sizes, BlockWrapper padding).
enum NoteMetrics {
  static let bodySize: CGFloat = 16
  static let bodyLineHeight: CGFloat = 24
  static let bodyKern: CGFloat = -0.032
  static let monoSize: CGFloat = 14
  static let monoLineHeight: CGFloat = 24
  static let headingSizes: [String: CGFloat] = [
    "h1": 24, "h2": 20, "h3": 16, "h4": 14, "h5": 12, "h6": 10,
  ]
  static let bigEmojiSize: CGFloat = 36
  // Blocks carry 12pt padding on every side, so 24pt sit between two.
  static let blockSpacing: CGFloat = 24
  static let edgeSpacing: CGFloat = 12
  static let listItemSpacing: CGFloat = 4
  static let listIndent: CGFloat = 24
  static let markerColumn: CGFloat = 18
  static let quoteIndent: CGFloat = 12
  static let codePadding: CGFloat = 12
  static let cornerRadius: CGFloat = 6
}

// What NoteDecorationView draws behind a block: one object per block, so a
// block's lines are found by the range carrying it.
final class NoteDecoration: NSObject {
  enum Kind { case code, quote, rule }
  let kind: Kind
  let color: UIColor

  init(_ kind: Kind, color: UIColor) {
    self.kind = kind
    self.color = color
  }
}

struct NoteAttributedBuilder {
  let theme: NoteTheme
  let width: CGFloat
  let onPressImage: (String) -> Void
  let onPressVideo: (_ src: String, _ posterUri: String?) -> Void

  struct Result {
    let text: NSAttributedString
    let codeBlocks: [(range: NSRange, text: String)]
  }

  func build(_ blocks: [NoteBlock]) -> Result {
    let output = NSMutableAttributedString()
    var codeBlocks: [(range: NSRange, text: String)] = []
    var previousWasListItem = false

    for (index, block) in blocks.enumerated() {
      var isListItem = false
      var startsList = false
      if case .text(_, _, let indent, _, let listStart) = block {
        isListItem = indent != nil
        startsList = listStart
      }
      let spacingBefore: CGFloat =
        index == 0
        ? 0
        : (isListItem && previousWasListItem && !startsList
          ? NoteMetrics.listItemSpacing : NoteMetrics.blockSpacing)
      previousWasListItem = isListItem
      if index > 0 {
        // The newline ends the previous paragraph, so it takes that
        // paragraph's style; never its attachment or copy text.
        var attributes = output.attributes(at: output.length - 1, effectiveRange: nil)
        attributes[.attachment] = nil
        attributes[.noteCopyText] = nil
        attributes[.link] = nil
        output.append(NSAttributedString(string: "\n", attributes: attributes))
      }

      switch block {
      case .text(let style, let runs, let indent, let marker, _):
        output.append(textBlock(style: style, runs: runs, indent: indent, marker: marker, spacingBefore: spacingBefore))
      case .code(let runs):
        let start = output.length
        let block = codeBlock(runs: runs, spacingBefore: spacingBefore)
        output.append(block)
        codeBlocks.append(
          (NSRange(location: start, length: block.length), runs.map(\.text).joined()))
      case .image(let src, let imageWidth, let imageHeight, let alt):
        let ratio = imageWidth > 0 && imageHeight > 0 ? imageHeight / imageWidth : 0.75
        output.append(
          attachmentBlock(
            NoteViewAttachment(
              view: NoteImageView(src: src, alt: alt, background: theme.codeBackground) {
                onPressImage(src)
              },
              height: ceil(width * CGFloat(ratio))),
            copyText: src,
            spacingBefore: spacingBefore))
      case .video(let src, let posterUri, let videoWidth, let videoHeight):
        let ratio: Double = {
          if let w = videoWidth, let h = videoHeight, w > 0, h > 0 { return h / w }
          return 9.0 / 16.0
        }()
        output.append(
          attachmentBlock(
            NoteViewAttachment(
              view: NoteVideoView(posterUri: posterUri, background: theme.codeBackground) {
                onPressVideo(src, posterUri)
              },
              height: ceil(width * CGFloat(ratio))),
            copyText: src,
            spacingBefore: spacingBefore))
      case .table(let header, let rows, let align):
        let grid = NoteTableLayout(
          header: header.map { cellText($0, bold: true) },
          rows: rows.map { $0.map { cellText($0, bold: false) } },
          align: align)
        output.append(
          attachmentBlock(
            NoteViewAttachment(
              view: NoteTableView(layout: grid, border: theme.border),
              height: ceil(grid.size.height)),
            copyText: ([header] + rows)
              .map { $0.map { $0.map(\.text).joined() }.joined(separator: "\t") }
              .joined(separator: "\n"),
            spacingBefore: spacingBefore))
      case .rule:
        let paragraph = NSMutableParagraphStyle()
        paragraph.paragraphSpacingBefore = spacingBefore
        paragraph.minimumLineHeight = 1
        paragraph.maximumLineHeight = 1
        output.append(
          NSAttributedString(
            string: "\u{200B}",
            attributes: [
              .paragraphStyle: paragraph,
              .font: UIFont.systemFont(ofSize: 1),
              .noteDecoration: NoteDecoration(.rule, color: theme.border),
              .noteCopyText: "---",
            ]))
      }
    }
    return Result(text: output, codeBlocks: codeBlocks)
  }

  // MARK: Text

  private func textBlock(
    style: String, runs: [NoteRun], indent: Int?, marker: String?, spacingBefore: CGFloat
  ) -> NSAttributedString {
    let size: CGFloat
    let bold: Bool
    let lineHeight: CGFloat
    switch style {
    case "bigEmoji":
      size = NoteMetrics.bigEmojiSize
      bold = false
      lineHeight = ceil(size * 1.25)
    default:
      if let headingSize = NoteMetrics.headingSizes[style] {
        size = headingSize
        bold = true
        lineHeight = max(NoteMetrics.bodyLineHeight, ceil(headingSize * 1.25))
      } else {
        size = NoteMetrics.bodySize
        bold = false
        lineHeight = NoteMetrics.bodyLineHeight
      }
    }

    let paragraph = NSMutableParagraphStyle()
    paragraph.paragraphSpacingBefore = spacingBefore
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    var prefix = ""
    if let indent {
      let start = CGFloat(indent) * NoteMetrics.listIndent
      paragraph.firstLineHeadIndent = start
      if let marker {
        let contentStart = start + NoteMetrics.markerColumn + 6
        paragraph.headIndent = contentStart
        paragraph.tabStops = [NSTextTab(textAlignment: .left, location: contentStart)]
        prefix = "\(marker)\t"
      } else {
        paragraph.headIndent = start
      }
    }

    let isQuote = style == "quote"
    if isQuote {
      paragraph.firstLineHeadIndent = NoteMetrics.quoteIndent
      paragraph.headIndent = NoteMetrics.quoteIndent
    }

    let text = NSMutableAttributedString()
    let base = baseAttributes(size: size, bold: bold, lineHeight: lineHeight, paragraph: paragraph)
    if !prefix.isEmpty {
      text.append(NSAttributedString(string: prefix, attributes: base))
    }
    for run in runs {
      text.append(runText(run, size: size, bold: bold, lineHeight: lineHeight, paragraph: paragraph))
    }
    if text.length == 0 {
      text.append(NSAttributedString(string: "\u{200B}", attributes: base))
    }
    if isQuote {
      text.addAttribute(
        .noteDecoration, value: NoteDecoration(.quote, color: theme.border),
        range: NSRange(location: 0, length: text.length))
    }
    return text
  }

  private func baseAttributes(
    size: CGFloat, bold: Bool, lineHeight: CGFloat, paragraph: NSParagraphStyle
  ) -> [NSAttributedString.Key: Any] {
    let font = UIFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
    return [
      .font: font,
      .foregroundColor: theme.text,
      .paragraphStyle: paragraph,
      .kern: NoteMetrics.bodyKern,
      .baselineOffset: (lineHeight - font.lineHeight) / 2,
    ]
  }

  private func runText(
    _ run: NoteRun, size: CGFloat, bold: Bool, lineHeight: CGFloat, paragraph: NSParagraphStyle
  ) -> NSAttributedString {
    var attributes = baseAttributes(size: size, bold: bold, lineHeight: lineHeight, paragraph: paragraph)
    let font: UIFont
    if run.code == true {
      font = UIFont.monospacedSystemFont(ofSize: NoteMetrics.monoSize, weight: .regular)
      attributes[.backgroundColor] = theme.codeBackground
      attributes[.kern] = 0
    } else {
      var traits: UIFontDescriptor.SymbolicTraits = []
      if bold || run.bold == true { traits.insert(.traitBold) }
      if run.italic == true { traits.insert(.traitItalic) }
      let systemFont = UIFont.systemFont(ofSize: size)
      font = systemFont.fontDescriptor.withSymbolicTraits(traits).map {
        UIFont(descriptor: $0, size: size)
      } ?? systemFont
    }
    attributes[.font] = font
    attributes[.baselineOffset] = (lineHeight - font.lineHeight) / 2
    if run.strikethrough == true {
      attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
    }
    switch run.tint {
    case "mention":
      attributes[.foregroundColor] = theme.mention
      attributes[.backgroundColor] = theme.mentionBackground
    case "tertiary":
      attributes[.foregroundColor] = theme.tertiaryText
    default:
      break
    }
    if let color = run.color.flatMap(UIColor.init(hex:)) {
      attributes[.foregroundColor] = color
    }
    if let link = run.link, let url = URL(string: link) {
      attributes[.link] = url
      attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
    } else if let mention = run.mention,
      let encoded = mention.addingPercentEncoding(withAllowedCharacters: .urlHostAllowed),
      let url = URL(string: "tlon-mention://\(encoded)")
    {
      attributes[.link] = url
    }
    return NSAttributedString(string: run.text, attributes: attributes)
  }

  // MARK: Code

  private func codeBlock(runs: [NoteRun], spacingBefore: CGFloat) -> NSAttributedString {
    let font = UIFont.monospacedSystemFont(ofSize: NoteMetrics.monoSize, weight: .regular)
    let code = NSMutableAttributedString()
    for run in runs {
      var traits: UIFontDescriptor.SymbolicTraits = []
      if run.bold == true { traits.insert(.traitBold) }
      if run.italic == true { traits.insert(.traitItalic) }
      let runFont = font.fontDescriptor.withSymbolicTraits(traits).map {
        UIFont(descriptor: $0, size: NoteMetrics.monoSize)
      } ?? font
      code.append(
        NSAttributedString(
          string: run.text,
          attributes: [
            .font: runFont,
            .foregroundColor: run.color.flatMap(UIColor.init(hex:)) ?? theme.text,
          ]))
    }
    if code.length == 0 {
      code.append(NSAttributedString(string: "\u{200B}", attributes: [.font: font]))
    }
    // Spacing above the first line and below the last leaves room for the
    // background's padding.
    let lines = (code.string as NSString).components(separatedBy: "\n")
    let decoration = NoteDecoration(.code, color: theme.codeBackground)
    var location = 0
    for (index, line) in lines.enumerated() {
      let length = (line as NSString).length + (index < lines.count - 1 ? 1 : 0)
      let range = NSRange(location: location, length: length)
      let first = index == 0
      let last = index == lines.count - 1
      let paragraph = NSMutableParagraphStyle()
      paragraph.minimumLineHeight = NoteMetrics.monoLineHeight
      paragraph.maximumLineHeight = NoteMetrics.monoLineHeight
      paragraph.firstLineHeadIndent = NoteMetrics.codePadding
      paragraph.headIndent = NoteMetrics.codePadding
      paragraph.tailIndent = -NoteMetrics.codePadding
      paragraph.paragraphSpacingBefore = first ? spacingBefore + NoteMetrics.codePadding : 0
      paragraph.paragraphSpacing = last ? NoteMetrics.codePadding : 0
      code.addAttributes(
        [
          .paragraphStyle: paragraph,
          .baselineOffset: (NoteMetrics.monoLineHeight - font.lineHeight) / 2,
          .noteDecoration: decoration,
        ], range: range)
      location += length
    }
    return code
  }

  // MARK: Attachments

  private func attachmentBlock(
    _ attachment: NoteViewAttachment, copyText: String, spacingBefore: CGFloat
  ) -> NSAttributedString {
    // A line exactly the view's height, so the view covers the line.
    let paragraph = NSMutableParagraphStyle()
    paragraph.paragraphSpacingBefore = spacingBefore
    paragraph.minimumLineHeight = attachment.height
    paragraph.maximumLineHeight = attachment.height
    let text = NSMutableAttributedString(
      attributedString: NSAttributedString(attachment: attachment))
    text.addAttributes(
      [.paragraphStyle: paragraph, .noteCopyText: copyText],
      range: NSRange(location: 0, length: text.length))
    return text
  }

  private func cellText(_ runs: [NoteRun], bold: Bool) -> NSAttributedString {
    let paragraph = NSMutableParagraphStyle()
    let text = NSMutableAttributedString()
    for run in runs {
      text.append(
        runText(
          run, size: NoteMetrics.bodySize, bold: bold,
          lineHeight: NoteMetrics.bodyLineHeight, paragraph: paragraph))
    }
    return text
  }
}
