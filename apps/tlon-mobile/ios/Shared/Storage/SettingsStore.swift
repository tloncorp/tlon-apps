//
//  SettingsStore.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation

enum SettingsStore {
    static var disableAvatars: Bool = UserDefaults.forDefaultAppGroup.bool(forKey: "settings.calmEngine.disableAvatars") {
        didSet {
            UserDefaults.forDefaultAppGroup.set(disableNicknames, forKey: "settings.calmEngine.disableAvatars")
        }
    }

    static var disableNicknames: Bool = UserDefaults.forDefaultAppGroup.bool(forKey: "settings.calmEngine.disableNicknames") {
        didSet {
            UserDefaults.forDefaultAppGroup.set(disableNicknames, forKey: "settings.calmEngine.disableNicknames")
        }
    }

    static var disableDMNotifications = UserDefaults.forDefaultAppGroup.bool(forKey: "settings.notifications.disableDM") {
        didSet {
            UserDefaults.forDefaultAppGroup.set(disableDMNotifications, forKey: "settings.notifications.disableDM")
        }
    }

    static var disableGroupNotifications = UserDefaults.forDefaultAppGroup.bool(forKey: "settings.notifications.disableGroups") {
        didSet {
            UserDefaults.forDefaultAppGroup.set(disableGroupNotifications, forKey: "settings.notifications.disableGroups")
        }
    }
}
