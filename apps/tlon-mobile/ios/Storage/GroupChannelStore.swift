//
//  GroupChannelStore.swift
//  Landscape
//
//  Created by Alec Ananian on 10/3/23.
//

import Foundation

final class GroupChannelStore: UserDefaultsStore<GroupChannel> {
    static let sharedInstance = GroupChannelStore(storageKey: "store.groupChannels", fetchItems: PocketAPI.shared.fetchGroupChannels)
}
