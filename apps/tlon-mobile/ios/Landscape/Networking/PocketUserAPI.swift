//
//  PocketUserAPI.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation

final class PocketUserAPI: PocketAPI {
    static func fetchContacts() async throws -> [String: Contact] {
        let result: [String: ContactInfo?] = try await PocketAPI.fetchDecodable("/~/scry/contacts/all")
        var contacts = [String: Contact]()
        for (id, info) in result {
            if let info {
                contacts[id] = Contact(id: id, info: info)
            }
        }
        return contacts
    }

    static func fetchSettings() async throws {
        let data = try await PocketAPI.fetchData("/~/scry/settings/desk/groups")
        if let results = try JSONSerialization.jsonObject(with: data) as? [String: [String: Any]],
           let desk = results["desk"],
           let calmEngine = desk["calmEngine"] as? [String: Any]
        {
            SettingsStore.disableAvatars = calmEngine["disableAvatars"] as? Bool ?? false
            SettingsStore.disableNicknames = calmEngine["disableNicknames"] as? Bool ?? false
        }
    }
}
