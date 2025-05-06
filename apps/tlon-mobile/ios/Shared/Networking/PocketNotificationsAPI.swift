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
    try await fetchData("/apps/groups/~/notify/note/\(uid)/activity-event", timeoutInterval: 8)
  }
}
