import Foundation
import SimpleKeychain

struct LoginStore {
    private enum StorageKey {
        static let shipName = "store.shipName"
        static let shipUrl = "store.shipUrl"
        static let authCookie = "store.authCookie"
    }

    let keychain = SimpleKeychain()
    let userDefaults = UserDefaults.appGroup

    func read() throws -> Login? {
        guard try keychain.hasItem(forKey: StorageKey.authCookie) else {
            return nil
        }
        let authCookie = try keychain.string(forKey: StorageKey.authCookie)

        guard
            let shipName = userDefaults.string(forKey: StorageKey.shipName),
            let shipUrl = userDefaults.string(forKey: StorageKey.shipUrl)
        else {
            return nil
        }

        return Login(shipName: shipName, shipUrl: shipUrl, authCookie: authCookie)
    }

    func save(_ login: Login) throws {
        userDefaults.setValue(login.shipName, forKey: StorageKey.shipName)
        userDefaults.setValue(login.shipUrl, forKey: StorageKey.shipUrl)
        try keychain.set(login.authCookie, forKey: StorageKey.authCookie)
    }

    func delete() throws {
        userDefaults.removeObject(forKey: StorageKey.shipName)
        userDefaults.removeObject(forKey: StorageKey.shipUrl)
        try keychain.deleteItem(forKey: StorageKey.authCookie)
    }
}
