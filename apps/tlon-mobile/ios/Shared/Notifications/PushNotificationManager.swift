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
        case activityEventJson(Any?)
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
                let aerData = try await PocketAPI.shared.fetchRawPushNotificationContents(uid)
                return .activityEventJson(try JSONSerialization.jsonObject(with: aerData))
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
