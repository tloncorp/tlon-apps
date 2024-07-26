//
//  SettingsStore.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation

enum SettingsStore {
    static var disableAvatars: Bool = UserDefaults.appGroup.bool(forKey: "settings.calmEngine.disableAvatars") {
        didSet {
            UserDefaults.appGroup.set(disableNicknames, forKey: "settings.calmEngine.disableAvatars")
        }
    }

    static var disableNicknames: Bool = UserDefaults.appGroup.bool(forKey: "settings.calmEngine.disableNicknames") {
        didSet {
            UserDefaults.appGroup.set(disableNicknames, forKey: "settings.calmEngine.disableNicknames")
        }
    }

    static var disableDMNotifications = UserDefaults.appGroup.bool(forKey: "settings.notifications.disableDM") {
        didSet {
            UserDefaults.appGroup.set(disableDMNotifications, forKey: "settings.notifications.disableDM")
        }
    }

    static var disableGroupNotifications = UserDefaults.appGroup.bool(forKey: "settings.notifications.disableGroups") {
        didSet {
            UserDefaults.appGroup.set(disableGroupNotifications, forKey: "settings.notifications.disableGroups")
        }
    }
}
