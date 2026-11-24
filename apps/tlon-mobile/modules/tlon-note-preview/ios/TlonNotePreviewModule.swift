import ExpoModulesCore

public class TlonNotePreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TlonNotePreview")

    View(TlonNotePreviewView.self) {
      Events(
        "onContentHeight", "onPressLink", "onPressMention", "onPressImage", "onPressVideo")

      Prop("documentJson") { (view, json: String) in
        view.documentJson = json
      }

      Prop("themeJson") { (view, json: String) in
        view.themeJson = json
      }
    }
  }
}
