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
    case invalidURL
    case invalidParams
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
        case .invalidURL:
            return "Invalid URL provided"
        case .invalidParams:
            return "Invalid parameters provided"
        }
    }
}

final class UrbitAPI {
    static let shared = UrbitAPI()

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
        let dataTask = AF.request(request).serializingData(automaticallyCancelling: true)
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
        if let error = response.error {
            if let statusCode = response.response?.statusCode {
                if statusCode == 403 {
                    throw APIError.forbidden
                }

                if statusCode == 404 {
                    throw APIError.notFound
                }
            }

            throw error
        }

        let value = try await dataTask.value
        return value
    }
}
