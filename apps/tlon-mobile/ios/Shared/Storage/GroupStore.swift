//
//  GroupStore.swift
//  Landscape
//
//  Created by Hunter Miller on 10/1/24.
//

import Foundation

final class GroupStore: UserDefaultsStore<Group> {
    static let sharedInstance = GroupStore(storageKey: "store.groups", fetchItems: PocketAPI.shared.fetchGroups)
}

class GangStore: UserDefaultsStore<Gang> {
    static let sharedInstance = GangStore(storageKey: "store.gangs", fetchItems: PocketAPI.shared.fetchGangs)
}
