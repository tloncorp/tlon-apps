//
//  NotificationLogger.swift
//  Landscape
//
//  Created by Claude Code
//

import Foundation

private let NOTIFICATION_SERVICE_ERROR = "Notification Service Error"
private let NOTIFICATION_SERVICE_DELIVERED = "Notification Service Delivery Successful"

class NotificationLogger {
    private static let postHogApiKey = "phc_6BDPOnBfls3Axc5WAbmN8pQKk3YqhfWoc0tXj9d9kx0"
    private static let postHogHost = "https://eu.i.posthog.com"
    private static let loginStore = LoginStore()

    static func logError(_ error: NotificationError) {
        NSLog("NotificationLogger.logError called with uid: \(error.uid)")
        sendToPostHog(events: [LogEvent.error(error)])
    }

    static func logDelivery(properties: [String: Any] = [:]) {
        NSLog("NotificationLogger.logDelivery called with properties: \(properties)")
        sendToPostHog(events: [LogEvent.delivery(properties)])
    }

    static func sendToPostHog(events: [LogEvent]) {
        // Send directly to PostHog REST API
        guard let url = URL(string: "\(postHogHost)/batch/") else {
            NSLog("Invalid PostHog URL")
            fallbackToUserDefaults(events: events)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10.0 // 10 second timeout

        // Generate a unique distinct_id for the notification service extension
        // UIDevice is not available in notification service extensions, so use bundle identifier
        let bundleId = Bundle.main.bundleIdentifier ?? "unknown"

        guard let distinctId = try? loginStore.read()?.shipName else {
            NSLog("Unable to find ship")
            return
        }

        let eventData: [[String: Any]] = prepEvents(distinctId: distinctId, events: events)

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: eventData)
            request.httpBody = jsonData

            let eventNames = eventData.map({ $0["eventName"] })
            NSLog("Sending events to PostHog: \(eventNames)")

            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    NSLog("PostHog request failed: \(error.localizedDescription)")
                    // Fallback to UserDefaults for main app to process later
                    fallbackToUserDefaults(events: events)
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        NSLog("✅ Successfully sent events to PostHog: \(eventNames)")
                    } else {
                        NSLog("❌ PostHog request failed with status: \(httpResponse.statusCode)")
                        if let data = data, let responseString = String(data: data, encoding: .utf8) {
                            NSLog("Response body: \(responseString)")
                        }
                        // Fallback to UserDefaults for main app to process later
                        fallbackToUserDefaults(events: events)
                    }
                }
            }

            task.resume()
        } catch {
            NSLog("Failed to serialize PostHog event data: \(error.localizedDescription)")
            fallbackToUserDefaults(events: events)
        }
    }

    // Fallback to UserDefaults if direct PostHog call fails
    private static func fallbackToUserDefaults(events: [LogEvent]) {
        NSLog("Using UserDefaults fallback for events")

        guard let userDefaults = UserDefaults(suiteName: "group.tlon.Landscape") else {
            NSLog("Could not access app group UserDefaults for fallback")
            return
        }

        let logEntries: [[String: Any]] = events.map({
            let eventName = switch $0 {
            case .error:
                NOTIFICATION_SERVICE_ERROR
            case .delivery:
                NOTIFICATION_SERVICE_DELIVERED
            }

            let properties = switch $0 {
            case .error(let error):
                getLogPayload(error: error)
            case .delivery(let properties):
                properties
            }

            return [
                "timestamp": Date().timeIntervalSince1970,
                "eventName": eventName,
                "properties": properties
            ]
        })

        // Get existing logs
        var existingLogs = userDefaults.array(forKey: "notificationLogs") as? [[String: Any]] ?? []

        // Append new log entry
        existingLogs.append(contentsOf: logEntries)

        // Keep only recent logs (last 100 entries to prevent from growing too large)
        if existingLogs.count > 100 {
            existingLogs = Array(existingLogs.suffix(100))
        }

        // Save back to UserDefaults
        userDefaults.set(existingLogs, forKey: "notificationLogs")
        userDefaults.synchronize()

        NSLog("Events saved to UserDefaults for later processing")
    }

    private static func prepEvents(distinctId: String, events: [LogEvent]) -> [[String: Any]] {
        events.map({
            switch $0 {
            case .error(let error):
                let properties = getLogPayload(error: error)
                return constructPostHogEvent(distinctId: distinctId, eventName: NOTIFICATION_SERVICE_ERROR, properties: properties)
            case .delivery(let properties):
                return constructPostHogEvent(distinctId: distinctId, eventName: NOTIFICATION_SERVICE_DELIVERED, properties: properties)
            }
        })
    }

    private static func constructPostHogEvent(distinctId: String, eventName: String, properties: [String: Any]) -> [String: Any] {
        return [
            "api_key": postHogApiKey,
            "event": eventName,
            "properties": properties.merging([
                "source": "notification_service_extension",
                "$lib": "ios-notification-extension",
                "$lib_version": "1.0.0"
            ]) { (_, new) in new },
            "distinct_id": distinctId,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }
}

func getLogPayload(error: NotificationError) -> [String: Any] {
    var payload: [String: Any] = [
        "uid": error.uid,
        "message": error.message,
        "errorMessage": error.localizedDescription,
        "errorType": String(describing: type(of: error))
    ]

    if let nsError = error as NSError? {
        payload["errorCode"] = nsError.code
        payload["errorDomain"] = nsError.domain
    }

    return payload
}

enum LogEvent {
    case error(NotificationError)
    case delivery([String: Any])
}

// Custom error types for iOS notifications
class NotificationError: NSError {
    let uid: String
    let message: String

    init(uid: String, message: String, code: Int = 0, underlyingError: Error? = nil) {
        self.uid = uid
        self.message = message
        super.init(
            domain: "com.tlon.landscape.notifications",
            code: code,
            userInfo: [
                NSLocalizedDescriptionKey: message,
                "uid": uid,
                NSUnderlyingErrorKey: underlyingError as Any
            ]
        )
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

class ActivityEventFetchFailed: NotificationError {
    init(uid: String, underlyingError: Error? = nil) {
        super.init(uid: uid, message: "Activity event fetch failed", code: 1001, underlyingError: underlyingError)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

class ActivityEventMissing: NotificationError {
    init(uid: String) {
        super.init(uid: uid, message: "Activity event is missing", code: 1002)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

class PreviewRenderFailed: NotificationError {
    let activityEvent: String

    init(uid: String, activityEvent: String, underlyingError: Error? = nil) {
        self.activityEvent = activityEvent
        super.init(uid: uid, message: "Preview render failed", code: 1003, underlyingError: underlyingError)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

class PreviewEmpty: NotificationError {
    let activityEvent: String

    init(uid: String, activityEvent: String) {
        self.activityEvent = activityEvent
        super.init(uid: uid, message: "Preview is empty", code: 1004)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

class NotificationDisplayFailed: NotificationError {
    let activityEvent: String?

    init(uid: String, activityEvent: String? = nil, underlyingError: Error? = nil) {
        self.activityEvent = activityEvent
        super.init(uid: uid, message: "Notification display failed", code: 1005, underlyingError: underlyingError)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
