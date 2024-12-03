//
//  GroupStore.swift
//  Landscape
//
//  Created by Hunter Miller on 10/1/24.
//

import Foundation

final class GroupStore: UserDefaultsStore<Gang> {
    static let sharedInstance = GroupStore(storageKey: "store.groups", fetchItems: PocketAPI.shared.fetchGangs)
}
