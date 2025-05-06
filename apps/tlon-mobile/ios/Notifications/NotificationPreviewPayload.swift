import Foundation

struct NotificationPreviewPayload: Decodable {
    indirect enum ContentNode: Decodable {
        case channelTitle(channelId: String)
        case groupTitle(groupId: String)
        case userNickname(ship: String)
        case stringLiteral(content: String)
        case concatenateStrings(first: ContentNode, second: ContentNode)
        
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
            case groupTitle
            case stringLiteral
            case concatenateStrings
            case userNickname
        }
        
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let type = try container.decode(NodeType.self, forKey: .type)
            
            switch type {
            case .channelTitle:
                let channelId = try container.decode(String.self, forKey: .channelId)
                self = .channelTitle(channelId: channelId)
                
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

struct NotificationPreviewContentNodeRenderer {
    func render(_ node: NotificationPreviewPayload.ContentNode) async -> String {
        switch node {
        case let .stringLiteral(content):
            return content
        case let .channelTitle(channelId):
            return (try? await GroupChannelStore.sharedInstance.getOrFetchItem(channelId)?.meta.title) ?? channelId
        case let .groupTitle(groupId):
            return (try? await GroupStore.sharedInstance.getOrFetchItem(groupId)?.preview?.meta.title) ?? groupId
        case let .concatenateStrings(first, second):
            return [await render(first), await render(second)].joined()
        case let .userNickname(ship):
            return (try? await ContactStore.sharedInstance.getOrFetchItem(ship)?.displayName) ?? ship
        }
    }
}

