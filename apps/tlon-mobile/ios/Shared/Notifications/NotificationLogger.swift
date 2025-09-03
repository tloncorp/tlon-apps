//
//  NotificationLogger.swift
//  Landscape
//
//  Created by Claude Code
//

import Foundation
import PostHog

private let NOTIFICATION_SERVICE_ERROR = "Notification Service Error"
private let NOTIFICATION_SERVICE_DELIVERED = "Notification Service Delivery Successful"

class NotificationLogger {
    private static var isPostHogInitialized = false
    private static let initLock = NSLock()
    
    static func logError(_ error: NotificationError) {
        let properties = getLogPayload(uid: error.uid, message: error.message, error: error)
        log(eventName: NOTIFICATION_SERVICE_ERROR, properties: properties)
    }
    
    static func logDelivery(properties: [String: Any] = [:]) {
        log(eventName: NOTIFICATION_SERVICE_DELIVERED, properties: properties)
    }
    
    private static func ensurePostHogInitialized() {
        initLock.lock()
        defer { initLock.unlock() }
        
        guard !isPostHogInitialized else { return }
        
        do {
            // Get PostHog API key from Expo constants (similar to Android implementation)
            guard let constantsPath = Bundle.main.path(forResource: "app", ofType: "config"),
                  let constantsData = NSData(contentsOfFile: constantsPath),
                  let constantsJson = try JSONSerialization.jsonObject(with: constantsData as Data) as? [String: Any],
                  let extra = constantsJson["extra"] as? [String: Any],
                  let apiKey = extra["postHogApiKey"] as? String,
                  !apiKey.isEmpty else {
                NSLog("PostHog API key not found in Expo constants, skipping initialization")
                return
            }
            
            let config = PostHogConfig(
                apiKey: apiKey,
                host: "https://data-bridge-v1.vercel.app/ingest"
            )
            PostHogSDK.shared.setup(config)
            isPostHogInitialized = true
            NSLog("PostHog initialized in notification service with key from Expo constants")
        } catch {
            NSLog("Failed to initialize PostHog in notification service: \(error)")
        }
    }
    
    private static func log(eventName: String, properties: [String: Any] = [:]) {
        ensurePostHogInitialized()
        
        do {
            PostHogSDK.shared.capture(eventName, properties: properties)
            NSLog("PostHog event captured: \(eventName), \(properties)")
        } catch {
            NSLog("PostHog fallback - Event: \(eventName), Properties: \(properties), Error: \(error)")
        }
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
