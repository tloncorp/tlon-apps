//
//  Contact.swift
//  Landscape
//
//  Created by Alec Ananian on 7/26/23.
//

import Foundation
import UIKit
import UrsusSigil

class Contact: Codable {
    let id: String
    let nickname: String?
    let avatarURLString: String?
    let coverURLString: String?
    let color: String?

    var displayName: String {
        // Is user showing nicknames and does contact have a valid nickname?
        if !SettingsStore.disableNicknames, let nickname {
            return nickname
        }

        let name = id.starts(with: "~") ? String(id.dropFirst()) : id

        // Shorten comets
        if name.count == 56 {
            return "~\(name.prefix(6))_\(name.suffix(6))"
        }

        // Shorten moons
        if name.count == 27 {
            return "~\(name[14 ..< 20])^\(name[21 ..< 27])"
        }

        return "~\(name)"
    }

    var ship: Sigil.Ship? {
        Sigil.Ship(rawValue: id)
    }

    var avatarURL: URL? {
        guard !SettingsStore.disableAvatars, let avatarURLString else {
            return nil
        }

        return URL(string: avatarURLString)
    }

    var coverURL: URL? {
        guard !SettingsStore.disableAvatars, let coverURLString else {
            return nil
        }

        return URL(string: coverURLString)
    }

    var customColor: UIColor {
        if let color {
            return UIColor(color)
        }

        return .black
    }

    init(id: String, info: ContactInfo) {
        self.id = id
        nickname = info.nickname
        avatarURLString = info.avatar
        coverURLString = info.cover
        color = info.color
    }
}

extension Contact: Comparable {
    static func < (lhs: Contact, rhs: Contact) -> Bool {
        lhs.displayName.replacingOccurrences(of: "~", with: "").compare(
            rhs.displayName.replacingOccurrences(of: "~", with: ""),
            options: [.caseInsensitive, .diacriticInsensitive]
        ) == .orderedAscending
    }

    static func == (lhs: Contact, rhs: Contact) -> Bool {
        lhs.id == rhs.id
    }
}

struct ContactInfo: Decodable {
    let avatar: String?
    let bio: String?
    let color: String?
    let cover: String?
    let groups: [String]
    let nickname: String?
    let status: String?
}

struct ContactNews: Decodable {
    let who: String
    let con: ContactInfo
}
