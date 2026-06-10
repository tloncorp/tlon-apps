//
//  UrbitModule.swift
//  Landscape
//
//  Created by Alec Ananian on 7/6/23.
//

import Foundation

@objc(UrbitModule)
class UrbitModule: NSObject {
    private static let loginStore = LoginStore()

    @objc(setUrbit:shipUrl:authCookie:)
    func setUrbit(shipName: String, shipUrl: String, authCookie _: String) {
        try? UrbitModule.loginStore.save(Login(shipName: shipName, shipUrl: shipUrl))

        Task {
            // Delay this a bit so that js init requests have time to fire
            try? await Task.sleep(for: .seconds(10))
            try? await UrbitAPI.shared.open(for: shipUrl)
            try? await PocketAPI.shared.fetchSettings()
        }
    }

    @objc func clearUrbit() {
        try? UrbitModule.loginStore.delete()
        // clear cached backend capability so a later login to an older backend
        // doesn't keep fetching the v9 notification mark (which it would 404)
        UserDefaults.forDefaultAppGroup.removeObject(
            forKey: SettingsStore.activitySupportsReactionsKey
        )
    }

    @objc(setPostHogApiKey:)
    func setPostHogApiKey(apiKey: String) {
        UserDefaults.forDefaultAppGroup.set(apiKey, forKey: "postHogApiKey")
    }

    @objc(setActivitySupportsReactions:)
    func setActivitySupportsReactions(supported: Bool) {
        UserDefaults.forDefaultAppGroup.set(supported, forKey: SettingsStore.activitySupportsReactionsKey)
    }

    @objc(updateBadgeCount:uid:)
    func updateBadgeCount(count: Int, uid: String) {
        Task {
            await NotificationDismissHandler.shared.updateBadgeCountIfNeeded(newCount: count, uid: uid)
        }
    }

    @objc func signalJsReady() {
        // No-op on iOS
    }
}
