import Foundation

class ChangesLoader {
    private static let sharedFileName = "changes_cache.json"
    private static let lastSyncKey = "changesSyncedAt"
    private static let coordinator = NSFileCoordinator()
    
    static func setLastSyncTimestamp(_ date: Date?) throws {
        let sharedDefaults = UserDefaults.forDefaultAppGroup
        
        if let date = date {
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
    
    private static func readCachedChanges() throws -> CachedChanges? {
        let fileURL = try getFileURL()
        var readError: NSError?
        var thrownError: Error?
        var cachedChanges: CachedChanges?
        
        coordinator.coordinate(readingItemAt: fileURL, error: &readError) { url in
            do {
                let data = try Data(contentsOf: fileURL)
                cachedChanges = try JSONDecoder().decode(CachedChanges.self, from: data)
                print("[ChangesLoader] Successfully read cached changes from disk.")
            } catch let error as NSError where error.code == NSFileReadNoSuchFileError {
                cachedChanges = nil
            } catch {
                thrownError = error
            }
        }
        
        if let error = readError {
            throw error
        }
        
        if let error = thrownError {
             throw error
        }
        
        return cachedChanges
    }
    
    private static func writeCachedChanges(_ cached: CachedChanges) throws {
        let fileURL = try getFileURL()
        var readError: NSError?
        var writeError: Error?
        let encodedData = try JSONEncoder().encode(cached)
        
        coordinator.coordinate(writingItemAt: fileURL, error: &readError) { url in
            do {
                try encodedData.write(to: url, options: [.atomic])
                print("[ChangesLoader] Successfully wrote cached changes to disk.")
            } catch {
                writeError = error
            }
        }
        
        if let error = readError {
            throw error
        }
        
        if  let error = writeError {
            throw error
        }
    }
    
    private static func deleteCachedChanges() throws {
        let fileURL = try getFileURL()
        var readError: NSError?
        var deleteError: Error?
        
        coordinator.coordinate(writingItemAt: fileURL, error: &readError) { url in
            do {
                let fm = FileManager.default
                if fm.fileExists(atPath: url.path) {
                    do {
                        try fm.removeItem(at: url)
                        print("[ChangesLoader] Successfully deleted changes from disk.")
                    } catch {
                        deleteError = error
                    }
                }
            }
        }
        
        if let error = readError {
            throw error
        }
        
        if let error = deleteError {
            throw error
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
