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
    // activity-event-2 is the v10-native mark (carries notes events),
    // activity-event-1 the v9 one (reacts), activity-event (v8) the oldest.
    // Use the newest mark the app has confirmed the backend supports —
    // otherwise an old backend would 404 every notification.
    let mark = SettingsStore.activitySupportsNotes
      ? "activity-event-2"
      : SettingsStore.activitySupportsReactions ? "activity-event-1" : "activity-event"
    return try await fetchData("/apps/groups/~/notify/note/\(uid)/\(mark)", timeoutInterval: 8)
  }
}
