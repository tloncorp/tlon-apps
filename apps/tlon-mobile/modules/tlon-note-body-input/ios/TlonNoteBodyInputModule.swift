import ExpoModulesCore

public class TlonNoteBodyInputModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TlonNoteBodyInput")

    View(TlonNoteBodyInputView.self) {
      Events(
        "onBodyChange",
        "onBodySelectionChange",
        "onBodyFocus",
        "onBodyBlur",
        "onMenuItemPress",
        "onPasteImages"
      )

      Prop("value") { (view, value: NoteBodyValue) in
        view.apply(value)
      }

      Prop("placeholder") { (view, placeholder: String?) in
        view.placeholder = placeholder ?? ""
      }

      Prop("placeholderTextColor") { (view, color: UIColor?) in
        view.placeholderColor = color ?? .placeholderText
      }

      Prop("textColor") { (view, color: UIColor?) in
        view.textColor = color ?? .label
      }

      Prop("fontSize") { (view, size: Double) in
        view.fontSize = CGFloat(size)
      }

      Prop("lineHeight") { (view, lineHeight: Double) in
        view.lineHeight = CGFloat(lineHeight)
      }

      Prop("editable") { (view, editable: Bool) in
        view.textView.isEditable = editable
      }

      Prop("menuItems") { (view, items: [NoteBodyMenuItem]) in
        view.menuItems = items
      }

      Prop("acceptsImagePaste") { (view, accepts: Bool) in
        view.textView.acceptsImagePaste = accepts
      }

      AsyncFunction("focus") { (view: TlonNoteBodyInputView) in
        view.textView.becomeFirstResponder()
      }.runOnQueue(.main)
    }
  }
}

struct NoteBodyValue: Record {
  @Field var text: String = ""
  // The count of native edits this value accounts for. A value rendered
  // before JS saw the latest edit is stale and must not overwrite it.
  @Field var eventCount: Int = 0
  @Field var selectionStart: Int? = nil
  @Field var selectionEnd: Int? = nil
  @Field var selectionRequestId: Int = 0
}

struct NoteBodyMenuItem: Record {
  @Field var id: String = ""
  @Field var title: String = ""
}
