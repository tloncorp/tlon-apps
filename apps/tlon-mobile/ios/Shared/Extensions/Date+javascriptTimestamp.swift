import Foundation

extension Date {
    var javascriptTimestampFloor: Int64 {
        return Int64(floor(self.timeIntervalSince1970 * 1000.0))
    }
    
    var javascriptTimestampCeil: Int64 {
        return Int64(ceil(self.timeIntervalSince1970 * 1000.0))
    }
}
