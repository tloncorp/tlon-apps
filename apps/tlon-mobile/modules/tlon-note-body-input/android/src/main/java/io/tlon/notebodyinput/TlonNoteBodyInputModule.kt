package io.tlon.notebodyinput

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class TlonNoteBodyInputModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TlonNoteBodyInput")

    View(TlonNoteBodyInputView::class) {
      Events(
        "onBodyChange",
        "onBodySelectionChange",
        "onBodyFocus",
        "onBodyBlur",
        "onMenuItemPress",
        "onPasteImages"
      )

      Prop("value") { view: TlonNoteBodyInputView, value: NoteBodyValue ->
        view.apply(value)
      }

      Prop("placeholder") { view: TlonNoteBodyInputView, placeholder: String? ->
        view.editText.hint = placeholder
      }

      Prop("placeholderTextColor") { view: TlonNoteBodyInputView, color: Int? ->
        color?.let { view.editText.setHintTextColor(it) }
      }

      Prop("textColor") { view: TlonNoteBodyInputView, color: Int? ->
        color?.let { view.editText.setTextColor(it) }
      }

      Prop("fontSize") { view: TlonNoteBodyInputView, size: Double ->
        view.setFontSize(size.toFloat())
      }

      Prop("lineHeight") { view: TlonNoteBodyInputView, lineHeight: Double ->
        view.setLineHeight(lineHeight.toFloat())
      }

      Prop("editable") { view: TlonNoteBodyInputView, editable: Boolean ->
        view.setEditable(editable)
      }

      Prop("menuItems") { view: TlonNoteBodyInputView, items: List<NoteBodyMenuItem> ->
        view.menuItems = items
      }

      Prop("acceptsImagePaste") { view: TlonNoteBodyInputView, accepts: Boolean ->
        view.acceptsImagePaste = accepts
      }

      AsyncFunction("focus") { view: TlonNoteBodyInputView ->
        view.focusInput()
      }.runOnQueue(Queues.MAIN)
    }
  }
}

class NoteBodyValue : Record {
  @Field var text: String = ""

  // The count of native edits this value accounts for. A value rendered
  // before JS saw the latest edit is stale and must not overwrite it.
  @Field var eventCount: Int = 0
  @Field var selectionStart: Int? = null
  @Field var selectionEnd: Int? = null
  @Field var selectionRequestId: Int = 0
}

class NoteBodyMenuItem : Record {
  @Field var id: String = ""
  @Field var title: String = ""
}
