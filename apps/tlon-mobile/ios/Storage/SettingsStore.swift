//
//  SettingsStore.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation

enum SettingsStore {
    static var disableAvatars: Bool = UserDefaults.standard.bool(forKey: "settings.calmEngine.disableAvatars") {
        didSet {
            UserDefaults.standard.set(disableNicknames, forKey: "settings.calmEngine.disableAvatars")
        }
    }

    static var disableNicknames: Bool = UserDefaults.standard.bool(forKey: "settings.calmEngine.disableNicknames") {
        didSet {
            UserDefaults.standard.set(disableNicknames, forKey: "settings.calmEngine.disableNicknames")
        }
    }

    static var disableDMNotifications = UserDefaults.standard.bool(forKey: "settings.notifications.disableDM") {
        didSet {
            UserDefaults.standard.set(disableDMNotifications, forKey: "settings.notifications.disableDM")
        }
    }

    static var disableGroupNotifications = UserDefaults.standard.bool(forKey: "settings.notifications.disableGroups") {
        didSet {
            UserDefaults.standard.set(disableGroupNotifications, forKey: "settings.notifications.disableGroups")
        }
    }
}
