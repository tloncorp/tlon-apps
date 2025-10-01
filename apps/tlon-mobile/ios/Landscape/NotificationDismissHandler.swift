import Foundation
import UserNotifications
import JavaScriptCore

@objc class NotificationDismissHandler: NSObject {

    @objc static let shared = NotificationDismissHandler()

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
              let count = userInfo["notifyCount"] as? Int,
              let uid = userInfo["uid"] as? String,
              let id = userInfo["id"] as? String else {
            print("[dismisser] Missing required fields. dismissSource: \(userInfo["dismissSource"] ?? "nil"), notifyCount: \(userInfo["notifyCount"] ?? "nil"), uid: \(userInfo["uid"] ?? "nil"), id: \(userInfo["id"] ?? "nil")")
            return
        }

        print("[dismisser] Dismissing notifications \(source) new count \(count) id \(id)")
        // Fetch the activity event to get grouping information
        Task {
            await dismissNotifications(forId: id, source: source, notifyCount: count, uid: uid)
        }
    }

    @MainActor
    private func dismissNotifications(forId dismissId: String, source: String, notifyCount: Int, uid: String) async {
        let center = UNUserNotificationCenter.current()

        // Set badge count
        do {
            try await center.setBadgeCount(notifyCount)
        } catch {
            print("[dismisser] Failed to set badge count: \(error)")
        }

        // Get delivered notifications and dismiss older ones
        let notifications = await center.deliveredNotifications()
        var identifiersToDismiss: [String] = []

        for notification in notifications {
            let threadIdentifier = notification.request.content.threadIdentifier
            guard let notificationId = notification.request.content.userInfo["id"] as? String else {
                continue
            }
            
            print("[dismisser] notification: grouping \(threadIdentifier) id \(notificationId)")

            if threadIdentifier == source {
                // Dismiss notifications with IDs that are less than the dismiss ID (older messages)
                let comparison = notificationId.compare(dismissId)
                print ("[dismisser] comparing ids \(dismissId) and \(notificationId) result: \(comparison)")
                if comparison == .orderedAscending || comparison == .orderedSame {
                    identifiersToDismiss.append(notification.request.identifier)
                }
            }
        }

        print("[dismisser] ids to dismiss \(identifiersToDismiss)")
        if !identifiersToDismiss.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: identifiersToDismiss)
            print("[dismisser] Dismissed \(identifiersToDismiss.count) notifications for grouping: \(source)")
        }
    }
}
