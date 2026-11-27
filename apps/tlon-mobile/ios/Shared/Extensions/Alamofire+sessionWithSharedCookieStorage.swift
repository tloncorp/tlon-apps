import Alamofire
import Foundation

extension HTTPCookieStorage {
    @objc class func forDefaultAppGroup() -> HTTPCookieStorage {
        guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "TlonDefaultAppGroup") as? String else {
            fatalError("Missing required plist entry: TlonDefaultAppGroup")
        }
        return .sharedCookieStorage(forGroupContainerIdentifier: appGroupId)
    }
}

extension Session {
    static func withSharedCookieStorage() -> Session {
        let configuration = URLSessionConfiguration.af.default
        configuration.httpCookieStorage = .forDefaultAppGroup()

        var headers = configuration.httpAdditionalHeaders ?? [:]
        headers["eyre-no-desk-redirect"] = "?1"
        configuration.httpAdditionalHeaders = headers

        return Session(configuration: configuration)
    }
}
