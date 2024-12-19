//
//  PushNotificationManager.swift
//  Pocket
//
//  Created by Alec Ananian on 1/29/23.
//

import Foundation
import Intents
import NotificationCenter

enum NotificationCategory: String {
    case message
    case invitation

    var category: UNNotificationCategory {
        UNNotificationCategory(identifier: rawValue, actions: [], intentIdentifiers: [])
    }
}

@objc final class PushNotificationManager: NSObject {
    @objc static func configure() {
        UNUserNotificationCenter.current().setNotificationCategories([
            NotificationCategory.message.category,
        ])
    }
  
    enum ParseNotificationResult {
      case yarn(Yarn, ActivityEvent.ActivityEvent?)
        case dismiss(uid: String)
        case invalid
        case failedFetchContents(Error)
    }

    static func parseNotificationUserInfo(_ userInfo: [AnyHashable: Any]) async -> ParseNotificationResult {
        guard let action = userInfo["action"] as? String,
              let uid = userInfo["uid"] as? String
        else {
            return .invalid
        }

        switch action {
        case "notify":
            do {
              let yarn: Yarn = try await PocketAPI.shared.fetchPushNotificationContents(uid)

              // HACK: Fetch the activity event in addition to the yarn. This
              // is largely redundant, but activity event has the full post
              // content, which we want to hand off. In the future, activity
              // event should be able to fully replace yarn, but it requires
              // more work.
              let aer: ActivityEvent.ActivityEventResponse = try await PocketAPI.shared.fetchPushNotificationContents(uid)

              return .yarn(yarn, aer.event)
            } catch {
                return .failedFetchContents(error)
            }

        case "dismiss":
            return .dismiss(uid: uid)

        default:
            return .invalid
        }
    }
}

/**
 This type's value can be represented as a user-facing push alert.
 */
protocol UNNotificationRenderable {
  /**
   Renders the receiver onto the specified notification content. Caller should discard the input
   `UNMutableNotificationContent` and use the returned value, since the identity of the notification
   content may change.
   
   ```swift
   let (content, msgIntent) = await payload.render(to: mutableContent)
   // `mutableContent` should no longer be used; use `content` instead
   if let msgIntent {
     // donate intent here
   }
   ```
   */
  func render(to content: UNMutableNotificationContent) async -> (UNNotificationContent, INSendMessageIntent?)
}

extension Yarn: UNNotificationRenderable {
  func render(to content: UNMutableNotificationContent) async -> (UNNotificationContent, INSendMessageIntent?) {
    content.interruptionLevel = .active
    content.threadIdentifier = self.rope.thread
    content.title = await self.getTitle()
    content.body = self.body
    // content.badge = await withUnsafeContinuation { cnt in
    //     UNUserNotificationCenter.current().getDeliveredNotifications { notifs in
    //         cnt.resume(returning: NSNumber(value: notifs.count + 1))
    //     }
    // }
    content.categoryIdentifier = self.category.rawValue
    content.userInfo = self.userInfo
    content.sound = UNNotificationSound.default
    
    if content.categoryIdentifier == NotificationCategory.message.rawValue,
       let senderShipName = self.senderShipName
    {
      let sender = await INPerson.from(shipName: senderShipName, withImage: true)
      let intent = INSendMessageIntent(
        // Create empty recipient for groups because we don't need the OS creating the participant list
        recipients: [INPerson.empty],
        outgoingMessageType: .outgoingMessageText,
        content: self.body,
        speakableGroupName: INSpeakableString(spokenPhrase: content.title),
        conversationIdentifier: content.threadIdentifier,
        serviceName: nil,
        sender: sender,
        attachments: nil
      )
      
      if intent.speakableGroupName != nil, let image = sender.image {
        intent.setImage(image, forParameterNamed: \.speakableGroupName)
      }
      
      do {
        let updatedNotifContent = try content.updating(from: intent)
        return (updatedNotifContent, intent)
      } catch {
        print("Error updating content for notification sender details: \(error)")
        return (content, nil)
      }
    }
    
    return (content, nil)
  }
}
