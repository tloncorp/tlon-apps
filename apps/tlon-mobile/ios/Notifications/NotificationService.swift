import Intents
import UserNotifications
import JavaScriptCore

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
  
    private func applyNotif(_ rawActivityEvent: Any, notification: UNMutableNotificationContent) async -> UNNotificationContent {
        let context = JSContext()!
        context.exceptionHandler = { context, exception in
            NSLog(exception?.toString() ?? "No exception found")
        }
        
        guard
            let scriptURL = Bundle.main.url(forResource: "bundle", withExtension: "js"),
            let script = try? String(contentsOf: scriptURL)
        else {
            return notification
        }
        context.evaluateScript(script)
        
        let previewRaw = context.objectForKeyedSubscript("tlon")
            .invokeMethod("renderActivityEventPreview", withArguments: [
                rawActivityEvent,
            ])
        
        guard let preview = try? previewRaw?.decode(as: NotificationPreviewPayload.self) else {
            return notification
        }
        
        let renderer = NotificationPreviewContentNodeRenderer()
        notification.title = renderer.render(preview.notification.title)
        notification.body = renderer.render(preview.notification.body)
        notification.interruptionLevel = .active
        notification.threadIdentifier = renderer.render(preview.notification.groupingKey)
        notification.sound = UNNotificationSound.default
        
        guard let message = preview.message else {
            return notification
        }
        
        let sender = await INPerson.from(shipName: message.senderId, withImage: true)
        let intent = INSendMessageIntent(
            // Create empty recipient for groups because we don't need the OS creating the participant list
            recipients: [INPerson.empty],
            outgoingMessageType: .outgoingMessageText,
            content: notification.body,
            speakableGroupName: INSpeakableString(spokenPhrase: notification.title),
            conversationIdentifier: renderer.render(preview.notification.groupingKey),
            serviceName: nil,
            sender: sender,
            attachments: nil
        )
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        try? await interaction.donate() // any error here is discarded
        
        return (try? notification.updating(from: intent)) ?? notification
    }

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

      Task { [weak bestAttemptContent] in
        let parsedNotification = await PushNotificationManager.parseNotificationUserInfo(request.content.userInfo)
        switch parsedNotification {
        case let .yarn(yarn, activityEvent, activityEventRaw):
            var notifContent = bestAttemptContent ?? UNNotificationContent()

          // HACK: Proof-of-concept that we can use JS to populate notification content
          if let activityEventRaw {
            notifContent = await applyNotif(
                activityEventRaw,
                notification: notifContent.mutableCopy() as! UNMutableNotificationContent
            )
          }
          
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

private struct RenderNotificationPreviewResult: Codable {
    let title: String?
    let body: String?
    
    // TODO
//    let userInfo: [String: Any]?
}

extension JSValue {
    func decode<T: Decodable>(as type: T.Type) throws -> T {
        // Convert JSValue to a Foundation object (e.g. [String: Any])
        guard let object = self.toObject(),
              JSONSerialization.isValidJSONObject(object) else {
            throw NSError(domain: "JSValueError", code: 1, userInfo: [NSLocalizedDescriptionKey: "JSValue is not a valid JSON object"])
        }
        
        // Serialize to JSON Data
        let jsonData = try JSONSerialization.data(withJSONObject: object, options: [])
        
        // Decode using JSONDecoder
        return try JSONDecoder().decode(T.self, from: jsonData)
    }
}
