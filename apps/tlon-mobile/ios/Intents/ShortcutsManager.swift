import Foundation
import Combine
import AppIntents

final class IntentNotepad: ObservableObject, @unchecked Sendable {
  static let shared = IntentNotepad()
  
  enum Action {
    case openChannel(channelId: String, startDraft: Bool)
  }
  
  @Published var action: Action?
}

@objc class ShortcutsManager: NSObject {
  // reference necessary to retain subscription
  private static var subscription: AnyCancellable?
  
  @objc static func setup() {
    AppDependencyManager.shared.add(dependency: IntentNotepad.shared)
    
    subscription = IntentNotepad.shared
      .$action
      .sink { action in
        switch action {
        case let .openChannel(channelId, startDraft):
          if let url = URL.deeplinkToOpenChannel(withId: channelId, startDraft: startDraft) {
            UIApplication.shared.open(url)
          }
          
        default: break
        }
      }
  }
}

extension URL {
  static var schemeForDeeplinking: String? {
    if let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] {
      if let urlSchemes = urlTypes.first?["CFBundleURLSchemes"] as? [String] {
        return urlSchemes.first
      }
    }
    return nil
  }
  
  static func deeplinkToOpenChannel(withId channelId: String, startDraft: Bool = false) -> URL? {
    guard let scheme = URL.schemeForDeeplinking else { return nil }
    var urlComponents = URLComponents()
    urlComponents.scheme = scheme
    urlComponents.host = "channel"
    urlComponents.path = "/open"
    var queryItems: [URLQueryItem] = [
      URLQueryItem(name: "id", value: channelId),
    ]
    if startDraft {
      queryItems.append(URLQueryItem(name: "startDraft", value: "true"))
    }
    urlComponents.queryItems = queryItems
    return urlComponents.url
  }
}
