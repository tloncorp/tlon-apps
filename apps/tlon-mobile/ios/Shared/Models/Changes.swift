import Foundation

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


struct CachedChanges: Codable {
    let beginTimestamp: Date
    let endTimestamp: Date
    let changesData: Data
    
    init(begin: Date, end: Date, changes: ChangesResult) throws {
        self.beginTimestamp = begin
        self.endTimestamp = end
        self.changesData = try changes.toJSONData()
    }
    
    // Get the ChangesResult back out
    func getChanges() throws -> ChangesResult {
        return try ChangesResult(from: changesData)
    }
    
    // For RN consumption - includes metadata
    func toJSON() throws -> Data {
        let dict: [String: Any] = [
            "beginTimestamp": beginTimestamp.timeIntervalSince1970,
            "endTimestamp": endTimestamp.timeIntervalSince1970,
            "changes": try JSONSerialization.jsonObject(with: changesData)
        ]
        return try JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted)
    }
}
