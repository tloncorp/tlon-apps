import Foundation
import UserNotifications

@objc class LanyardMatchPushHandler: NSObject {

    @objc static let shared = LanyardMatchPushHandler()

    private let userDefaults = UserDefaults.forDefaultAppGroup
    private let hashKey = "lanyard-last-match-hash"
    private let countKey = "lanyard-last-match-count"

    private override init() {
        super.init()
    }

    @objc func handleLanyardMatchPush(userInfo: [AnyHashable: Any]) {
        guard let pushHash = userInfo["matchHash"] as? String else {
            print("[lanyard-match] missing matchHash in push payload")
            return
        }

        // The count may arrive as a number or a string depending on
        // how the notify provider serializes the activity payload.
        let pushCount: Int
        if let n = userInfo["matchCount"] as? Int {
            pushCount = n
        } else if let s = userInfo["matchCount"] as? String, let n = Int(s) {
            pushCount = n
        } else {
            print("[lanyard-match] missing or unparseable matchCount in push payload")
            return
        }

        let storedHash = userDefaults.string(forKey: hashKey) ?? ""
        let storedCount = userDefaults.integer(forKey: countKey)

        // Always update the stored state so subsequent pushes compare
        // against the latest server-side digest, even when this push
        // doesn't itself produce a notification.
        userDefaults.set(pushHash, forKey: hashKey)
        userDefaults.set(pushCount, forKey: countKey)

        // Only notify when the digest has actually moved AND the count
        // hasn't decreased. A pure removal (count went down) shouldn't
        // surface as "you have new contacts on Tlon".
        guard pushHash != storedHash, pushCount >= storedCount else {
            print("[lanyard-match] digest unchanged or count decreased — suppressing")
            return
        }

        // First-install gate: if the device has never recorded a count
        // before, don't fire — it'd flood with the entire match book
        // on first sync. The next push (after a real change) will fire
        // normally because the stored count is now non-zero.
        if storedCount == 0 {
            print("[lanyard-match] first-seen state — suppressing initial flood")
            return
        }

        Task { await scheduleLocalNotification() }
    }

    @MainActor
    private func scheduleLocalNotification() async {
        let content = UNMutableNotificationContent()
        content.title = "New contacts on Tlon"
        content.body = "Tap to see who"
        content.sound = .default
        content.userInfo = ["type": "contactsMatched"]

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
        } catch {
            print("[lanyard-match] failed to schedule notification: \(error)")
        }
    }
}
