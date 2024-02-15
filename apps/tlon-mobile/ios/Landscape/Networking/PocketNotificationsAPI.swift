//
//  PocketNotificationsAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 8/11/22.
//

import Alamofire
import Foundation

final class PocketNotificationsAPI: PocketAPI {
    static func fetchPushNotificationContents(_ uid: String) async throws -> Yarn {
        let yarn: Yarn = try await PocketAPI.fetchDecodable("/~/scry/hark/yarn/\(uid)", timeoutInterval: 8)
        return yarn
    }
}
