//
//  Yarn.swift
//  Pocket
//
//  Created by Alec Ananian on 8/5/22.
//

import Foundation
import NotificationCenter

struct Yarn: Decodable {
    let id: String
    let rope: Rope
    let time: UInt
    let con: [YarnContent]
    let wer: String

    // Flag group invitations and group-meta events as invalid
    var isValidNotification: Bool {
        (rope.desk == "groups") &&
            (!rope.thread.hasSuffix("/channel/edit") &&
            !rope.thread.hasSuffix("/channel/add") &&
            !rope.thread.hasSuffix("/channel/del") &&
            !rope.thread.hasSuffix("/joins") &&
            !rope.thread.hasSuffix("/leaves") || !isGroup)
    }

    var isGroup: Bool {
        rope.group != nil
    }

    var isClub: Bool {
      (channelID ?? "").starts(with: "0v")
    }

    var isInvitation: Bool {
        con.contains(where: { $0.text == " has invited you to a direct message" })
    }

    var category: NotificationCategory {
        isInvitation ? .invitation : .message
    }

    var channelID: String? {
        if isGroup && rope.channel == nil {
          return nil
        }
      
        if isGroup, let channel = rope.channel {
            return channel
        }

        return rope.thread.replacingOccurrences(of: "/dm/", with: "").replacingOccurrences(of: "/club/", with: "")
    }
  
    var groupID: String? {
        return rope.group
    }

    var senderShipName: String? {
        for item in con {
            if case let .ship(result) = item {
                return result.ship
            }
        }

        return nil
    }

    var body: String {
        var parts = [String]()
        var skipNextPart = false
        con.filter { !$0.isShipName }.forEach { content in
            if skipNextPart {
                skipNextPart = false
                return
            }

            let text = content.text
            let isReply = text == " replied to " // DM replies
                || text == " replied to your message “" // Backwards compatibility
            if isReply
                || text == ": "
                || text == "”: "
                || text == " sent a message: " // User has all notifications enabled
                || text == " replied to you: " // Group replies, don't skip next
                || text == " mentioned you: " // Mentions
                || text == " mentioned you:" // Backwards compatibility
                || text == " mentioned you :" // Backwards compatibility
            {
                skipNextPart = isReply
                return
            }

            parts.append(text)
        }

        return parts.joined(separator: "")
    }

    var userInfo: [AnyHashable: Any] {
        [
            "wer": wer,
            "channelId": channelID,
        ]
    }

    func getTitle() async -> String {
        // Full message will go in body
        if isInvitation {
            return ""
        }

        // Sender name will be added to intent
        if !isGroup, !isClub {
            return ""
        }

        var displayName: String? = channelID ?? groupID

        if let channelID {
          if isGroup {
            do {
              let groupChannel = try await GroupChannelStore.sharedInstance.getOrFetchItem(channelID)
              displayName = groupChannel?.meta.title
            } catch {
              error.logWithDomain(TlonError.NotificationsFetchGroupChannel)
            }
          } else {
            do {
              let club = try await ClubStore.sharedInstance.getOrFetchItem(channelID)
              displayName = club?.displayName
            } catch {
              error.logWithDomain(TlonError.NotificationsFetchClub)
            }
          }
        } else if let groupID {
            do {
              let group = try await GroupStore.sharedInstance.getOrFetchItem(groupID)
              displayName = group?.preview?.meta.title
            } catch {
              error.logWithDomain(TlonError.NotificationsFetchGangs)
            }
        }

        return displayName ?? ""
    }
}

struct YarnContentShip: Decodable {
    let ship: String
}

struct YarnContentEmphasis: Decodable {
    let emph: String
}

indirect enum YarnContent: Decodable {
    case text(String)
    case ship(YarnContentShip)
    case emph(YarnContentEmphasis)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let value = try? container.decode(String.self) {
            self = .text(value)
        } else if let value = try? container.decode(YarnContentShip.self) {
            self = .ship(value)
        } else if let value = try? container.decode(YarnContentEmphasis.self) {
            self = .emph(value)
        } else {
            throw DecodingError.typeMismatch(
                YarnContent.self,
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for YarnContent")
            )
        }
    }

    var text: String {
        switch self {
        case let .text(value):
            return value

        case let .ship(value):
            return ContactStore.sharedInstance.getItem(value.ship)?.displayName ?? value.ship

        case let .emph(value):
            return value.emph
        }
    }

    var isShipName: Bool {
        if case .ship = self {
            return true
        }

        return false
    }
}

struct Rope: Decodable {
    let group: String?
    let channel: String?
    let desk: String
    let thread: String
}
