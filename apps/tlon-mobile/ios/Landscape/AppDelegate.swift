import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Expo
import Firebase
import RNBranch

@main
class AppDelegate: ExpoAppDelegate {
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
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Linking API
  override func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if RNBranch.application(application, open: url, options: options) {
      return true
    }

    return super.application(application, open: url, options: options) ||
           RCTLinkingManager.application(application, open: url, options: options)
  }

  // MARK: - Universal Links
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if RNBranch.continue(userActivity) {
      return true
    }

    let result = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )

    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
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
