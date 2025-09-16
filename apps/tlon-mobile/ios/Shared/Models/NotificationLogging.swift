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

                if let nsError = error as NSError? {
                    payload["errorCode"] = .int(nsError.code)
                    payload["errorDomain"] = .string(nsError.domain)
                }

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
            "api_key": UserDefaults.postHogApiKey,
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