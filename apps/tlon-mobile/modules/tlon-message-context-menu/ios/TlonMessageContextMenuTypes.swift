import ExpoModulesCore

struct TlonMessageMenuAction: Record {
    @Field var id: String = ""
    @Field var title: String = ""
    @Field var systemImage: String? = nil
    @Field var destructive: Bool = false
}

enum TlonMessageMenuAlignment {
    case leading
    case trailing
}

enum TlonMessageMenuSelection {
    case action(String)
    case reaction(String)
    case moreReactions
}
