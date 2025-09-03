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
    private static let appGroupIdentifier = "group.tlon.Landscape"
    private static let logFileName = "notification_logs.json"
    
    static func logError(_ error: NotificationError) {
        let properties = getLogPayload(uid: error.uid, message: error.message, error: error)
        log(eventName: NOTIFICATION_SERVICE_ERROR, properties: properties)
    }
    
    static func logDelivery(properties: [String: Any] = [:]) {
        log(eventName: NOTIFICATION_SERVICE_DELIVERED, properties: properties)
    }
    
    private static func log(eventName: String, properties: [String: Any] = [:]) {
        // Write to shared UserDefaults that main app can read and send to PostHog
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            NSLog("Could not access app group UserDefaults")
            return
        }
        
        let logEntry: [String: Any] = [
            "timestamp": Date().timeIntervalSince1970,
            "eventName": eventName,
            "properties": properties
        ]
        
        // Get existing logs
        var existingLogs = userDefaults.array(forKey: "notificationLogs") as? [[String: Any]] ?? []
        
        // Append new log entry
        existingLogs.append(logEntry)
        
        // Keep only recent logs (last 100 entries to prevent from growing too large)
        if existingLogs.count > 100 {
            existingLogs = Array(existingLogs.suffix(100))
        }
        
        // Save back to UserDefaults
        userDefaults.set(existingLogs, forKey: "notificationLogs")
        userDefaults.synchronize()
        
        NSLog("Notification log written: \(eventName), \(properties)")
    }
}

func getLogPayload(uid: String, message: String, error: Error? = nil) -> [String: Any] {
    var payload: [String: Any] = [
        "uid": uid,
        "message": message
    ]
    
    if let error = error {
        payload["errorMessage"] = error.localizedDescription
        payload["errorType"] = String(describing: type(of: error))
        
        if let nsError = error as NSError? {
            payload["errorCode"] = nsError.code
            payload["errorDomain"] = nsError.domain
        }
    }
    
    return payload
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
