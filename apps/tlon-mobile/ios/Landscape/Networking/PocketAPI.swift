//
//  PocketAPI.swift
//  Pocket
//
//  Created by Alec Ananian on 8/11/22.
//

import Alamofire
import Foundation

class PocketAPI {
    private static let loginStore = LoginStore()

    static func fetchDecodable<T: Decodable>(_ path: String, timeoutInterval: TimeInterval = 10, retries: Int = 0) async throws -> T {
        guard let shipURL = try? loginStore.read()?.shipUrl else {
            throw APIError.unknownShip
        }

        do {
            let dataTask = AF.request(shipURL + path + ".json") { $0.timeoutInterval = timeoutInterval }
                .serializingDecodable(T.self, automaticallyCancelling: true)
            return try await UrbitAPI.shared.processDataTask(dataTask)
        } catch {
            if retries < 3, error.isAFTimeout {
                return try await fetchDecodable(path, timeoutInterval: timeoutInterval, retries: retries + 1)
            }

            throw error
        }
    }

    static func fetchData(_ path: String, timeoutInterval: TimeInterval = 10, retries: Int = 0) async throws -> Data {
        guard let shipURL = try? loginStore.read()?.shipUrl else {
            throw APIError.unknownShip
        }

        do {
            let dataTask = AF.request(shipURL + path + ".json") { $0.timeoutInterval = timeoutInterval }
                .serializingData(automaticallyCancelling: true)
            return try await UrbitAPI.shared.processDataTask(dataTask)
        } catch {
            if retries < 3, error.isAFTimeout {
                return try await fetchData(path, timeoutInterval: timeoutInterval, retries: retries + 1)
            }

            throw error
        }
    }
}
