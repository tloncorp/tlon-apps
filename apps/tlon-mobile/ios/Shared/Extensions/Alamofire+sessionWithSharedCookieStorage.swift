import Alamofire
import Foundation

extension Session {
    static func withSharedCookieStorage() -> Session {
        guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "TlonDefaultAppGroup") as? String else {
            fatalError("Missing required plist entry: TlonDefaultAppGroup")
        }

        let configuration = URLSessionConfiguration.af.default
        configuration.httpCookieStorage = .sharedCookieStorage(forGroupContainerIdentifier: appGroupId)
        return Session(configuration: configuration)
    }
}
