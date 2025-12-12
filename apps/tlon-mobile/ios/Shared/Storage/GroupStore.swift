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

class ForeignGroupStore: UserDefaultsStore<ForeignGroup> {
    static let sharedInstance = ForeignGroupStore(storageKey: "store.foreign-groups", fetchItem: PocketAPI.shared.fetchForeignGroup)
}
