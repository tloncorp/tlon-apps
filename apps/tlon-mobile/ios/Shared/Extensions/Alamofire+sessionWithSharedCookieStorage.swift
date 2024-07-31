import Alamofire
import Foundation

extension Session {
    static func withSharedCookieStorage() -> Session {
        let configuration = URLSessionConfiguration.af.default
        // TODO: use active app group
        configuration.httpCookieStorage = .sharedCookieStorage(forGroupContainerIdentifier: "group.io.tlon.groups.preview")
        return Session(configuration: configuration)
    }
}
