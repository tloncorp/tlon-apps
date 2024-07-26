import Foundation

extension UserDefaults {
    /**
     * Accesses app group's shared user defaults. Almost all user defaults should go here.
     */
    class var appGroup: UserDefaults {
        if let suiteName = Bundle.main.object(forInfoDictionaryKey: "TlonDefaultUserDefaultsSuiteName") as? String {
            return UserDefaults(suiteName: suiteName)!
        } else {
            return UserDefaults.standard
        }
    }
}
