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

        activity = (json["activity"] as? [String: Any]) ?? [:]
        chat = (json["chat"] as? [String: Any]) ?? [:]
        channels = (json["channels"] as? [String: Any]) ?? [:]
        groups = (json["groups"] as? [String: Any]) ?? [:]
        contacts = (json["contacts"] as? [String: Any]) ?? [:]
    }

    func merge(with newer: ChangesResult) -> ChangesResult {
        ChangesResult(
            activity: activity.merging(newer.activity) { _, new in new },
            chat: Self.mergePostMaps(chat, newer.chat),
            channels: Self.mergePostMaps(channels, newer.channels),
            groups: groups.merging(newer.groups) { _, new in new },
            contacts: contacts.merging(newer.contacts) { _, new in new }
        )
    }

    // Each channel/DM value is a delta keyed by post ID, not a snapshot of
    // the channel. Replace individual posts (including null tombstones), but
    // retain other posts accumulated earlier in the background window.
    private static func mergePostMaps(_ old: [String: Any], _ newer: [String: Any]) -> [String: Any] {
        old.merging(newer) { previous, incoming in
            guard let oldPosts = previous as? [String: Any],
                  let newPosts = incoming as? [String: Any]
            else {
                // A null channel deletes it; a map after null recreates it.
                return incoming
            }
            return oldPosts.merging(newPosts) { _, new in new }
        }
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
            "contacts": contacts,
        ]

        return try JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted)
    }
}

struct CachedChanges: Codable {
    // Optional for files written by older app versions.
    let cacheId: String?
    var handoffId: String {
        cacheId ?? "legacy-\(beginTimestamp.timeIntervalSince1970)-\(endTimestamp.timeIntervalSince1970)"
    }

    let beginTimestamp: Date
    let endTimestamp: Date
    let changesData: Data
    let notificationReceivedAt: Date?

    init(begin: Date, end: Date, changes: ChangesResult, notificationReceivedAt: Date? = nil) throws {
        cacheId = UUID().uuidString
        beginTimestamp = begin
        endTimestamp = end
        changesData = try changes.toJSONData()
        self.notificationReceivedAt = notificationReceivedAt
    }

    func getChanges() throws -> ChangesResult {
        try ChangesResult(from: changesData)
    }

    func toJSON() throws -> Data {
        var dict: [String: Any] = try [
            "cacheId": handoffId,
            "beginTimestamp": beginTimestamp.javascriptTimestampCeil,
            "endTimestamp": endTimestamp.javascriptTimestampFloor,
            "changes": JSONSerialization.jsonObject(with: changesData),
        ]
        if let notificationReceivedAt {
            dict["notificationReceivedAtMs"] = notificationReceivedAt.javascriptTimestampFloor
        }
        return try JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted)
    }
}
