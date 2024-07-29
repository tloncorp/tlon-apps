import Foundation

struct LoginStore {
    private enum StorageKey {
        static let shipName = "store.shipName"
        static let shipUrl = "store.shipUrl"
    }

    let userDefaults = UserDefaults.appGroup

    func read() throws -> Login? {
        guard
            let shipName = userDefaults.string(forKey: StorageKey.shipName),
            let shipUrl = userDefaults.string(forKey: StorageKey.shipUrl)
        else {
            return nil
        }

        return Login(shipName: shipName, shipUrl: shipUrl)
    }

    func save(_ login: Login) throws {
        userDefaults.setValue(login.shipName, forKey: StorageKey.shipName)
        userDefaults.setValue(login.shipUrl, forKey: StorageKey.shipUrl)
    }

    func delete() throws {
        userDefaults.removeObject(forKey: StorageKey.shipName)
        userDefaults.removeObject(forKey: StorageKey.shipUrl)
    }
}
