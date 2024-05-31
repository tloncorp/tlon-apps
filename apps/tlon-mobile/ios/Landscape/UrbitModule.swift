//
//  UrbitModule.swift
//  Landscape
//
//  Created by Alec Ananian on 7/6/23.
//

import Foundation
import SimpleKeychain

@objc(UrbitModule)
class UrbitModule: NSObject {
    static let keychain = SimpleKeychain()

    private static var _shipName: String?
    static var shipName: String? {
        get {
            if let shipName = _shipName {
                return shipName
            }

            return UserDefaults.standard.string(forKey: "store.shipName")
        }

        set {
            guard let value = newValue else {
                _shipName = nil
                UserDefaults.standard.removeObject(forKey: "store.shipName")
                return
            }

            _shipName = value
            UserDefaults.standard.setValue(value, forKey: "store.shipName")
        }
    }

    private static var _shipUrl: String?
    static var shipUrl: String? {
        get {
            if let shipUrl = _shipUrl {
                return shipUrl
            }

            return UserDefaults.standard.string(forKey: "store.shipUrl")
        }

        set {
            guard let value = newValue else {
                _shipUrl = nil
                UserDefaults.standard.removeObject(forKey: "store.shipUrl")
                return
            }

            _shipUrl = value
            UserDefaults.standard.setValue(value, forKey: "store.shipUrl")
        }
    }

    static var authCookie: String? {
        get {
            try? keychain.string(forKey: "store.authCookie")
        }

        set {
            guard let value = newValue else {
                try? keychain.deleteItem(forKey: "store.authCookie")
                return
            }

            try? keychain.set(value, forKey: "store.authCookie")
        }
    }

    @objc(setUrbit:shipUrl:authCookie:)
    func setUrbit(shipName: String, shipUrl: String, authCookie: String) {
        UrbitModule.shipName = shipName
        UrbitModule.shipUrl = shipUrl
        UrbitModule.authCookie = authCookie
        Task {
            try? await UrbitAPI.shared.open(for: shipUrl)
            // try? await PocketUserAPI.fetchSettings()
        }
    }

    @objc func clearUrbit() {
        UrbitModule.shipName = nil
        UrbitModule.shipUrl = nil
        UrbitModule.authCookie = nil
    }
}
