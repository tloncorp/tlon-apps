//
//  ContactStore.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation

final class ContactStore: UserDefaultsStore<Contact> {
    static let sharedInstance = ContactStore(storageKey: "store.contacts", fetchItems: PocketUserAPI.fetchContacts)
}
