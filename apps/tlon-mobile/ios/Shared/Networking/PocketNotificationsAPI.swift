//
//  PocketNotificationsAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 8/11/22.
//

import Alamofire
import Foundation

extension PocketAPI {
    func fetchPushNotificationContents(_ uid: String) async throws -> Yarn {
        let yarn: Yarn = try await fetchDecodable("/apps/groups/~/notify/note/\(uid)/hark-yarn", timeoutInterval: 8)
        return yarn
    }
  
  func fetchPushNotificationContents(_ uid: String) async throws -> ActivityEvent.ActivityEventResponse {
      try await fetchDecodable("/apps/groups/~/notify/note/\(uid)/activity-event", timeoutInterval: 8)
  }
}
