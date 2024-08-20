//
//  Group.swift
//  Pocket
//
//  Created by Alec Ananian on 7/27/22.
//

import Foundation

class GroupMeta: Codable {
    let title: String?
    let image: String?
    let cover: String?
}

struct GroupChannel: Codable {
    let meta: GroupMeta
}

struct Group: Codable {
    let channels: [String: GroupChannel]
    let meta: GroupMeta
}
