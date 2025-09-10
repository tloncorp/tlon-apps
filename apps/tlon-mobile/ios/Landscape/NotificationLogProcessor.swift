//
//  NotificationLogProcessor.swift
//  Landscape
//
//  Created by Claude Code
//

import Foundation
import PostHog

@objc
class NotificationLogProcessor: NSObject {
    private static let appGroupIdentifier = "group.tlon.Landscape"

    static func processAndSendLogs() {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            NSLog("Could not access app group UserDefaults for notification logs")
            return
        }

        guard let logs = userDefaults.array(forKey: "notificationLogs") as? [[String: Any]] else {
            return // No logs to process
        }

        if logs.isEmpty {
            return
        }

        NSLog("Processing \(logs.count) notification logs")

        // Send each log to PostHog
        for logEntry in logs {
            guard let eventName = logEntry["eventName"] as? String,
                  let properties = logEntry["properties"] as? [String: Any],
                  let timestamp = logEntry["timestamp"] as? Double else {
                continue
            }

            var postHogProperties = properties
            postHogProperties["source"] = "notification_service_extension"
            postHogProperties["timestamp"] = timestamp

            PostHogSDK.shared.capture(eventName, properties: postHogProperties)
        }

        // Clear the logs after processing
        userDefaults.removeObject(forKey: "notificationLogs")
        userDefaults.synchronize()

        NSLog("Successfully processed \(logs.count) notification logs")
    }

    @objc
    static func startPeriodicProcessing() {
        // Process logs immediately
        processAndSendLogs()

        // Set up timer to process logs every 30 seconds
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            processAndSendLogs()
        }
    }
}
