import UIKit

// Mirrors NoteDocumentBlock and NoteDocumentRun in noteDocument.ts.

struct NoteRun: Decodable {
  let text: String
  var bold: Bool?
  var italic: Bool?
  var strikethrough: Bool?
  var code: Bool?
  var link: String?
  var mention: String?
  var color: String?
  var tint: String?
}

enum NoteBlock: Decodable {
  case text(style: String, runs: [NoteRun], indent: Int?, marker: String?, listStart: Bool)
  case code(runs: [NoteRun])
  case image(src: String, width: Double, height: Double, alt: String)
  case video(src: String, posterUri: String?, width: Double?, height: Double?)
  case table(header: [[NoteRun]], rows: [[[NoteRun]]], align: [String?])
  case rule

  private enum CodingKeys: String, CodingKey {
    case type, style, runs, indent, marker, listStart, src, width, height, alt, posterUri
    case header, rows, align
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    switch try c.decode(String.self, forKey: .type) {
    case "text":
      self = .text(
        style: try c.decode(String.self, forKey: .style),
        runs: try c.decode([NoteRun].self, forKey: .runs),
        indent: try c.decodeIfPresent(Int.self, forKey: .indent),
        marker: try c.decodeIfPresent(String.self, forKey: .marker),
        listStart: try c.decodeIfPresent(Bool.self, forKey: .listStart) ?? false
      )
    case "code":
      self = .code(runs: try c.decode([NoteRun].self, forKey: .runs))
    case "image":
      self = .image(
        src: try c.decode(String.self, forKey: .src),
        width: try c.decodeIfPresent(Double.self, forKey: .width) ?? 0,
        height: try c.decodeIfPresent(Double.self, forKey: .height) ?? 0,
        alt: try c.decodeIfPresent(String.self, forKey: .alt) ?? ""
      )
    case "video":
      self = .video(
        src: try c.decode(String.self, forKey: .src),
        posterUri: try c.decodeIfPresent(String.self, forKey: .posterUri),
        width: try c.decodeIfPresent(Double.self, forKey: .width),
        height: try c.decodeIfPresent(Double.self, forKey: .height)
      )
    case "table":
      self = .table(
        header: try c.decode([[NoteRun]].self, forKey: .header),
        rows: try c.decode([[[NoteRun]]].self, forKey: .rows),
        align: try c.decode([String?].self, forKey: .align)
      )
    default:
      self = .rule
    }
  }
}

struct NoteTheme {
  var text: UIColor = .label
  var tertiaryText: UIColor = .tertiaryLabel
  var mention: UIColor = .systemGreen
  var mentionBackground: UIColor = .systemGreen.withAlphaComponent(0.12)
  var codeBackground: UIColor = .secondarySystemBackground
  var border: UIColor = .separator

  init() {}

  // Values are React Native processColor numbers: 0xAARRGGBB.
  init(json: String) {
    guard
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }
    func color(_ key: String) -> UIColor? {
      guard let value = (object[key] as? NSNumber)?.uint32Value else { return nil }
      return UIColor(
        red: CGFloat((value >> 16) & 0xFF) / 255,
        green: CGFloat((value >> 8) & 0xFF) / 255,
        blue: CGFloat(value & 0xFF) / 255,
        alpha: CGFloat((value >> 24) & 0xFF) / 255
      )
    }
    text = color("text") ?? text
    tertiaryText = color("tertiaryText") ?? tertiaryText
    mention = color("mention") ?? mention
    mentionBackground = color("mentionBackground") ?? mentionBackground
    codeBackground = color("codeBackground") ?? codeBackground
    border = color("border") ?? border
  }
}

extension UIColor {
  // "#rgb" or "#rrggbb", as the code highlighter emits.
  convenience init?(hex: String) {
    var digits = hex.trimmingCharacters(in: .whitespaces)
    guard digits.hasPrefix("#") else { return nil }
    digits.removeFirst()
    if digits.count == 3 {
      digits = digits.map { "\($0)\($0)" }.joined()
    }
    guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
    self.init(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1
    )
  }
}
