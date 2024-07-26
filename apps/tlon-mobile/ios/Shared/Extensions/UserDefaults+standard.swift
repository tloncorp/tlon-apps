import Foundation

extension UserDefaults {
    /**
     * Accesses app group's shared user defaults. Almost all user defaults should go here.
     */
    class var appGroup: UserDefaults {
        UserDefaults(suiteName: "group.io.tlon.groups")!
    }
}
