//
//  Changes.swift
//  Landscape
//
//  Created by brian. on 8/24/25.
//

import Foundation


//struct ChangesResult: Codable {
//    let activity: [String: Data]
//    let chat: [String: Data]
//    let channels: [String: Data]
//    let groups: [String: Data]
//    let contacts: [String: Data]
//}

//struct ChangesResult: Codable {
//    let activity: [String: Data]
//    let chat: [String: Data]
//    let channels: [String: Data]
//    let groups: [String: Data]
//    let contacts: [String: Data]
//    
//    // Custom decoder that keeps nested values as raw JSON Data
//    init(from decoder: Decoder) throws {
//        let container = try decoder.container(keyedBy: CodingKeys.self)
//        
//        // Get the raw data for this decoder
//        let jsonDecoder = decoder as? JSONDecoder
//        let encoder = JSONEncoder()
//        
//        // Decode each top-level dictionary, but keep values as Data
//        if let activityDict = try? container.decode([String: AnyCodable].self, forKey: .activity) {
//            activity = try activityDict.mapValues { try encoder.encode($0) }
//        } else {
//            activity = [:]
//        }
//        
//        if let chatDict = try? container.decode([String: AnyCodable].self, forKey: .chat) {
//            chat = try chatDict.mapValues { try encoder.encode($0) }
//        } else {
//            chat = [:]
//        }
//        
//        if let channelsDict = try? container.decode([String: AnyCodable].self, forKey: .channels) {
//            channels = try channelsDict.mapValues { try encoder.encode($0) }
//        } else {
//            channels = [:]
//        }
//        
//        if let groupsDict = try? container.decode([String: AnyCodable].self, forKey: .groups) {
//            groups = try groupsDict.mapValues { try encoder.encode($0) }
//        } else {
//            groups = [:]
//        }
//        
//        if let contactsDict = try? container.decode([String: AnyCodable].self, forKey: .contacts) {
//            contacts = try contactsDict.mapValues { try encoder.encode($0) }
//        } else {
//            contacts = [:]
//        }
//    }
//    
//    // Merge function - newer values override older ones
//    func merge(with newer: ChangesResult) -> ChangesResult {
//        return ChangesResult(
//            activity: activity.merging(newer.activity) { _, new in new },
//            chat: chat.merging(newer.chat) { _, new in new },
//            channels: channels.merging(newer.channels) { _, new in new },
//            groups: groups.merging(newer.groups) { _, new in new },
//            contacts: contacts.merging(newer.contacts) { _, new in new }
//        )
//    }
//    
//    // Direct initializer for merged results
//    init(activity: [String: Data], chat: [String: Data], channels: [String: Data], groups: [String: Data], contacts: [String: Data]) {
//        self.activity = activity
//        self.chat = chat
//        self.channels = channels
//        self.groups = groups
//        self.contacts = contacts
//    }
//    
//    // Convert back to Data for file storage
//    func toJSONData() throws -> Data {
//        let dict: [String: Any] = [
//            "activity": try activity.mapValues { try JSONSerialization.jsonObject(with: $0) },
//            "chat": try chat.mapValues { try JSONSerialization.jsonObject(with: $0) },
//            "channels": try channels.mapValues { try JSONSerialization.jsonObject(with: $0) },
//            "groups": try groups.mapValues { try JSONSerialization.jsonObject(with: $0) },
//            "contacts": try contacts.mapValues { try JSONSerialization.jsonObject(with: $0) }
//        ]
//        
//        return try JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted)
//    }
//}
//
//// Minimal AnyCodable just for decoding
//private struct AnyCodable: Codable {}

struct ChangesResult {
    let activity: [String: Any]
    let chat: [String: Any]
    let channels: [String: Any]
    let groups: [String: Any]
    let contacts: [String: Any]
    
    init(from data: Data) throws {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "ChangesResult", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON structure"])
        }
        
        self.activity = (json["activity"] as? [String: Any]) ?? [:]
        self.chat = (json["chat"] as? [String: Any]) ?? [:]
        self.channels = (json["channels"] as? [String: Any]) ?? [:]
        self.groups = (json["groups"] as? [String: Any]) ?? [:]
        self.contacts = (json["contacts"] as? [String: Any]) ?? [:]
    }
    
    func merge(with newer: ChangesResult) -> ChangesResult {
        return ChangesResult(
            activity: activity.merging(newer.activity) { _, new in new },
            chat: chat.merging(newer.chat) { _, new in new },
            channels: channels.merging(newer.channels) { _, new in new },
            groups: groups.merging(newer.groups) { _, new in new },
            contacts: contacts.merging(newer.contacts) { _, new in new }
        )
    }
    
    init(activity: [String: Any], chat: [String: Any], channels: [String: Any], groups: [String: Any], contacts: [String: Any]) {
        self.activity = activity
        self.chat = chat
        self.channels = channels
        self.groups = groups
        self.contacts = contacts
    }
    
    func toJSONData() throws -> Data {
        let dict: [String: Any] = [
            "activity": activity,
            "chat": chat,
            "channels": channels,
            "groups": groups,
            "contacts": contacts
        ]
        
        return try JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted)
    }
}
