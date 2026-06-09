//
//  PocketNotificationsAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 8/11/22.
//

import Alamofire
import Foundation
import JavaScriptCore

extension PocketAPI {
  func fetchRawPushNotificationContents(_ uid: String) async throws -> Data {
    // activity-event-1 is the v9-native mark (carries reacts); activity-event
    // (v8) 404s on reacts. Use v9 only when the app has confirmed the backend
    // supports it — otherwise an old backend would 404 every notification.
    let mark = SettingsStore.activitySupportsReactions ? "activity-event-1" : "activity-event"
    return try await fetchData("/apps/groups/~/notify/note/\(uid)/\(mark)", timeoutInterval: 8)
  }
}
