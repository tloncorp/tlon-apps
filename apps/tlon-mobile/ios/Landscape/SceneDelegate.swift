import UIKit
internal import Expo
import RNBranch

// ExpoAppSceneDelegate creates the window, starts React Native, and passes
// scene links on to the app delegate and React Native's Linking. Branch links
// go to Branch first, and only the links Branch does not claim reach Linking,
// as they did under the app-delegate life cycle.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // A link that cold-starts the app arrives here, not in the launch options
    // the app delegate started Branch's session with.
    connectionOptions.urlContexts.forEach { _ = Self.openInBranch($0) }
    connectionOptions.userActivities.forEach { _ = RNBranch.continue($0) }

    super.scene(scene, willConnectTo: session, options: connectionOptions)
  }

  override func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    let unclaimed = URLContexts.filter { !Self.openInBranch($0) }
    if !unclaimed.isEmpty {
      super.scene(scene, openURLContexts: unclaimed)
    }
  }

  override func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if RNBranch.continue(userActivity) {
      return
    }
    super.scene(scene, continue: userActivity)
  }

  private static func openInBranch(_ context: UIOpenURLContext) -> Bool {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication = context.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    return RNBranch.application(UIApplication.shared, open: context.url, options: options)
  }
}
