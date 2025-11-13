import Foundation

private let NOTIFICATION_SERVICE_ERROR = "Notification Service Error"
private let NOTIFICATION_SERVICE_DELIVERED = "Notification Service Delivery Successful"

enum LogEventData {
    case error(NotificationError)
    case delivery([String: CodableValue])
}

enum CodableValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null

    // Convert CodableValue to Any for PostHog
    var anyValue: Any {
        switch self {
        case .string(let value): return value
        case .int(let value): return value
        case .double(let value): return value
        case .bool(let value): return value
        case .null: return NSNull()
        }
    }
}

struct LogEvent: Codable {
    let userId: String
    let createdAt: Date
    let eventName: String
    let properties: [String: CodableValue]

    // Convert properties to [String: Any] for PostHog
    var postHogProperties: [String: Any] {
        return properties.mapValues { $0.anyValue }
    }
}

extension LogEvent {
    init(userId: String, data: LogEventData) {
        self.createdAt = Date()
        self.userId = userId
        self.eventName = switch data {
        case .error: NOTIFICATION_SERVICE_ERROR
        case .delivery: NOTIFICATION_SERVICE_DELIVERED
        }

        self.properties = switch data {
            case .delivery(let properties):
                properties
            case .error(let error): {
                var payload: [String: CodableValue] = [
                    "uid": .string(error.uid),
                    "message": .string(error.message),
                    "errorMessage": .string(error.localizedDescription),
                    "errorType": .string(String(describing: type(of: error)))
                ]
                
                return payload
            }()
        }
    }

    init(userId: String, properties: [String: CodableValue]) {
        self.createdAt = Date()
        self.userId = userId
        self.eventName = NOTIFICATION_SERVICE_DELIVERED
        self.properties = properties
    }

    var asPostHogEvent: [String: Any] {
        [
            "event": eventName,
            "properties": properties.merging([
                "source": .string("notification_service_extension"),
                "$lib": .string("ios-notification-extension"),
                "$lib_version": .string("1.0.0")
            ]) { (_, new) in new }.mapValues { $0.anyValue },
            "distinct_id": userId,
            "timestamp": ISO8601DateFormatter().string(from: createdAt)
        ]
    }
}

enum NotificationError: Error, LocalizedError {
    case activityEventFetchFailed(uid: String, underlyingError: Error? = nil)
    case activityEventMissing(uid: String, underlyingError: Error? = nil)
    case badgeSettingFailed(uid: String, underlyingError: Error? = nil)
    case previewRenderFailed(uid: String, activityEvent: String, underlyingError: Error? = nil)
    case previewEmpty(uid: String, activityEvent: String, underlyingError: Error? = nil)
    case notificationDisplayFailed(uid: String, activityEvent: String? = nil, underlyingError: Error? = nil)
    case notificationDismissalFailed(uid: String, activityEvent: String?, underlyingError: Error? = nil)
    case unknown(uid: String, message: String = "Unknown notification processing error", underlyingError: Error? = nil)
    
    var message: String {
        switch self {
        case .activityEventFetchFailed: return "Activity event fetch failed"
        case .activityEventMissing: return "Activity event is missing"
        case .badgeSettingFailed: return "Setting badge from dismissal failed"
        case .previewRenderFailed: return "Preview render failed"
        case .previewEmpty: return "Preview is empty"
        case .notificationDisplayFailed: return "Notification display failed"
        case .notificationDismissalFailed: return "Notification dismissal failed"
        case .unknown(_, let message, _): return message
        }
    }
    
    var uid: String {
        switch self {
        case .activityEventFetchFailed(let uid, _),
             .activityEventMissing(let uid, _),
             .badgeSettingFailed(let uid, _),
             .previewRenderFailed(let uid, _, _),
             .previewEmpty(let uid, _, _),
             .notificationDisplayFailed(let uid, _, _),
             .notificationDismissalFailed(let uid, _, _),
             .unknown(let uid, _, _):
            return uid
        }
    }

    var localizedDescription: String? {
        switch self {
        case .activityEventFetchFailed(_, let underlyingError),
             .activityEventMissing(_, let underlyingError),
             .badgeSettingFailed(_, let underlyingError),
             .previewRenderFailed(_, _, let underlyingError),
             .previewEmpty(_, _, let underlyingError),
             .notificationDisplayFailed(_, _, let underlyingError),
             .notificationDismissalFailed(_, _, let underlyingError),
             .unknown(_, _, let underlyingError):
            return underlyingError?.localizedDescription
        }
    }
}
