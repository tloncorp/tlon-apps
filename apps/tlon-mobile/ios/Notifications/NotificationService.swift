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
        case let .yarn(yarn, activityEvent):
          var notifContent = await handle(yarn)
          if let activityEvent {
            if let dm = activityEvent.dmPost {
              let mutableNotifContent = notifContent.mutableCopy() as! UNMutableNotificationContent
              // convert to JSON because `userInfo` needs NSSecureCoding
              mutableNotifContent.userInfo["dmPost"] = try! dm.asJson() 
              notifContent = mutableNotifContent
            } else if let post = activityEvent.post {
              let mutableNotifContent = notifContent.mutableCopy() as! UNMutableNotificationContent
              // convert to JSON because `userInfo` needs NSSecureCoding
              mutableNotifContent.userInfo["post"] = try! post.asJson()
              notifContent = mutableNotifContent
            }
          }
          contentHandler(notifContent)
          return
          
        case let .failedFetchContents(err):
          packErrorOnNotification(err)
          contentHandler(bestAttemptContent!)
          return
          
        case .invalid:
          fallthrough
          
        case .dismiss:
          contentHandler(bestAttemptContent!)
          return
        }
      }
    }

    /** Appends an error onto the `bestAttemptContent` payload; does *not* attempt to complete the notification request. */
    func packErrorOnNotification(_ error: Error) {
        guard let bestAttemptContent else { return }
        var errorList = (bestAttemptContent.userInfo["notificationServiceExtensionErrors"] as? [String]) ?? [String]()
        errorList.append(error.localizedDescription)
        bestAttemptContent.userInfo["notificationServiceExtensionErrors"] = errorList
    }

    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
  
  private func handle(_ renderable: UNNotificationRenderable) async -> UNNotificationContent {
    let (mutatedContent, messageIntent) = await renderable.render(
      to: bestAttemptContent ?? UNMutableNotificationContent()
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
    
    return mutatedContent
  }
}

extension Error {
    // This method logs to Crashlytics in the host app; Crashlytics is not set up for the
    // notification service extension.
    func logWithDomain(_ domain: String) {
        print(domain, self)
    }
}

extension Encodable {
  func asJson() throws -> Any {
    let data = try JSONEncoder().encode(self)
    return try JSONSerialization.jsonObject(with: data, options: [])
  }
}
