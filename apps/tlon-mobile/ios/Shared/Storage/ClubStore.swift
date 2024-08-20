//
//  ClubStore.swift
//  Landscape
//
//  Created by Alec Ananian on 10/3/23.
//

import Foundation

final class ClubStore: UserDefaultsStore<Club> {
    static let sharedInstance = ClubStore(storageKey: "store.clubs", fetchItem: PocketAPI.shared.fetchClubByID)
}
