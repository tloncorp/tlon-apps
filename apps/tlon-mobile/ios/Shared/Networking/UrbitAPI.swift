//
//  UrbitAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 7/14/22.
//

import Alamofire
import Foundation

enum APIError: Error {
    case unknownShip
    case forbidden
    case notFound
    case httpError(statusCode: Int)
    case invalidURL
    case invalidParams
    case invalidDateFormat
}

extension APIError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .unknownShip:
            return "Unkown ship"
        case .forbidden:
            return "User forbidden"
        case .notFound:
            return "Not found"
        case .httpError(let statusCode):
            return "Request failed with status \(statusCode)"
        case .invalidURL:
            return "Invalid URL provided"
        case .invalidParams:
            return "Invalid parameters provided"
        case .invalidDateFormat:
            return "Invalid @da received from JS"
        }
    }
}

extension APIError {
    var statusCode: Int? {
        switch self {
        case .forbidden: return 403
        case .notFound: return 404
        case .httpError(let statusCode): return statusCode
        case .unknownShip, .invalidURL, .invalidParams, .invalidDateFormat: return nil
        }
    }
}

extension Error {
    /// HTTP status behind this error, when it came from a response. Neither our
    /// own `APIError` nor Alamofire puts it in `localizedDescription`, so it is
    /// lost unless a caller asks for it.
    var httpStatusCode: Int? {
        if let apiError = self as? APIError {
            return apiError.statusCode
        }

        return asAFError?.responseCode
    }
}

final class UrbitAPI {
    static let shared = UrbitAPI()

    let session = Session.withSharedCookieStorage()

    private enum State {
        case closed
        case open
        case opening
        case error
    }

    private var channelURL: URL?
    private var state = State.closed
    private var lastEventId: UInt = 0

    private var nextEventId: UInt {
        lastEventId += 1
        return lastEventId
    }

    private func send(with parameters: Parameters, eventId: UInt? = nil) async throws -> (UInt, Data) {
        guard let channelURL else {
            throw APIError.unknownShip
        }

        let eventId = eventId ?? nextEventId

        var parameters = parameters
        parameters.updateValue(eventId, forKey: "id")
        if let shipName = try? LoginStore().read()?.shipName {
            parameters.updateValue(shipName.replacingOccurrences(of: "~", with: ""), forKey: "ship")
        }

        var request = URLRequest(url: channelURL)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [parameters])
        request.timeoutInterval = 30
        let dataTask = session.request(request).serializingData(automaticallyCancelling: true)
        return try await (eventId, processDataTask(dataTask))
    }

    func open(for shipURL: String) async throws {
        if state == .open || state == .opening {
            print("Skipping already open event source")
            return
        }

        let uid = "\(UInt(Date().timeIntervalSince1970))-\(String(format: "%06X", arc4random_uniform(UInt32(UInt16.max))).lowercased())"
        guard let channelURL = URL(string: "\(shipURL)/~/channel/\(uid)") else {
            throw APIError.unknownShip
        }

        state = .opening
        lastEventId = 0
        self.channelURL = channelURL

        // Open airlock on this channel URL
        _ = try await poke(app: "hood", mark: "helm-hi", json: "opening airlock")
    }

    func close() async throws {
        _ = try await send(with: ["action": "delete"])
        channelURL = nil
    }

    func poke(app: String, mark: String, json: Any) async throws -> Data {
        let (_, data) = try await send(with: [
            "action": "poke",
            "app": app,
            "mark": mark,
            "json": json,
        ])
        return data
    }

    func processDataTask<T>(_ dataTask: DataTask<T>) async throws -> T {
        let response = await dataTask.response

        // Nothing here calls `.validate()`, so a failing status with a body in it
        // — an urbit login page on a 403, a proxy's 502 page — serializes as
        // happily as a real one. Judge the status before the serializer gets a
        // vote, or those come back as success and fail later as a parse error
        // that says nothing about the status.
        if let statusCode = response.response?.statusCode, !(200..<300).contains(statusCode) {
            switch statusCode {
            case 403: throw APIError.forbidden
            case 404: throw APIError.notFound
            default: throw APIError.httpError(statusCode: statusCode)
            }
        }

        // A 2xx that still errored is a serialization failure; that error says
        // what failed to decode, so it is the one worth keeping.
        if let error = response.error {
            throw error
        }

        let value = try await dataTask.value
        return value
    }
}
