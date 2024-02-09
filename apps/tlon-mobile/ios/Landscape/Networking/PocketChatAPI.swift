//
//  PocketChatAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 6/30/22.
//

import Alamofire
import Foundation

final class PocketChatAPI: PocketAPI {
    static func fetchClubByID(_ id: String) async throws -> Club {
        try await PocketAPI.fetchDecodable("/~/scry/chat/club/\(id)/crew")
    }

    static func fetchGroups() async throws -> [String: Group] {
        try await PocketAPI.fetchDecodable("/~/scry/groups/groups/light")
    }

    static func fetchGroupChannels() async throws -> [String: GroupChannel] {
        let groups = try await fetchGroups()
        var groupChannels = [String: GroupChannel]()
        for group in groups.values {
            for (id, groupChannel) in group.channels {
                groupChannels[id] = groupChannel
            }
        }

        return groupChannels
    }
}
