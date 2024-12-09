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

    static func buildNotificationWithIntent(
        yarn: Yarn,
        content: UNMutableNotificationContent = UNMutableNotificationContent()
    ) async -> (UNNotificationContent, INSendMessageIntent?) {
        content.interruptionLevel = .active
        content.threadIdentifier = yarn.rope.thread
        content.title = await yarn.getTitle()
        content.body = yarn.body
        // content.badge = await withUnsafeContinuation { cnt in
        //     UNUserNotificationCenter.current().getDeliveredNotifications { notifs in
        //         cnt.resume(returning: NSNumber(value: notifs.count + 1))
        //     }
        // }
        content.categoryIdentifier = yarn.category.rawValue
        content.userInfo = yarn.userInfo
        content.sound = UNNotificationSound.default

        if content.categoryIdentifier == NotificationCategory.message.rawValue,
           let senderShipName = yarn.senderShipName
        {
            let sender = await INPerson.from(shipName: senderShipName, withImage: true)
            let intent = INSendMessageIntent(
                // Create empty recipient for groups because we don't need the OS creating the participant list
                recipients: [INPerson.empty],
                outgoingMessageType: .outgoingMessageText,
                content: yarn.body,
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

    enum ParseNotificationResult {
        case yarn(Yarn)
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
                return .yarn(yarn)
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
