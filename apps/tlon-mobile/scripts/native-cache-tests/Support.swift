import Foundation

// Only app/network dependencies are stubbed. The cache, coordinator, merge,
// serialization, and error event implementations are compiled from production.
extension UserDefaults {
    static var forDefaultAppGroup: UserDefaults { .standard }
}

class PocketAPI {
    static let shared = PocketAPI()
    func fetchChangesSince(_: Date) async throws -> ChangesResult {
        fatalError("File/merge regression tests must not make network requests")
    }
}

extension Error {
    var httpStatusCode: Int? { nil }
}
