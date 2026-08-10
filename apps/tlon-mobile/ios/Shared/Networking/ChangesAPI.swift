import Alamofire
import Foundation

extension PocketAPI {
    func fetchChangesSince(_ since: Date) async throws -> ChangesResult {
        guard let encodedTime = UrbitDateFormatter.format(inputDate: since) else {
            throw APIError.invalidDateFormat
        }
        // /v10/changes embeds v10-native activity (notebook/note sources);
        // /v8 down-converts and drops them. Match the JS client so the
        // cached background window doesn't lose note unreads.
        let version = SettingsStore.activitySupportsNotes ? "v10" : "v8"
        let data = try await fetchData("/~/scry/groups-ui/\(version)/changes/\(encodedTime)") as Data
        let changes = try ChangesResult(from: data)
        return changes
    }
}
