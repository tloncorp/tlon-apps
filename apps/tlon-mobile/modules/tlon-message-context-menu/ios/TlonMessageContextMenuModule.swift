import ExpoModulesCore

public class TlonMessageContextMenuModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonMessageContextMenu")

        View(TlonMessageContextMenuView.self) {
            Events(
                "onAction",
                "onReaction",
                "onMoreReactions"
            )

            Prop("actions") { (view, actions: [TlonMessageMenuAction]) in
                view.actions = actions
            }

            Prop("reactions") { (view, reactions: [String]) in
                view.reactions = reactions
            }

            Prop("selectedReaction") { (view, selectedReaction: String?) in
                view.selectedReaction = selectedReaction
            }

            Prop("contentKey") { (view, contentKey: String) in
                view.contentKey = contentKey
            }

            Prop("alignment") { (view, alignment: String?) in
                view.alignment = alignment == "trailing" ? .trailing : .leading
            }

            Prop("previewBackgroundColor") { (view, color: UIColor?) in
                view.previewBackgroundColor = color ?? .secondarySystemBackground
            }
        }
    }
}
