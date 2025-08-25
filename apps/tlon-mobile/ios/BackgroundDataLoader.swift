import Foundation
import React

@objc(BackgroundDataLoader)
class BackgroundDataLoader: NSObject {
  
    private let appGroupIdentifier = "group.io.tlon.groups"
    private let sharedFileName = "shared_data.json"
        
    @objc
    override init() {
        super.init()
    }

    @objc
    static func constantsToExport() -> [AnyHashable : Any] {
        return ["appGroupIdentifier": "group.io.tlon.groups"]
    }

    @objc(retrieveBackgroundData:rejecter:)
    func retrieveBackgroundData(resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        Task {
            do {
                let changes = try ChangesLoader.retrieve()
                
                if let changesData = changes, let jsonString = String(data: changesData, encoding: .utf8) {
                    resolve(jsonString)
                } else {
                    resolve(nil)
                }
            } catch {
                reject("retreive_error", error.localizedDescription, error)            }
        }
    }
    
    @objc(setLastSyncTimestamp:resolver:rejecter:)
        func setLastSyncTimestamp(timestamp: NSNumber?,
                                 resolver resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
            do {
                let date = timestamp.map { Date(timeIntervalSince1970: $0.doubleValue / 1000.0) }
                try ChangesLoader.setLastSyncTimestamp(date)
                resolve(true)
            } catch {
                reject("storage_error", error.localizedDescription, error)
            }
        }
}

