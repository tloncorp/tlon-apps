import Foundation

class ChangesLoader {

    private static let appGroupIdentifier = "group.io.tlon.groups"
    private static let sharedFileName = "changes_cache.json"
    private static let lastSyncKey = "changesSyncedAt"
    
    static func setLastSyncTimestamp(_ date: Date?) throws {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            throw NSError(domain: "ChangesLoader", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not access shared UserDefaults"])
        }
        
        if let date = date {
            sharedDefaults.set(date, forKey: lastSyncKey)
            print("[ChangesLoader] Stored sync timestamp: \(date)")
        } else {
            sharedDefaults.removeObject(forKey: lastSyncKey)
            print("[ChangesLoader] Cleared sync timestamp")
        }
    }

    private static func getLastSyncTimestamp() -> Date? {
        let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier)
        
        if let storedDate = sharedDefaults?.object(forKey: lastSyncKey) as? Date {
            print("[ChangesLoader] Reading stored sync timestamp: \(storedDate)")
            return storedDate
        } else {
            print("[ChangesLoader] No stored timestamp found")
            return nil
        }
    }

    private static func getFileURL() throws -> URL {
        guard let sharedContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw NSError(domain: "ChangesLoader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find shared App Group container."])
        }
        return sharedContainerURL.appendingPathComponent(sharedFileName)
    }
    
    private static func readCachedChanges() throws -> CachedChanges? {
        let fileURL = try getFileURL()
        
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(CachedChanges.self, from: data)
    }
    
    private static func writeCachedChanges(_ cached: CachedChanges) throws {
        let fileURL = try getFileURL()
        let encodedData = try JSONEncoder().encode(cached)
        try encodedData.write(to: fileURL, options: [.atomic])
        print("[ChangesLoader] Successfully wrote cached changes to disk.")
    }
    
    private static func deleteCachedChanges() throws {
        let fileURL = try getFileURL()
        
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
            print("[ChangesLoader] Successfully deleted cached changes from disk.")
        }
    }
    
    static func sync() async throws {
        print("[ChangesLoader] Syncing...")
        let now = Date()
        
        if let cached = try readCachedChanges() {
            print("[ChangesLoader] Found cached changes, appending...")
            let newChanges = try await PocketAPI.shared.fetchChangesSince(cached.endTimestamp)
            let oldChanges = try cached.getChanges()
            let merged = oldChanges.merge(with: newChanges)
            try writeCachedChanges(
                CachedChanges(
                    begin: cached.beginTimestamp,
                    end: now,
                    changes: merged
                )
            )
            print("[ChangesLoader] Successfully updated cached changes.")
            return
        }
        
        print("[ChangesLoader] No cached changes found, looking for last sync timestamp...")
        if let lastSyncedAt = getLastSyncTimestamp() {
            print("[ChangesLoader] Found last sync timestamp, fetching changes...")
            let fetchedChanges = try await PocketAPI.shared.fetchChangesSince(lastSyncedAt)
            try writeCachedChanges(
                CachedChanges(
                    begin: lastSyncedAt,
                    end: now,
                    changes: fetchedChanges
                )
            )
            print("[ChangesLoader] Successfully wrote changes.")
        }
    }
    
    static func retrieve() throws -> Data? {
        guard let cached = try readCachedChanges() else {
            return nil
        }
        
        let jsonData = try cached.toJSON()
        try deleteCachedChanges()
        return jsonData
    }
}
