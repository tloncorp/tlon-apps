import Intents
import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        Task { [weak bestAttemptContent] in
            let parsedNotification = await PushNotificationManager.parseNotificationUserInfo(request.content.userInfo)
            switch parsedNotification {
            case let .notify(yarn):
                let (mutatedContent, messageIntent) = await PushNotificationManager.buildNotificationWithIntent(
                    yarn: yarn,
                    content: bestAttemptContent ?? UNMutableNotificationContent()
                )

                if let messageIntent {
                    do {
                        let interaction = INInteraction(intent: messageIntent, response: nil)
                        interaction.direction = .incoming
                        try await interaction.donate()
                    } catch {
                        print("Error donating interaction for notification sender details: \(error)")
                    }
                }

                contentHandler(mutatedContent)
                return

            default:
                contentHandler(bestAttemptContent!)
                return
            }
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}

extension Error {
    // This method logs to Crashlytics in the host app; Crashlytics is not set up for the
    // notification service extension.
    func logWithDomain(_ domain: String) {
        print(domain, self)
    }
}
