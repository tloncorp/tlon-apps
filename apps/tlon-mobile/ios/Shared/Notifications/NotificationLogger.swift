import Foundation

class NotificationLogger {
    static let postHogApiKey = UserDefaults.postHogApiKey
    private static let postHogHost = "https://eu.i.posthog.com"
    private static let loginStore = LoginStore()

    static func logError(_ error: NotificationError) {
        print("NotificationLogger.logError called with uid: \(error.uid)")
        sendToPostHog(events: [LogEventData.error(error)])
    }

    static func logDelivery(properties: [String: CodableValue] = [:]) {
        print("NotificationLogger.logDelivery called with properties: \(properties)")
        sendToPostHog(events: [LogEventData.delivery(properties)])
    }

    static func sendToPostHog(events: [LogEventData]) {
        guard let userId = try? loginStore.read()?.shipName else {
            print("Unable to find ship")
            return
        }
        
        // Send directly to PostHog REST API
        guard let url = URL(string: "\(postHogHost)/batch/") else {
            print("Invalid PostHog URL")
            fallbackToUserDefaults(userId: userId, events: events)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10.0 // 10 second timeout

        // Generate a unique distinct_id for the notification service extension
        // UIDevice is not available in notification service extensions, so use bundle identifier
        let bundleId = Bundle.main.bundleIdentifier ?? "unknown"

        let eventData: [[String: Any]] = events.map({
            return LogEvent(userId: userId, data: $0).asPostHogEvent
        })

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: eventData)
            request.httpBody = jsonData

            let eventNames = eventData.map({ $0["event"] })
            print("Sending events to PostHog: \(eventNames)")

            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("PostHog request failed: \(error.localizedDescription)")
                    // Fallback to UserDefaults for main app to process later
                    fallbackToUserDefaults(userId: userId, events: events)
                    return
                }

                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        print("✅ Successfully sent events to PostHog: \(eventNames)")
                    } else {
                        print("❌ PostHog request failed with status: \(httpResponse.statusCode)")
                        if let data = data, let responseString = String(data: data, encoding: .utf8) {
                            print("Response body: \(responseString)")
                        }
                        // Fallback to UserDefaults for main app to process later
                        fallbackToUserDefaults(userId: userId, events: events)
                    }
                }
            }

            task.resume()
        } catch {
            print("Failed to serialize PostHog event data: \(error.localizedDescription)")
            fallbackToUserDefaults(userId: userId, events: events)
        }
    }

    // Fallback to UserDefaults if direct PostHog call fails
    private static func fallbackToUserDefaults(userId: String, events: [LogEventData]) {
        print("Using UserDefaults fallback for events")

        guard let userDefaults = UserDefaults(suiteName: "group.tlon.Landscape") else {
            print("Could not access app group UserDefaults for fallback")
            return
        }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        let logEntries: [Data] = events.compactMap({
            do {
                let event = LogEvent(userId: userId, data: $0)
                return try encoder.encode(event)
            } catch {
                print("Unable to encode LogEvent")
                return nil
            }
        })
        
        // Get existing logs
        var existingLogs = userDefaults.dictionary(forKey: "notificationLogs") as? [String: [Data]] ?? [:]
        
        // Get existing logs for user (or empty array if none)
        var userLogs = existingLogs[userId] ?? []

        // Append new log entries
        userLogs.append(contentsOf: logEntries)

        // Update the dictionary
        existingLogs[userId] = if userLogs.count > 100 {
            Array(userLogs.suffix(100))
        } else {
            userLogs
        }
        
        // Save back to UserDefaults
        userDefaults.set(existingLogs, forKey: "notificationLogs")
        
        print("Events saved to UserDefaults for later processing")
    }
}

