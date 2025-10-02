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
        case notify(uid: String, event: Any)
        case dismiss
        case invalid
        case failedFetchContents(Error)
    }

    static func parseNotificationUserInfo(_ userInfo: [AnyHashable: Any]) async -> ParseNotificationResult {
        guard let action = userInfo["action"] as? String,
              let uid = userInfo["uid"] as? String
        else {
            return .invalid
        }

        do {
            let aerData = try await PocketAPI.shared.fetchRawPushNotificationContents(uid)
            let event = try JSONSerialization.jsonObject(with: aerData)
            switch action {
            case "notify":
                return .notify(uid: uid, event: event)
            case "dismiss":
                return .dismiss

            default:
                return .invalid
            }

        } catch {
            return .failedFetchContents(error)
        }
    }
}
