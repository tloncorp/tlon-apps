import Foundation
import React

@objc(BackgroundDataLoader)
class BackgroundDataLoader: NSObject {
  
    private let appGroupIdentifier = "group.io.tlon.groups"
    private let sharedFileName = "shared_data.json"
        
    // A standard initializer for Objective-C bridging
    @objc
    override init() {
        super.init()
    }

    // `ConstantsToExport` allows us to expose data to React Native without a method call.
    @objc
    static func constantsToExport() -> [AnyHashable : Any] {
        return ["appGroupIdentifier": "group.io.tlon.groups"]
    }

    // The main method to retrieve data from the shared file.
    // This is the method you will call from React Native.
    @objc(retrieveBackgroundData:rejecter:)
    func retrieveBackgroundData(resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        Task {
            do {
                try await ChangesLoader.sync()
                print("bl: synced changes")
                let changes = try ChangesLoader.retrieve()
                print("bl: retreived changes")
                
                if let changesData = changes, let jsonString = String(data: changesData, encoding: .utf8) {
                    resolve(jsonString)
                } else {
                    resolve(nil)
                }
            } catch {
                reject("test_setup_error", "Failed to perform sync and retrieve.", error)            }
        }
    }
}

