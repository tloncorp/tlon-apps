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
        case notify(uid: String, notifyCount: Int, event: Any)
        case dismiss(uid: String, id: String, notifyCount: Int, event: Any)
        case invalid
        case failedFetchContents(Error)
    }

    static func parseNotificationUserInfo(_ userInfo: [AnyHashable: Any]) async -> ParseNotificationResult {
        let notifyCount: Int = Int(userInfo["notify-count"] as? String ?? "0") ?? 0
        guard let action = userInfo["action"] as? String,
              let uid = userInfo["uid"] as? String,
              let id = userInfo["id"] as? String
        else {
            return .invalid
        }

        do {
            let aerData = try await PocketAPI.shared.fetchRawPushNotificationContents(uid)
            let event = try JSONSerialization.jsonObject(with: aerData)
            switch action {
            case "notify":
                return .notify(uid: uid, notifyCount: notifyCount, event: event)
            case "dismiss":
                return .dismiss(uid: uid, id: id, notifyCount: notifyCount, event: event)

            default:
                return .invalid
            }

        } catch {
            return .failedFetchContents(error)
        }
    }
}
