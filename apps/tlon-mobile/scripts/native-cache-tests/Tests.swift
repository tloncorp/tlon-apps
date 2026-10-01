import Foundation

@main
enum NativeCacheTests {
    static func check(_ condition: Bool, _ message: String) {
        precondition(condition, message)
    }

    static func changes(_ posts: [String: Any]) -> ChangesResult {
        ChangesResult(activity: [:], chat: posts, channels: posts, groups: [:], contacts: [:])
    }

    static func batch(_ changes: ChangesResult, end: TimeInterval = 200) throws -> CachedChanges {
        try CachedChanges(begin: Date(timeIntervalSince1970: 100),
                          end: Date(timeIntervalSince1970: end), changes: changes)
    }

    static func main() throws {
        let parent: [String: Any] = ["seal": ["meta": ["replyCount": 2], "replies": ["reply": ["content": "test"]]]]
        let original = changes(["channel": ["parent": parent]])
        for delta in [[String: Any](), ["other": ["content": "new"]]] {
            let merged = original.merge(with: changes(["channel": delta]))
            for map in [merged.channels, merged.chat] {
                let posts = map["channel"] as! [String: Any]
                check(NSDictionary(dictionary: posts["parent"] as! [String: Any]).isEqual(to: parent),
                      "A later same-channel delta must preserve the parent and its replies")
            }
        }
        let edited = original.merge(with: changes(["channel": ["parent": ["revision": "1"]]]))
        check((edited.channels["channel"] as! [String: Any])["parent"] as? [String: String] == ["revision": "1"],
              "A newer post replaces the whole older post, not its nested reply map")
        let deletedPost = original.merge(with: changes(["channel": ["parent": NSNull()]]))
        check((deletedPost.channels["channel"] as! [String: Any])["parent"] is NSNull, "Keep post tombstones")
        let deleted = original.merge(with: changes(["channel": NSNull()]))
        check(deleted.channels["channel"] is NSNull, "Keep channel tombstones")
        let recreated = deleted.merge(with: changes(["channel": ["other": parent]]))
        check((recreated.channels["channel"] as! [String: Any])["parent"] == nil, "Recreation must not resurrect deleted posts")
        print("PASS: incremental channel/DM merge, updates, deletions, recreation")

        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let file = ChangesCacheFile(url: dir.appendingPathComponent("cache.json"))
        let first = try batch(original)
        try file.write(first, replacing: nil)
        let read = try file.read()!
        check(read.handoffId == first.handoffId, "Read retains generation")
        try check(file.read() != nil, "Read must not consume a batch before RN persistence")
        let handoff = try JSONSerialization.jsonObject(with: read.toJSON()) as! [String: Any]
        check(handoff["cacheId"] as? String == first.handoffId, "RN receives the exact generation")
        let second = try batch(original.merge(with: changes(["channel": ["other": parent]])), end: 300)
        try file.write(second, replacing: first.handoffId)
        try check(!file.acknowledge(first.handoffId), "Old acknowledgement must not delete newer writes")
        try check(!file.write(batch(original, end: 250), replacing: first.handoffId),
                  "A racing background fetch cancels without overwriting the newer generation")
        try check(file.read()?.handoffId == second.handoffId, "Conflict leaves newer cache intact")
        try check(file.acknowledge(second.handoffId), "Successful ack consumes the matching batch")
        try check(file.read() == nil, "Acknowledged batch removed")
        try check(!file.write(second, replacing: first.handoffId),
                  "A consumed-generation conflict cancels without throwing or resurrecting data")
        // Two initial requests may both have read an absent file.
        try file.write(first, replacing: nil)
        try check(!file.write(second, replacing: nil), "A second initial fetch cancels without clobbering the first")
        try file.remove()
        print("PASS: read/ack retry, stale acknowledgement, concurrent write, consumed-cache races")

        var legacy = try JSONSerialization.jsonObject(with: JSONEncoder().encode(first)) as! [String: Any]
        legacy.removeValue(forKey: "cacheId")
        try JSONSerialization.data(withJSONObject: legacy).write(to: file.url)
        let legacyId = try file.read()!.handoffId
        try check(file.read()!.handoffId == legacyId, "Legacy generation is stable across reads")
        try check(file.acknowledge(legacyId), "Old cache files can be acknowledged")
        print("PASS: pre-upgrade cache compatibility")

        for invalid in [Data("not JSON".utf8), Data("{}".utf8)] {
            try invalid.write(to: file.url)
            try check(file.read() == nil, "Undecodable files are discarded")
            check(!FileManager.default.fileExists(atPath: file.url.path), "Poison file is removed")
        }
        var invalidPayload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(first)) as! [String: Any]
        invalidPayload["changesData"] = Data("not JSON".utf8).base64EncodedString()
        try JSONSerialization.data(withJSONObject: invalidPayload).write(to: file.url)
        try check(file.read() == nil, "Corrupt embedded changes are discarded")
        try file.write(batch(original, end: 50), replacing: nil)
        try check(file.read() == nil, "Inverted cache windows are discarded")
        try check(file.write(first, replacing: nil), "A valid batch can replace discarded poison data")
        try check(file.read()?.handoffId == first.handoffId, "Fresh data remains readable")
        // A directory produces a read error, not a decoding error: preserve it.
        let directoryCache = ChangesCacheFile(url: dir)
        do {
            _ = try directoryCache.read()
            preconditionFailure("Expected an I/O error")
        } catch { check(FileManager.default.fileExists(atPath: dir.path), "I/O errors must not delete data") }
        print("PASS: corrupt cache eviction, invalid windows, and I/O preservation")

        let error = NotificationError.backgroundSyncFailed(uid: "test-notification", underlyingError: NSError(domain: "CacheTest", code: 42))
        let event = LogEvent(userId: "test-user", data: .error(error)).asPostHogEvent
        check(event["event"] as? String == "Notification Service Error", "Sync failure uses error event, not delivery success")
        let props = event["properties"] as! [String: Any]
        check(props["message"] as? String == "Background changes sync failed", "Distinct sync failure category")
        check(props["uid"] as? String == "test-notification", "Failure correlates to notification")
        check((props["underlyingError"] as? String)?.contains("CacheTest") == true, "Underlying error is preserved")
        print("PASS: native sync failure telemetry")
    }
}
