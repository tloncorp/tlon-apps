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
    func setUrbit(shipName: String, shipUrl: String, authCookie: String) {
        try? UrbitModule.loginStore.save(Login(shipName: shipName, shipUrl: shipUrl, authCookie: authCookie))

        Task {
            // Delay this a bit so that js init requests have time to fire
            try? await Task.sleep(for: .seconds(10))
            try? await UrbitAPI.shared.open(for: shipUrl)
            try? await PocketAPI.shared.fetchSettings()
        }
    }

    @objc func clearUrbit() {
        try? UrbitModule.loginStore.delete()
    }
}
