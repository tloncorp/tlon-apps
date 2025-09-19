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

    /**
     * Gets the PostHog API key from shared UserDefaults.
     * This key is set by the React Native layer and can be accessed by native iOS code.
     */
    class var postHogApiKey: String {
        return UserDefaults.forDefaultAppGroup.string(forKey: "postHogApiKey")
            // staging key as fallback
            ?? "phc_6BDPOnBfls3Axc5WAbmN8pQKk3YqhfWoc0tXj9d9kx0"
    }
}
