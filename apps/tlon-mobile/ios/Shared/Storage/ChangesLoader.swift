//
//  ChangesLoader.swift
//  Landscape
//
//  Created by brian. on 8/24/25.
//

import Foundation

class ChangesLoader {

    private static let appGroupIdentifier = "group.io.tlon.groups"
    private static let sharedFileName = "shared_data.json"
    
    static func sync() async throws {
        let oneDayInSeconds: TimeInterval = 24 * 60 * 60
        let dateOneDayAgo = Date(timeIntervalSinceNow: -oneDayInSeconds)
        print("bl: syncing changes since", dateOneDayAgo)
        let changesResult = try await PocketAPI.shared.fetchChangesSince(dateOneDayAgo)

        
        guard let sharedContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw NSError(domain: "ChangesLoader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find shared App Group container."])
        }
        
        // 1. Convert the dictionary to JSON Data
        let jsonData = try changesResult.toJSONData()
        let fileURL = sharedContainerURL.appendingPathComponent(sharedFileName)
        
        // 2. Write the JSON data to the file
        try jsonData.write(to: fileURL, options: [.atomic])
        print("✅ [ChangesLoader] Successfully wrote data to shared file.")
    }
    
    static func retrieve() throws -> Data? {
        guard let sharedContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw NSError(domain: "ChangesLoader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find shared App Group container."])
        }
        
        let fileURL = sharedContainerURL.appendingPathComponent(sharedFileName)
        
        // Check if the file exists before attempting to read it
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        
        let data = try Data(contentsOf: fileURL)
        
        // Clean up the file after reading it to ensure it's a one-time process.
        try FileManager.default.removeItem(at: fileURL)
        print("✅ [ChangesLoader] Successfully read and deleted shared file.")
        
        return data
    }
}
