import UIKit
import React
import ReactAppDependencyProvider
internal import Expo
import Firebase
import RNBranch
import react_native_paste_input

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Configure Firebase
    FirebaseApp.configure()

    // Configure Branch
    #if PREVIEW
    RNBranch.useTestInstance()
    #endif

    RNBranch.branch.checkPasteboardOnInstall()
    // Under the scene life cycle the launch options carry no link; SceneDelegate
    // passes a link that cold-starts the app to Branch.
    RNBranch.initSession(launchOptions: launchOptions, isReferrable: true)

    // Setup cookie storage forwarding
    HTTPCookieStorage.shared.forwardChanges(to: HTTPCookieStorage.forDefaultAppGroup())

    // Setup shortcuts
    ShortcutsManager.setup()

    // Start notification log processing
    NotificationLogProcessor.default.startPeriodicProcessing()

    // Setup React Native with new architecture
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The factory creates its rootViewFactory on init, and the patched paste
    // module reads the React host from it only when an input mounts, so this
    // can run before SceneDelegate starts React Native.
    PasteInputModule.setup(factory.rootViewFactory)

    // SceneDelegate creates the window, starts React Native, and handles links.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Remote Notifications
  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable : Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Handle notification dismiss actions
    NotificationDismissHandler.shared.handleNotificationDismiss(userInfo: userInfo)

    // Forward to ExpoAppDelegate so expo-notifications and other subscribers
    // can process the push (including the silent `content-available` payload
    // the notify-provider uses to wake the NSE).
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
}

// MARK: - React Native Delegate
class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
