import Foundation
import PostHog
import ExpoModulesCore

@objc
class NotificationLogProcessor: NSObject {
    @objc static let `default` = NotificationLogProcessor()
    
    private let userDefaults = UserDefaults.forDefaultAppGroup

    func processAndSendLogs() {
        guard let logs = userDefaults.dictionary(forKey: "notificationLogs") as? [String: [Data]] else {
            return // No logs to process
        }

        if logs.isEmpty {
            return
        }
        
        // Clear the logs while processing to prevent double entry
        userDefaults.removeObject(forKey: "notificationLogs")

        print("Processing notification logs for \(logs.count) user(s)")
        
        // Decode from JSON
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601 // match your encoding strategy

        // Send each log to PostHog
        for userLogs in logs {
            PostHogSDK.shared.identify(userLogs.key)
            
            for logEntry in userLogs.value {
                do {
                    let decodedEvent = try decoder.decode(LogEvent.self, from: logEntry)
                    // Convert CodableValue properties to [String: Any] for PostHog
                    PostHogSDK.shared.capture(decodedEvent.eventName, properties: decodedEvent.postHogProperties)
                } catch {
                    print("Failed to decode event: \(error)")
                }
            }
        }

        print("Successfully processed notification logs for \(logs.count) user(s)")
    }

    @objc
    func startPeriodicProcessing() {
        print("configuring posthog")
        let config = PostHogConfig(apiKey: UserDefaults.postHogApiKey, host: "https://eu.i.posthog.com")
        PostHogSDK.shared.setup(config)
        
        print("posthog setup")
        // Process logs immediately
        processAndSendLogs()

        // Set up timer to process logs every 30 seconds
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.processAndSendLogs()
        }
    }
}
