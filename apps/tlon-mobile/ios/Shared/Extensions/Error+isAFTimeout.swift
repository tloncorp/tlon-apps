import Foundation

extension Error {
    var isAFTimeout: Bool {
        guard let afError = asAFError else {
            return false
        }

        return afError.isSessionTaskError && (afError.underlyingError as? NSError)?.code == NSURLErrorTimedOut
    }
}
