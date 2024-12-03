//
//  PocketChatAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 6/30/22.
//

import Alamofire
import Foundation

extension PocketAPI {
    func fetchClubByID(_ id: String) async throws -> Club {
        try await fetchDecodable("/~/scry/chat/club/\(id)/crew")
    }

    func fetchGroups() async throws -> [String: Group] {
        try await fetchDecodable("/~/scry/groups/groups/light")
    }
  
    func fetchGangs() async throws -> [String: Gang] {
        try await fetchDecodable("/~/scry/groups/gangs")
    }

    func fetchGroupChannels() async throws -> [String: GroupChannel] {
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
