//
//  Club.swift
//  Pocket
//
//  Created by Alec Ananian on 7/24/22.
//

import Foundation

struct Club: Codable {
    let hive: [String]
    let team: [String]
    let meta: GroupMeta

    var displayName: String? {
        meta.title?.withUserInputCleaned ??
            (team + hive)
            // Right now we store user on RN's side
            // .filter { $0 != UserStore.shipName }
            .map { ContactStore.sharedInstance.getItem($0)?.displayName ?? $0 }
            .joined(separator: ", ")
    }
}

private extension String {
    var withUserInputCleaned: String? {
        let cleanedString = trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanedString.isEmpty ? nil : cleanedString
    }
}
