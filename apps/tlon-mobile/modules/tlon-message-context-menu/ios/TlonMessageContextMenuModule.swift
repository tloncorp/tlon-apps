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

            Prop("menuBackgroundColor") { (view, color: UIColor?) in
                view.menuColors.background = color ?? .secondarySystemBackground
            }

            Prop("menuForegroundColor") { (view, color: UIColor?) in
                view.menuColors.foreground = color ?? .label
            }

            Prop("menuDestructiveColor") { (view, color: UIColor?) in
                view.menuColors.destructive = color ?? .systemRed
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

struct TlonMessageMenuColors {
    var background: UIColor = .secondarySystemBackground
    var foreground: UIColor = .label
    var destructive: UIColor = .systemRed

    // Derived from the foreground so they stay visible on any theme's surface.
    var separator: UIColor { foreground.withAlphaComponent(0.14) }
    var highlight: UIColor { foreground.withAlphaComponent(0.12) }
    var selection: UIColor { foreground.withAlphaComponent(0.14) }
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
