import Foundation

public struct NotificationPreviewPayload: Decodable {
    public indirect enum ContentNode: Decodable {
        case channelTitle(channelId: String)
        case foreignGroupTitle(groupId: String)
        case groupTitle(groupId: String)
        case userNickname(ship: String)
        case stringLiteral(content: String)
        case concatenateStrings(first: ContentNode, second: ContentNode)
        case postSource(channelId: String, groupId: String)
        
        enum CodingKeys: String, CodingKey {
            case type
            case channelId
            case groupId
            case content
            case first
            case second
            case ship
        }
        
        enum NodeType: String, Decodable {
            case channelTitle
            case foreignGroupTitle
            case groupTitle
            case stringLiteral
            case concatenateStrings
            case userNickname
            case postSource
        }
        
        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let type = try container.decode(NodeType.self, forKey: .type)
            
            switch type {
            case .channelTitle:
                let channelId = try container.decode(String.self, forKey: .channelId)
                self = .channelTitle(channelId: channelId)
                
            case .foreignGroupTitle:
                let groupId = try container.decode(String.self, forKey: .groupId)
                self = .foreignGroupTitle(groupId: groupId)

            case .groupTitle:
                let groupId = try container.decode(String.self, forKey: .groupId)
                self = .groupTitle(groupId: groupId)

            case .stringLiteral:
                let content = try container.decode(String.self, forKey: .content)
                self = .stringLiteral(content: content)
                
            case .concatenateStrings:
                let first = try container.decode(ContentNode.self, forKey: .first)
                let second = try container.decode(ContentNode.self, forKey: .second)
                self = .concatenateStrings(first: first, second: second)
                
            case .userNickname:
                let ship = try container.decode(String.self, forKey: .ship)
                self = .userNickname(ship: ship)

            case .postSource:
                let channelId = try container.decode(String.self, forKey: .channelId)
                let groupId = try container.decode(String.self, forKey: .groupId)
                self = .postSource(channelId: channelId, groupId: groupId)
            }
        }
    }
    
    struct Notification: Decodable {
        let title: ContentNode?
        let body: ContentNode
        let groupingKey: ContentNode?
    }
    
    struct Message: Decodable {
        enum MessageType: String, Decodable {
            case group = "group"
            case dm = "dm"
        }
        
        let type: MessageType
        let timestamp: Int
        let senderId: String
        let conversationTitle: NotificationPreviewPayload.ContentNode?
    }
    
    let notification: Notification
    let message: Message?
}

public struct NotificationPreviewContentNodeRenderer {
    public init() {}

    public func render(_ node: NotificationPreviewPayload.ContentNode) async -> String {
        switch node {
        case let .stringLiteral(content):
            return content
        case let .channelTitle(channelId):
            return (try? await GroupChannelStore.sharedInstance.getOrFetchItem(channelId)?.meta.title) ?? channelId
        case let .groupTitle(groupId):
            return (try? await GroupStore.sharedInstance.getOrFetchItem(groupId)?.meta.title) ?? groupId
        case let .foreignGroupTitle(groupId):
            return (try? await ForeignGroupStore.sharedInstance.getOrFetchItem(groupId)?.preview?.meta.title) ?? groupId
        case let .concatenateStrings(first, second):
            return [await render(first), await render(second)].joined()
        case let .userNickname(ship):
            return (try? await ContactStore.sharedInstance.getOrFetchItem(ship)?.displayName) ?? ship
        case let .postSource(channelId, groupId):
            // If the post source is a single-channel group, we want to omit the channel title.
            if let isSingleChannelGroup = try? await GroupStore.sharedInstance.getOrFetchItem(groupId)?.channels.count == 1 {
                if isSingleChannelGroup {
                    return await render(.groupTitle(groupId: groupId))
                }
            }
            
            return await render(
                .concatenateStrings(
                    first: .groupTitle(groupId: groupId),
                    second: .concatenateStrings(
                        first: .stringLiteral(content: ": "),
                        second: .channelTitle(channelId: channelId)
                    )
                )
            )
        }
    }
}

