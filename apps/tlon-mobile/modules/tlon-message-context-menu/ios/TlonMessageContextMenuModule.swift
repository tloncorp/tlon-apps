import ExpoModulesCore

public class TlonMessageContextMenuModule: Module {
    public func definition() -> ModuleDefinition {
        Name("TlonMessageContextMenu")

        View(TlonMessageContextMenuView.self) {
            Events("onSelect")

            Prop("actions") { (view, actions: [TlonMessageMenuAction]) in
                view.actions = actions
            }

            Prop("reactions") { (view, reactions: [TlonMessageMenuReaction]) in
                view.reactions = reactions
            }

            Prop("moreReactionsToken") { (view, token: String?) in
                view.moreReactionsToken = token
            }

            Prop("presentationKey") { (view, key: String) in
                view.presentationKey = key
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

struct TlonMessageMenuAction: Record {
    @Field var id: String = ""
    @Field var title: String = ""
    @Field var systemImage: String? = nil
    @Field var destructive: Bool = false
    @Field var token: String = ""
}

struct TlonMessageMenuReaction: Record {
    @Field var value: String = ""
    @Field var selected: Bool = false
    @Field var token: String = ""
}

enum TlonMessageMenuAlignment {
    case leading
    case trailing
}

enum TlonMessageMenuSelection {
    case action(id: String, token: String)
    case reaction(value: String, token: String)
    case moreReactions(token: String)

    var eventPayload: [String: String] {
        switch self {
        case let .action(id, token):
            ["kind": "action", "value": id, "token": token]
        case let .reaction(value, token):
            ["kind": "reaction", "value": value, "token": token]
        case let .moreReactions(token):
            ["kind": "moreReactions", "value": "", "token": token]
        }
    }
}
