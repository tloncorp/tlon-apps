import Foundation

extension UserDefaults {
    /**
     * Accesses app group's shared user defaults. Almost all user defaults should go here.
     */
    class var forDefaultAppGroup: UserDefaults {
        if let suiteName = Bundle.main.object(forInfoDictionaryKey: "TlonDefaultAppGroup") as? String {
            return UserDefaults(suiteName: suiteName)!
        } else {
            return UserDefaults.standard
        }
    }
}
