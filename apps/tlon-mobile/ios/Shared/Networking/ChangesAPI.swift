import Alamofire
import Foundation

extension PocketAPI {
    func fetchChangesSince(_ since: Date) async throws -> ChangesResult {
        guard let encodedTime = UrbitDateFormatter.format(inputDate: since) else {
            throw APIError.invalidDateFormat
        }
        let data = try await fetchData("/~/scry/groups-ui/v5/changes/\(encodedTime)") as Data
        let changes = try ChangesResult(from: data)
        return changes
    }
}
