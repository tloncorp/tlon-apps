import Foundation

class NotificationLogger {
    static let postHogApiKey = UserDefaults.postHogApiKey
    private static let postHogHost = "https://eu.i.posthog.com"
    private static let loginStore = LoginStore()
    private static let userDefaults = UserDefaults.forDefaultAppGroup

    static func logError(_ error: NotificationError) async {
        print("NotificationLogger.logError called with uid: \(error.uid)")
        await sendToPostHog(events: [LogEventData.error(error)])
    }

    static func logDelivery(properties: [String: CodableValue] = [:]) async {
        print("NotificationLogger.logDelivery called with properties: \(properties)")
        await sendToPostHog(events: [LogEventData.delivery(properties)])
    }

    static func sendToPostHog(events: [LogEventData]) async {
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

        let eventData: [[String: Any]] = events.map({
            return LogEvent(userId: userId, data: $0).asPostHogEvent
        })
        
        let payload: [String: Any] = [
            "api_key": postHogApiKey,
            "batch": eventData
        ]
        
        let eventNames = eventData.map({ $0["event"] })
        print("Sending events to PostHog: \(eventNames)")

        do {
            try await makePostHogRequest(url: url, payload: payload)
        } catch {
            print("Failed to serialize PostHog event data: \(error.localizedDescription)")
            fallbackToUserDefaults(userId: userId, events: events)
        }
    }
    
    private static func makePostHogRequest(url: URL, payload: [String: Any]) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10.0 // 10 second timeout
        
        let jsonData = try JSONSerialization.data(withJSONObject: payload)
        request.httpBody = jsonData
        
        let ( data, response ) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse {
            if httpResponse.statusCode == 200 {
                print("✅ Successfully sent events to PostHog")
            } else {
                print("❌ PostHog request failed with status: \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    print("Response body: \(responseString)")
                }
                throw PostHogError.errorResponse
            }
        }
    }

    // Fallback to UserDefaults if direct PostHog call fails
    private static func fallbackToUserDefaults(userId: String, events: [LogEventData]) {
        print("Using UserDefaults fallback for events")

        let encoder = JSONEncoder()
        let logEntries: [Data] = events.compactMap({
            try? encoder.encode(LogEvent(userId: userId, data: $0))
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

enum PostHogError: Error {
    case requestFailed
    case errorResponse
}
