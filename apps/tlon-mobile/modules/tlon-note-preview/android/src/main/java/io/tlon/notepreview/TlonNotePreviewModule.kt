package io.tlon.notepreview

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TlonNotePreviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TlonNotePreview")

    View(TlonNotePreviewView::class) {
      Events(
        "onContentHeight",
        "onPressLink",
        "onPressMention",
        "onPressImage",
        "onPressVideo"
      )

      Prop("documentJson") { view: TlonNotePreviewView, json: String ->
        view.setDocument(json)
      }

      Prop("themeJson") { view: TlonNotePreviewView, json: String ->
        view.setTheme(json)
      }
    }
  }
}
