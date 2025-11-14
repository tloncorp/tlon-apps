import Intents
import UserNotifications
import JavaScriptCore

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    
    private let userDefaults = UserDefaults.forDefaultAppGroup

    private func applyNotif(_ rawActivityEvent: Any, uid: String, notification: UNMutableNotificationContent) async -> UNNotificationContent {
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

        // Store the JSON string in notification userInfo
        notification.userInfo["activityEventJsonString"] = activityEventJsonString

        // If we have a preview, make sure to fully replace server-provided title / body.
        notification.title = ""
        notification.body = ""

        let renderer = NotificationPreviewContentNodeRenderer()
        let preview = try getPreview(rawActivityEvent: rawActivityEvent, uid: uid, activityEventJsonString: activityEventJsonString)
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

            await NotificationLogger.logDelivery(properties: ["uid": .string(uid), "message": .string("Rich notification delivered successfully")])

            return result
        } catch {
            throw NotificationError.notificationDisplayFailed(uid: uid, activityEvent: activityEventJsonString, underlyingError: error)
        }
    }

    /// Presents a `JSValue` (likely raised as an exception by a `JSContext`) as a `Swift.Error`.
    private struct JSException: LocalizedError {
        let exception: JSValue
        weak var context: JSContext?

        var errorDescription: String? {
            "JSContext raised exception: \(exception.toString() ?? "unable to stringify")"
        }
    }

    private func getPreview(rawActivityEvent: Any, uid: String, activityEventJsonString: String) throws -> NotificationPreviewPayload {
        let context = JSContext()!
        var jsException: JSException? = nil
        context.exceptionHandler = { context, exception in
            print(exception?.toString() ?? "No exception found")
            jsException = exception.map { JSException(exception: $0, context: context) }
        }

        guard let scriptURL = Bundle.main.url(forResource: "bundle", withExtension: "js") else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString, underlyingError: jsException)
        }

        guard let script = try? String(contentsOf: scriptURL) else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString, underlyingError: jsException)
        }

        context.evaluateScript(script)

        let previewRaw = context.objectForKeyedSubscript("tlon")
            .invokeMethod("renderActivityEventPreview", withArguments: [
                rawActivityEvent,
            ])

        guard let preview = try? previewRaw?.decode(as: NotificationPreviewPayload.self) else {
            throw NotificationError.previewRenderFailed(uid: uid, activityEvent: activityEventJsonString, underlyingError: jsException)
        }

        return preview
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
          case .notify(let uid, let event):
              var notifContent = bestAttemptContent ?? UNNotificationContent()
              let notification = notifContent.mutableCopy() as! UNMutableNotificationContent
              print("[notifications] badge count \(notifContent.badge ?? NSNumber(0))")
              let latestNotif = userDefaults.string(forKey: "latest-notification") ?? "0v0";
              let latestBadge = userDefaults.integer(forKey: "latest-badge-count");
              if latestNotif > uid {
                  notification.badge = NSNumber(value: latestBadge)
              } else {
                  userDefaults.set(uid, forKey: "latest-notification");
                  userDefaults.set(notifContent.badge?.intValue ?? 0, forKey: "latest-badge-count")
              }
              
              notifContent = await applyNotif(
                event,
                uid: uid,
                notification: notification
              )

              contentHandler(notifContent)
              return

          case .dismiss:
              // Should not be hit, but set up fallback notification just in case.
              // We can't prevent this alert from being shown, so at least make it truthful.
              if let bestAttemptContent = bestAttemptContent {
                  bestAttemptContent.title = "You marked some content as read."
                  bestAttemptContent.subtitle = ""
                  bestAttemptContent.body = ""
                  contentHandler(bestAttemptContent)
              }
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

              await NotificationLogger.logDelivery(properties: ["message": .string("Fallback notification delivered successfully")])
              contentHandler(bestAttemptContent!)
              return

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

extension JSONSerialization {
    static func jsonString(withJSONObject data: Any, options: JSONSerialization.WritingOptions = []) throws -> String {
        let data = try self.data(withJSONObject: data, options: options)
        return String(data: data, encoding: .utf8)!
    }
}
