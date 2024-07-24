import Foundation

extension UserDefaults {
    /**
     * Override: Accesses app group's shared user defaults. Almost all user defaults should go here.
     */
    static var standard: UserDefaults {
        UserDefaults(suiteName: "group.io.tlon.groups")!
    }
}
