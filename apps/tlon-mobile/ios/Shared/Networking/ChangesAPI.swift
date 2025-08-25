import Alamofire
import Foundation

extension PocketAPI {
    func fetchChangesSince(_ since: Date) async throws -> ChangesResult {
        let encodedTime = getEncodedTime(from: since)
        do {
            let data = try await fetchData("/~/scry/groups-ui/v5/changes/\(encodedTime)") as Data
            let changes = try ChangesResult(from: data)
            print("bl: got changes result", changes)
            return changes
        } catch {
            print("bl: fetch decodable threw", error)
            throw error
        }
    }
}


func getEncodedTime(from date: Date) -> String {
    let encodedTime = UrbitDate.dateToUrbitDa(date)
    print("bl: made encoded time", encodedTime)
    return encodedTime
}


// Minimal date formatting needed for hitting the API
class UrbitDate {
    
    // Constants from the Urbit system
    private static let URBIT_UNIX_EPOCH = "170141184475152167957503069145530368000" // This is ~1970.1.1 in Urbit
    private static let DA_SECOND = "18446744073709551616" // One second in Urbit time
    private static let EPOCH_YEAR: Int64 = 292277024400
    
    /// Convert a Date to Urbit date string format
    /// This is a simplified version that works for dates near our current era
    static func dateToUrbitDa(_ date: Date) -> String {
        
        // Convert to Urbit format components
        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: date)
        
        // Adjust year to Urbit epoch (which starts at a very large number)
        // For practical purposes with current dates, we can use the year directly
        let year = components.year ?? 2000
        let month = components.month ?? 1
        let day = components.day ?? 1
        let hour = components.hour ?? 0
        let minute = components.minute ?? 0
        let second = components.second ?? 0
        
        // Convert nanoseconds to Urbit ms format (4 hex groups)
        let nanos = components.nanosecond ?? 0
        let millis = nanos / 1_000_000
        
        // Create ms components as hex strings
        // Urbit uses up to 4 groups of 4 hex digits for sub-second precision
        let msHex = String(format: "%04x", millis & 0xFFFF)
        
        // Format as Urbit date string
        return String(format: "~%d.%d.%d..%d.%02d.%02d..%@",
                      year, month, day, hour, minute, second, msHex)
    }
}
