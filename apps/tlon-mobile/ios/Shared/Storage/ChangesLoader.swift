import Foundation

class ChangesLoader {
    private static let sharedFileName = "changes_cache.json"
    private static let lastSyncKey = "changesSyncedAt"
    private static let latestNotificationReceivedAtMsKey = "latestNotificationReceivedAtMs"
    private static let latestNotificationSyncCompletedKey = "latestNotificationSyncCompleted"

    static func setLastSyncTimestamp(_ date: Date?) throws {
        let sharedDefaults = UserDefaults.forDefaultAppGroup

        if let date {
            sharedDefaults.set(date, forKey: lastSyncKey)
            print("[ChangesLoader] Stored sync timestamp: \(date)")
        } else {
            sharedDefaults.removeObject(forKey: lastSyncKey)
            try deleteCachedChanges()
            print("[ChangesLoader] Cleared sync timestamp")
        }
    }

    private static func getLastSyncTimestamp() -> Date? {
        let sharedDefaults = UserDefaults.forDefaultAppGroup

        if let storedDate = sharedDefaults.object(forKey: lastSyncKey) as? Date {
            print("[ChangesLoader] Reading stored sync timestamp: \(storedDate)")
            return storedDate
        } else {
            print("[ChangesLoader] No stored timestamp found")
            return nil
        }
    }

    private static func getFileURL() throws -> URL {
        if let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "TlonDefaultAppGroup") as? String {
            guard let sharedContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
                throw NSError(domain: "ChangesLoader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find shared App Group container."])
            }
            return sharedContainerURL.appendingPathComponent(sharedFileName)
        } else {
            throw NSError(
                domain: "ChangesLoader",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not find appGroupIdentifier"]
            )
        }
    }

    private static func cacheFile() throws -> ChangesCacheFile {
        try ChangesCacheFile(url: getFileURL())
    }

    private static func readCachedChanges() throws -> CachedChanges? {
        try cacheFile().read()
    }

    private static func deleteCachedChanges() throws {
        try cacheFile().remove()
    }

    static func acknowledge(_ cacheId: String) throws -> Bool {
        try cacheFile().acknowledge(cacheId)
    }

    static func sync(notificationReceivedAt: Date? = nil) async throws {
        print("[ChangesLoader] Syncing...")
        let now = Date()

        if let notificationReceivedAt {
            markLatestNotificationSyncState(receivedAt: notificationReceivedAt, completed: false)
        }

        if let cached = try readCachedChanges() {
            print("[ChangesLoader] Found cached changes, appending...")
            let newChanges = try await PocketAPI.shared.fetchChangesSince(cached.endTimestamp)
            let oldChanges = try cached.getChanges()
            let merged = oldChanges.merge(with: newChanges)
            let mergedNotificationReceivedAt: Date? = {
                switch (cached.notificationReceivedAt, notificationReceivedAt) {
                case let (existing?, incoming?):
                    return max(existing, incoming)
                case let (existing?, nil):
                    return existing
                case let (nil, incoming?):
                    return incoming
                case (nil, nil):
                    return nil
                }
            }()
            try cacheFile().write(
                CachedChanges(
                    begin: cached.beginTimestamp,
                    end: now,
                    changes: merged,
                    notificationReceivedAt: mergedNotificationReceivedAt
                ),
                replacing: cached.handoffId
            )
            if let latestNotificationReceivedAt = mergedNotificationReceivedAt {
                markLatestNotificationSyncState(
                    receivedAt: latestNotificationReceivedAt,
                    completed: true
                )
            }
            print("[ChangesLoader] Successfully updated cached changes.")
            return
        }

        print("[ChangesLoader] No cached changes found, looking for last sync timestamp...")
        if let lastSyncedAt = getLastSyncTimestamp() {
            print("[ChangesLoader] Found last sync timestamp, fetching changes...")
            let fetchedChanges = try await PocketAPI.shared.fetchChangesSince(lastSyncedAt)
            try cacheFile().write(
                CachedChanges(
                    begin: lastSyncedAt,
                    end: now,
                    changes: fetchedChanges,
                    notificationReceivedAt: notificationReceivedAt
                ),
                replacing: nil
            )
            if let notificationReceivedAt {
                markLatestNotificationSyncState(receivedAt: notificationReceivedAt, completed: true)
            }
            print("[ChangesLoader] Successfully wrote changes.")
        }
    }

    static func retrieve() throws -> Data? {
        guard let cached = try readCachedChanges() else {
            return nil
        }

        var jsonObject = try JSONSerialization.jsonObject(with: cached.toJSON()) as? [String: Any] ?? [:]
        let metadata = latestNotificationSyncMetadata()
        if let receivedAtMs = metadata.receivedAtMs {
            jsonObject["notificationReceivedAtMs"] = receivedAtMs
        }
        if let completed = metadata.completed {
            jsonObject["notificationSyncCompleted"] = completed
        }
        let jsonData = try JSONSerialization.data(withJSONObject: jsonObject, options: .prettyPrinted)
        // RN acknowledges this exact generation only after persistence.
        return jsonData
    }

    private static func markLatestNotificationSyncState(
        receivedAt: Date,
        completed: Bool
    ) {
        let sharedDefaults = UserDefaults.forDefaultAppGroup
        sharedDefaults.set(receivedAt.javascriptTimestampFloor, forKey: latestNotificationReceivedAtMsKey)
        sharedDefaults.set(completed, forKey: latestNotificationSyncCompletedKey)
    }

    private static func latestNotificationSyncMetadata() -> (receivedAtMs: Int64?, completed: Bool?) {
        let sharedDefaults = UserDefaults.forDefaultAppGroup
        let hasReceivedAt = sharedDefaults.object(forKey: latestNotificationReceivedAtMsKey) != nil
        let hasCompleted = sharedDefaults.object(forKey: latestNotificationSyncCompletedKey) != nil
        let receivedAtMs = hasReceivedAt
            ? Int64(sharedDefaults.integer(forKey: latestNotificationReceivedAtMsKey))
            : nil
        let completed = hasCompleted
            ? sharedDefaults.bool(forKey: latestNotificationSyncCompletedKey)
            : nil
        return (receivedAtMs, completed)
    }
}

// Keep the read/compare/write (or delete) in one cross-process critical section.
// Network requests intentionally run outside it. A request whose starting cache
// was consumed/replaced must not resurrect or overwrite that cache on completion.
struct ChangesCacheFile {
    let url: URL
    private static let lock = NSLock()

    private func coordinate<T>(_ action: (URL) throws -> T) throws -> T {
        Self.lock.lock()
        defer { Self.lock.unlock() }
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(writingItemAt: url, error: &coordinationError) { coordinatedURL in
            result = Result { try action(coordinatedURL) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else {
            throw NSError(domain: "ChangesCache", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Cache coordination did not run"])
        }
        return try result.get()
    }

    private func read(at url: URL) throws -> CachedChanges? {
        do {
            return try JSONDecoder().decode(CachedChanges.self, from: Data(contentsOf: url))
        } catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
            return nil
        }
    }

    func read() throws -> CachedChanges? {
        try coordinate { try read(at: $0) }
    }

    func write(_ cache: CachedChanges, replacing expectedId: String?) throws {
        let data = try JSONEncoder().encode(cache)
        try coordinate { url in
            guard try read(at: url)?.handoffId == expectedId else {
                throw NSError(domain: "ChangesCache", code: 2,
                              userInfo: [NSLocalizedDescriptionKey: "Cache changed during background fetch; preserving newer state"])
            }
            try data.write(to: url, options: .atomic)
        }
    }

    func acknowledge(_ cacheId: String) throws -> Bool {
        try coordinate { url in
            guard try read(at: url)?.handoffId == cacheId else { return false }
            try FileManager.default.removeItem(at: url)
            return true
        }
    }

    func remove() throws {
        try coordinate { url in
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
        }
    }
}
