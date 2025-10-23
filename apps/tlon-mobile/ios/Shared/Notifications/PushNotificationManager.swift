//
//  PushNotificationManager.swift
//  Pocket
//
//  Created by Alec Ananian on 1/29/23.
//

import Foundation
import Intents
import NotificationCenter

@objc final class PushNotificationManager: NSObject {
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
                // Failure will be logged later
                return .failedFetchContents(error)
            }

        case "dismiss":
            return .dismiss(uid: uid)

        default:
            return .invalid
        }
    }
}
