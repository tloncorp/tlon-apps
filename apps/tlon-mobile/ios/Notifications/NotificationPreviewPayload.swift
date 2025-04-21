import Foundation

struct NotificationPreviewPayload: Decodable {
    indirect enum ContentNode: Decodable {
        case channelTitle(channelId: String)
        case stringLiteral(content: String)
        case concatenateStrings(first: ContentNode, second: ContentNode)
        
        enum CodingKeys: String, CodingKey {
            case type
            case channelId
            case content
            case first
            case second
        }
        
        enum NodeType: String, Decodable {
            case channelTitle
            case stringLiteral
            case concatenateStrings
        }
        
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let type = try container.decode(NodeType.self, forKey: .type)
            
            switch type {
            case .channelTitle:
                let channelId = try container.decode(String.self, forKey: .channelId)
                self = .channelTitle(channelId: channelId)
                
            case .stringLiteral:
                let content = try container.decode(String.self, forKey: .content)
                self = .stringLiteral(content: content)
                
            case .concatenateStrings:
                let first = try container.decode(ContentNode.self, forKey: .first)
                let second = try container.decode(ContentNode.self, forKey: .second)
                self = .concatenateStrings(first: first, second: second)
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
    func render(_ node: NotificationPreviewPayload.ContentNode) -> String {
        switch node {
        case let .stringLiteral(content):
            return content
        case let .channelTitle(channelId):
            return GroupChannelStore.sharedInstance.getItem(channelId)?.meta.title ?? channelId
        case let .concatenateStrings(first, second):
            return [render(first), render(second)].joined()
        }
    }
}

