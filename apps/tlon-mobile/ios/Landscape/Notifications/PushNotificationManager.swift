//
//  PushNotificationManager.swift
//  Pocket
//
//  Created by Alec Ananian on 1/29/23.
//

import Foundation
import Intents
import NotificationCenter

enum NotificationAction: String {
    case reply
    case markAsRead
    case accept
    case deny

    var title: String {
        switch self {
        case .reply:
            return "Reply"
        case .markAsRead:
            return "Mark as Read"
        case .accept:
            return "Accept"
        case .deny:
            return "Deny"
        }
    }

    var icon: UNNotificationActionIcon {
        switch self {
        case .reply:
            return UNNotificationActionIcon(systemImageName: "arrowshape.turn.up.left")
        case .markAsRead:
            return UNNotificationActionIcon(systemImageName: "envelope.open")
        case .accept:
            return UNNotificationActionIcon(systemImageName: "checkmark")
        case .deny:
            return UNNotificationActionIcon(systemImageName: "xmark")
        }
    }

    var action: UNNotificationAction {
        if self == .reply {
            return UNTextInputNotificationAction(identifier: rawValue, title: title, icon: icon)
        }

        return UNNotificationAction(identifier: rawValue, title: title, icon: icon)
    }
}

enum NotificationCategory: String {
    case message
    case invitation

    var actions: [NotificationAction] {
        []
//        switch self {
//        case .message:
//            return [.reply, .markAsRead]
//        case .invitation:
//            return [.accept, .deny]
//        }
    }

    var category: UNNotificationCategory {
        UNNotificationCategory(identifier: rawValue, actions: actions.map(\.action), intentIdentifiers: [])
    }
}

@objc final class PushNotificationManager: NSObject {
    @objc static func configure() {
        UNUserNotificationCenter.current().setNotificationCategories([
            NotificationCategory.message.category,
        ])
    }

    @objc static func handleBackgroundNotification(_ userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        guard let action = userInfo["action"] as? String,
              let uid = userInfo["uid"] as? String
        else {
            return .noData
        }

        if action == "notify" {
            let yarn: Yarn
            do {
                yarn = try await PocketAPI.shared.fetchPushNotificationContents(uid)
            } catch {
                error.logWithDomain(TlonError.NotificationsFetchYarn)

                if error.isAFTimeout, await sendFallbackNotification() {
                    return .newData
                }

                return .failed
            }

            // Skip if not a valid push notification
            guard yarn.isValidNotification else {
                print("Skipping notification: \(yarn)")
                return .noData
            }

            let success = await sendNotification(with: yarn)
            return success ? .newData : .failed
        }

        if action == "dismiss" {
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [uid])
            return .newData
        }

        return .noData
    }

    static func sendNotification(with yarn: Yarn) async -> Bool {
        var content = UNMutableNotificationContent()
        content.interruptionLevel = .timeSensitive
        content.threadIdentifier = yarn.channelID
        content.title = await yarn.getTitle()
        content.body = yarn.body
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
                let interaction = INInteraction(intent: intent, response: nil)
                interaction.direction = .incoming
                try await interaction.donate()
            } catch {
                print("Error donating interaction for notification sender details: \(error)")
            }

            do {
                content = try content.updating(from: intent) as! UNMutableNotificationContent
            } catch {
                print("Error updating content for notification sender details: \(error)")
            }
        }

        let request = UNNotificationRequest(identifier: yarn.id, content: content, trigger: nil)
        do {
            try await UNUserNotificationCenter.current().add(request)
            return true
        } catch {
            error.logWithDomain(TlonError.NotificationsShowBanner)
            return false
        }
    }

    static func sendFallbackNotification() async -> Bool {
        var content = UNMutableNotificationContent()
        content.body = "You have received a notification."
        content.userInfo = ["wer": "/notifications"]
        let request = UNNotificationRequest(identifier: "notification_fallback", content: content, trigger: nil)
        do {
            try await UNUserNotificationCenter.current().add(request)
            return true
        } catch {
            error.logWithDomain(TlonError.NotificationsShowFallback)
            return false
        }
    }
}
