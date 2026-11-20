import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

final class TlonNoteBodyInputView: ExpoView, UITextViewDelegate {
  let onBodyChange = EventDispatcher()
  let onBodySelectionChange = EventDispatcher()
  let onBodyFocus = EventDispatcher()
  let onBodyBlur = EventDispatcher()
  let onMenuItemPress = EventDispatcher()
  let onPasteImages = EventDispatcher()

  let textView = NoteBodyTextView()
  private let placeholderLabel = UILabel()

  private var eventCount = 0
  private var lastSelectionRequestId = 0

  var menuItems: [NoteBodyMenuItem] = []
  var placeholder = "" {
    didSet { updatePlaceholder() }
  }
  var placeholderColor: UIColor = .placeholderText {
    didSet { updatePlaceholder() }
  }
  var textColor: UIColor = .label {
    didSet { updateTextAttributes() }
  }
  var fontSize: CGFloat = 14 {
    didSet { updateTextAttributes() }
  }
  var lineHeight: CGFloat = 0 {
    didSet { updateTextAttributes() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    textView.delegate = self
    textView.backgroundColor = .clear
    // The notes screen's scroll view scrolls the body; the input grows instead.
    textView.isScrollEnabled = false
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    textView.onPasteImages = { [weak self] files, failedCount in
      self?.onPasteImages(["files": files, "failedCount": failedCount])
    }
    placeholderLabel.numberOfLines = 0
    placeholderLabel.isUserInteractionEnabled = false
    addSubview(textView)
    addSubview(placeholderLabel)
    updateTextAttributes()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    let size = placeholderLabel.sizeThatFits(
      CGSize(width: bounds.width, height: .greatestFiniteMagnitude)
    )
    placeholderLabel.frame = CGRect(x: 0, y: 0, width: bounds.width, height: size.height)
  }

  func apply(_ value: NoteBodyValue) {
    guard value.eventCount >= eventCount else { return }
    // Replacing the text mid-composition would cancel the IME's marked text.
    if textView.markedTextRange == nil, value.text != textView.text {
      let selection = textView.selectedRange
      setText(value.text)
      textView.selectedRange = clamped(selection)
    }
    if value.selectionRequestId != lastSelectionRequestId, let start = value.selectionStart {
      lastSelectionRequestId = value.selectionRequestId
      let end = max(start, value.selectionEnd ?? start)
      textView.selectedRange = clamped(NSRange(location: start, length: end - start))
    }
  }

  // MARK: - UITextViewDelegate

  func textViewDidChange(_ textView: UITextView) {
    eventCount += 1
    if textView.text.isEmpty {
      // UIKit drops the typing attributes once the last character goes.
      textView.typingAttributes = textAttributes
    }
    updatePlaceholder()
    onBodyChange(["text": textView.text ?? "", "eventCount": eventCount])
  }

  func textViewDidChangeSelection(_ textView: UITextView) {
    let range = textView.selectedRange
    onBodySelectionChange(["start": range.location, "end": range.location + range.length])
  }

  func textViewDidBeginEditing(_ textView: UITextView) {
    onBodyFocus([:])
  }

  func textViewDidEndEditing(_ textView: UITextView) {
    onBodyBlur([:])
  }

  func textView(
    _ textView: UITextView,
    editMenuForTextIn range: NSRange,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    guard !menuItems.isEmpty, textView.isEditable else { return nil }
    let actions = menuItems.map { item in
      UIAction(title: item.title) { [weak self] _ in
        self?.onMenuItemPress(["id": item.id])
      }
    }
    // First, so the compact menu shows them without its overflow page.
    return UIMenu(children: actions + suggestedActions)
  }

  // MARK: - Text attributes

  private var font: UIFont {
    UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
  }

  // Matches how React Native lays out a TextInput with a lineHeight, so the
  // notes screen's height estimate for the body still fits.
  private var textAttributes: [NSAttributedString.Key: Any] {
    let font = self.font
    let paragraph = NSMutableParagraphStyle()
    var attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: textColor,
    ]
    if lineHeight > 0 {
      paragraph.minimumLineHeight = lineHeight
      paragraph.maximumLineHeight = lineHeight
      attributes[.baselineOffset] = (lineHeight - font.lineHeight) / 2
    }
    attributes[.paragraphStyle] = paragraph
    return attributes
  }

  private func setText(_ text: String) {
    textView.attributedText = NSAttributedString(string: text, attributes: textAttributes)
    textView.typingAttributes = textAttributes
    updatePlaceholder()
  }

  private func updateTextAttributes() {
    let selection = textView.selectedRange
    setText(textView.text ?? "")
    textView.selectedRange = clamped(selection)
  }

  private func updatePlaceholder() {
    var attributes = textAttributes
    attributes[.foregroundColor] = placeholderColor
    placeholderLabel.attributedText = NSAttributedString(string: placeholder, attributes: attributes)
    placeholderLabel.isHidden = !textView.text.isEmpty
    setNeedsLayout()
  }

  private func clamped(_ range: NSRange) -> NSRange {
    let length = (textView.text as NSString).length
    let location = min(range.location, length)
    return NSRange(location: location, length: min(range.length, length - location))
  }
}

final class NoteBodyTextView: UITextView {
  var acceptsImagePaste = false
  var onPasteImages: (([[String: Any]], Int) -> Void)?

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    if action == #selector(paste(_:)), canPasteImages {
      return true
    }
    return super.canPerformAction(action, withSender: sender)
  }

  override func paste(_ sender: Any?) {
    // Text wins when the pasteboard also has some, as it does on web. A URL
    // doesn't count: Safari copies an image together with its address.
    let pasteboard = UIPasteboard.general
    guard canPasteImages, !pasteboard.hasStrings || pasteboard.hasURLs else {
      super.paste(sender)
      return
    }
    let providers = UIPasteboard.general.itemProviders.filter {
      $0.hasItemConformingToTypeIdentifier(UTType.image.identifier)
    }
    copyImages(from: providers)
  }

  private var canPasteImages: Bool {
    acceptsImagePaste && isEditable && UIPasteboard.general.hasImages
  }

  // The pasteboard hands files out only for the length of the load callback,
  // so each one is copied into the caches directory before it is reported.
  private func copyImages(from providers: [NSItemProvider]) {
    let group = DispatchGroup()
    let results = PastedImageResults(count: providers.count)
    for (index, provider) in providers.enumerated() {
      guard
        let typeIdentifier = provider.registeredTypeIdentifiers.first(where: {
          UTType($0)?.conforms(to: .image) == true
        }),
        let type = UTType(typeIdentifier)
      else { continue }
      group.enter()
      provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, _ in
        defer { group.leave() }
        guard let url, let file = Self.copyToCaches(url, type: type) else { return }
        results.set(file, at: index)
      }
    }
    group.notify(queue: .main) { [weak self] in
      let copied = results.copied
      self?.onPasteImages?(copied, providers.count - copied.count)
    }
  }

  private static func copyToCaches(_ url: URL, type: UTType) -> [String: Any]? {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("note-paste", isDirectory: true)
    let fileName = "\(UUID().uuidString).\(type.preferredFilenameExtension ?? url.pathExtension)"
    let destination = directory.appendingPathComponent(fileName)
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try FileManager.default.copyItem(at: url, to: destination)
      let size = try FileManager.default.attributesOfItem(atPath: destination.path)[.size]
      return [
        "uri": destination.absoluteString,
        "type": type.preferredMIMEType ?? "image/\(type.preferredFilenameExtension ?? "png")",
        "fileName": fileName,
        "fileSize": (size as? NSNumber)?.doubleValue ?? -1,
      ]
    } catch {
      return nil
    }
  }
}

// Item provider callbacks arrive on arbitrary queues; this keeps the results
// in paste order behind a lock.
private final class PastedImageResults: @unchecked Sendable {
  private let lock = NSLock()
  private var files: [[String: Any]?]

  init(count: Int) {
    files = Array(repeating: nil, count: count)
  }

  func set(_ file: [String: Any], at index: Int) {
    lock.lock()
    files[index] = file
    lock.unlock()
  }

  var copied: [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    return files.compactMap { $0 }
  }
}
