import Foundation
import UserNotifications
import JavaScriptCore

@objc class NotificationDismissHandler: NSObject {

    @objc static let shared = NotificationDismissHandler()
    
    private let userDefaults = UserDefaults.forDefaultAppGroup

    private override init() {
        super.init()
    }

    @objc func handleNotificationDismiss(userInfo: [AnyHashable: Any]) {
        print("[dismisser] handleNotificationDismiss called with userInfo: \(userInfo)")
        
        guard let action = userInfo["action"] as? String else {
            print("[dismisser] No action field found")
            return
        }
        
        print("[dismisser] Action: \(action)")
        
        guard action == "dismiss" else {
            print("[dismisser] Action is not dismiss, ignoring")
            return
        }
        
        guard let source = userInfo["dismissSource"] as? String,
              let notifyCount = userInfo["notifyCount"] as? String,
              let uid = userInfo["uid"] as? String,
              let id = userInfo["id"] as? String else {
            print("[dismisser] Missing required fields. dismissSource: \(userInfo["dismissSource"] ?? "nil"), notifyCount: \(userInfo["notifyCount"] ?? "nil"), uid: \(userInfo["uid"] ?? "nil"), id: \(userInfo["id"] ?? "nil")")
            return
        }
        
        let count = Int(notifyCount) ?? 0
        
        print("[dismisser] Dismissing notifications \(source) new count \(count) id \(id)")
        
        // let latestNotif = userDefaults.string(forKey: "latest-notification") ?? "0v0"
        // let latestBadge = userDefaults.integer(forKey: "latest-badge-count")
        // if latestNotif > uid {
        //     count = latestBadge
        // } else {
        //     userDefaults.set(uid, forKey: "latest-notification")
        //     userDefaults.set(count, forKey: "latest-badge-count")
        // }
        
         Task {
             await updateBadgeCountIfNeeded(newCount: count, uid: uid)
             await dismissPushNotifications(forId: id, source: source)
         }
    }

    @MainActor
    private func dismissPushNotifications(forId dismissId: String, source: String) async {
        let center = UNUserNotificationCenter.current()

        // Get delivered notifications and dismiss older ones
        let notifications = await center.deliveredNotifications()
        var identifiersToDismiss: [String] = []

        for notification in notifications {
            let threadIdentifier = notification.request.content.threadIdentifier
            guard let notificationId = notification.request.content.userInfo["id"] as? String else {
                continue
            }

            if threadIdentifier == source {
                // Dismiss notifications with IDs that are less than the dismiss ID (older messages)
                let comparison = notificationId.compare(dismissId)
                if comparison == .orderedAscending || comparison == .orderedSame {
                    identifiersToDismiss.append(notification.request.identifier)
                }
            }
        }

        if !identifiersToDismiss.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: identifiersToDismiss)
            print("[dismisser] Dismissed \(identifiersToDismiss.count) notifications for grouping: \(source)")
        }
    }

    @MainActor
    func updateBadgeCountIfNeeded(newCount: Int, uid: String) async {
        let center = UNUserNotificationCenter.current()
        let latestNotif = userDefaults.string(forKey: "latest-notification") ?? "0v0"
        
        print("bl: comparing \(uid) to \(latestNotif)")

        if (uid > latestNotif) {
            do {
                try await center.setBadgeCount(newCount)
                userDefaults.set(uid, forKey: "latest-notification")
                userDefaults.set(newCount, forKey: "latest-badge-count")
            } catch {
                print("[dismisser] Failed to set badge count: \(error)")
                await NotificationLogger.logError(.badgeSettingFailed(uid: uid, underlyingError: error))
            }
        }
    }
}
