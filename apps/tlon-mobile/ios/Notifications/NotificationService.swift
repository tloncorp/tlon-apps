import Intents
import UserNotifications
import JavaScriptCore

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    private func applyNotif(_ rawActivityEvent: Any, notification: UNMutableNotificationContent) async -> UNNotificationContent {
        // Extract uid first - if we can't find it, we can't do proper error logging
        guard let userInfo = notification.userInfo as? [String: Any],
              let uid = userInfo["uid"] as? String else {
            print("Cannot process notification: missing uid")
            await NotificationLogger.logDelivery(properties: ["message": .string("Fallback notification delivered successfully")])
            return notification
        }

        do {
            return try await processRichNotification(rawActivityEvent, notification: notification, uid: uid)
        } catch {
            let err = if let notificationError = error as? NotificationError {
                notificationError
            } else {
                NotificationError.unknown(uid: uid, underlyingError: error)
            }
            
            await NotificationLogger.sendToPostHog(events: [
                .error(err),
                .delivery(["uid": .string(uid), "message": .string("Fallback notification delivered successfully")])
            ])
            return notification
        }
    }

    private func processRichNotification(_ rawActivityEvent: Any, notification: UNMutableNotificationContent, uid: String) async throws -> UNNotificationContent {

        // Convert to JSON string first for error logging
        let activityEventJsonString = (try? JSONSerialization.jsonString(withJSONObject: rawActivityEvent)) ?? "Unknown"
        
        let context = JSContext()!
        context.exceptionHandler = { context, exception in
            print(exception?.toString() ?? "No exception found")
        }

        // Store the JSON string in notification userInfo
        notification.userInfo["activityEventJsonString"] = activityEventJsonString

        guard let scriptURL = Bundle.main.url(forResource: "bundle", withExtension: "js") else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString)
        }

        guard let script = try? String(contentsOf: scriptURL) else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString)
        }

        context.evaluateScript(script)

        let previewRaw = context.objectForKeyedSubscript("tlon")
            .invokeMethod("renderActivityEventPreview", withArguments: [
                rawActivityEvent,
            ])

        guard let preview = try? previewRaw?.decode(as: NotificationPreviewPayload.self) else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString)
        }

        // If we have a preview, make sure to fully replace server-provided title / body.
        notification.title = ""
        notification.body = ""

        let renderer = NotificationPreviewContentNodeRenderer()
        if let title = preview.notification.title {
            notification.title = await renderer.render(title)
        }
        notification.body = await renderer.render(preview.notification.body)
        notification.interruptionLevel = .active
        if let groupingKey = preview.notification.groupingKey {
            notification.threadIdentifier = await renderer.render(groupingKey)
        }
        notification.sound = UNNotificationSound.default

        guard let message = preview.message else {
            return notification
        }

        let sender = await INPerson.from(shipName: message.senderId, withImage: true)
        var speakableGroupName: INSpeakableString? = nil
        if let conversationTitle = message.conversationTitle {
            speakableGroupName = INSpeakableString(spokenPhrase: await renderer.render(conversationTitle))
        }
        let intent = INSendMessageIntent(
            // With an empty `recipients` list, iOS omits the notification title.
            // We don't have a proper recipients list, so use a minimal one.
            recipients: message.type == .group
                ? [sender]
                : [],
            outgoingMessageType: .outgoingMessageText,
            content: notification.body,
            speakableGroupName: speakableGroupName,
            conversationIdentifier: notification.threadIdentifier,
            serviceName: nil,
            sender: sender,
            attachments: nil
        )
        if intent.speakableGroupName != nil, let image = sender.image {
            intent.setImage(image, forParameterNamed: \.speakableGroupName)
        }

        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming

        do {
            try await interaction.donate()
            let result = try notification.updating(from: intent)

            // Log successful rich notification delivery
            await NotificationLogger.logDelivery(properties: ["uid": .string(uid), "message": .string("Rich notification delivered successfully")])

            return result
        } catch {
            // Throw NotificationDisplayFailed instead of handling here
            throw NotificationError.notificationDisplayFailed(uid: uid, activityEvent: activityEventJsonString, underlyingError: error)
        }
    }

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
    
        // use the provided timeslice as an opportunity to cache fresh /changes data
        Task {
            do {
                try await ChangesLoader.sync()
            } catch {
                // TODO: we should be logging this via telemetry
                print("[NotificationService] Failed to sync changes: \(error)")
            }
        }

        
        Task { [weak bestAttemptContent] in
          
            let parsedNotification = await PushNotificationManager.parseNotificationUserInfo(request.content.userInfo)
            switch parsedNotification {
            case let .activityEventJson(activityEventRaw):
                var notifContent = bestAttemptContent ?? UNNotificationContent()
                
              if let activityEventRaw {
                notifContent = await applyNotif(
                    activityEventRaw,
                    notification: notifContent.mutableCopy() as! UNMutableNotificationContent
                )
              }

              contentHandler(notifContent)
                
              return
            case let .failedFetchContents(err):
              // Extract uid for logging
              if let uid = request.content.userInfo["uid"] as? String {
                  await NotificationLogger.sendToPostHog(events: [
                    .error(NotificationError.activityEventFetchFailed(uid: uid, underlyingError: err)),
                    .delivery(["uid": .string(uid), "message": .string("Fallback notification delivered successfully")])
                  ])
                  print("Both logs completed for uid: \(uid)")
              } else {
                  print("No uid found in failed fetch contents case")
              }
              packErrorOnNotification(err)
              contentHandler(bestAttemptContent!)
              return

            case .invalid:
              // Log invalid notification
              if let uid = request.content.userInfo["uid"] as? String {
                  await NotificationLogger.logError(NotificationError.unknown(uid: uid, message: "Invalid notification format"))
              }
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

        // Log timeout if we can extract uid from notification
        if let bestAttemptContent = bestAttemptContent,
           let uid = bestAttemptContent.userInfo["uid"] as? String {
            Task {
                await NotificationLogger.logError(NotificationError.unknown(uid: uid, message: "Notification service extension timed out"))
            }
        }

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

extension Encodable {
  func asJson() throws -> Any {
    let data = try JSONEncoder().encode(self)
    return try JSONSerialization.jsonObject(with: data, options: [])
  }
}

private struct RenderNotificationPreviewResult: Codable {
    let title: String?
    let body: String?
}

extension JSValue {
    func decode<T: Decodable>(as type: T.Type) throws -> T {
        guard
            let object = self.toObject(),
            JSONSerialization.isValidJSONObject(object)
        else {
            throw NSError(
                domain: "JSValueError",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "JSValue is not a valid JSON object"]
            )
        }
        let jsonData = try JSONSerialization.data(withJSONObject: object, options: [])
        return try JSONDecoder().decode(T.self, from: jsonData)
    }
}

extension JSONSerialization {
    static func jsonString(withJSONObject data: Any, options: JSONSerialization.WritingOptions = []) throws -> String {
        let data = try self.data(withJSONObject: data, options: options)
        return String(data: data, encoding: .utf8)!
    }
}
