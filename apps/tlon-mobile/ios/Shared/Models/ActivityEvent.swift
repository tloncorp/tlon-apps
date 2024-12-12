import Foundation

struct ActivityEvent {
  struct ActivityEventResponse: Codable {
    let event: ActivityEvent
    let time: String
  }
  
  // MARK: - ActvityEvent
  struct ActivityEvent: Codable {
    let notified: Bool
    let dmInvite: Whom?
    let groupKick: GroupKick?
    let groupAsk: GroupAsk?
    let groupJoin: GroupJoin?
    let groupRole: GroupRole?
    let groupInvite: GroupInvite?
    let flagPost: FlagPost?
    let flagReply: FlagReply?
    let dmPost: DmPost?
    let dmReply: DmReply?
    let post: Post?
    let reply: Reply?
    let contact: Contact?
    
    enum CodingKeys: String, CodingKey {
      case notified
      case dmInvite = "dm-invite"
      case groupKick = "group-kick"
      case groupAsk = "group-ask"
      case groupJoin = "group-join"
      case groupRole = "group-role"
      case groupInvite = "group-invite"
      case flagPost = "flag-post"
      case flagReply = "flag-reply"
      case dmPost = "dm-post"
      case dmReply = "dm-reply"
      case post, reply, contact
    }
  }
  
  // MARK: - Contact
  struct Contact: Codable {
    let update: ContactBookProfile
    let who: String
  }
  
  // MARK: - ContactBookProfile
  struct ContactBookProfile: Codable {
    let avatar: ContactImageField?
    let bio: ContactFieldText?
    let color: ContactFieldColor?
    let cover: ContactImageField?
    let groups: ContactFieldGroups?
    let nickname, status: ContactFieldText?
  }
  
  // MARK: - ContactImageField
  struct ContactImageField: Codable {
    let type: AvatarType
    let value: String
  }
  
  enum AvatarType: String, Codable {
    case look = "look"
  }
  
  // MARK: - ContactFieldText
  struct ContactFieldText: Codable {
    let type: BioType
    let value: String
  }
  
  enum BioType: String, Codable {
    case text = "text"
  }
  
  // MARK: - ContactFieldColor
  struct ContactFieldColor: Codable {
    let type: ColorType
    let value: String
  }
  
  enum ColorType: String, Codable {
    case tint = "tint"
  }
  
  // MARK: - ContactFieldGroups
  struct ContactFieldGroups: Codable {
    let type: GroupsType
    let value: [Value]
  }
  
  enum GroupsType: String, Codable {
    case typeSet = "set"
  }
  
  // MARK: - Value
  struct Value: Codable {
    let type: ValueType
    let value: String
  }
  
  enum ValueType: String, Codable {
    case flag = "flag"
  }
  
  // MARK: - Whom
  struct Whom: Codable {
    let ship, club: String?
  }
  
  // MARK: - DmPost
  struct DmPost: Codable {
    let content: [Verse]
    let key: MessageKey
    let mention: Bool
    let whom: Whom
  }
  
  // MARK: - Verse
  struct Verse: Codable {
    let inline: [Inline]?
    let block: Block?
  }
  
  // MARK: - Block
  struct Block: Codable {
    let image: Image?
    let listing: Listing?
    let header: Header?
    let rule: JSONNull?
    let code: Code?
    let cite: Cite?
  }
  
  // MARK: - Cite
  struct Cite: Codable {
    let chan: Chan?
    let group: String?
    let desk: Desk?
    let bait: Bait?
  }
  
  // MARK: - Bait
  struct Bait: Codable {
    let graph, group, baitWhere: String
    
    enum CodingKeys: String, CodingKey {
      case graph, group
      case baitWhere = "where"
    }
  }
  
  // MARK: - Chan
  struct Chan: Codable {
    let nest, chanWhere: String
    
    enum CodingKeys: String, CodingKey {
      case nest
      case chanWhere = "where"
    }
  }
  
  // MARK: - Desk
  struct Desk: Codable {
    let flag, deskWhere: String
    
    enum CodingKeys: String, CodingKey {
      case flag
      case deskWhere = "where"
    }
  }
  
  // MARK: - Code
  struct Code: Codable {
    let code, lang: String
  }
  
  // MARK: - Header
  struct Header: Codable {
    let content: [Inline]
    let tag: HeaderLevel
  }
  
  // MARK: - Task
  struct Task: Codable {
    let checked: Bool
    let content: [Inline]
  }
  
  /// A reference to the accompanying blocks, indexed at 0
  // MARK: - Ship
  struct InlineContent: Codable {
    let ship: String?
    let italics, bold, strike: [Inline]?
    let inlineCode, code: String?
    let blockquote: [Inline]?
    let block: BlockClass?
    let tag: String?
    let link: Link?
    let task: Task?
    
    enum CodingKeys: String, CodingKey {
      case ship, italics, bold, strike
      case inlineCode = "inline-code"
      case code, blockquote, block, tag, link, task
    }
  }
  
  struct InlineLinebreak: Codable {
    let linebreak: JSONNull
    
    enum CodingKeys: String, CodingKey {
      case linebreak = "break"
    }
  }
  
  enum Inline: Codable {
    case content(InlineContent)
    case linebreak(InlineLinebreak)
    case literal(String)
    
    init(from decoder: Decoder) throws {
      let container = try decoder.singleValueContainer()
      if let x = try? container.decode(String.self) {
        self = .literal(x)
        return
      }
      if let x = try? container.decode(InlineLinebreak.self) {
        self = .linebreak(x)
        return
      }
      if let x = try? container.decode(InlineContent.self) {
        self = .content(x)
        return
      }
      throw DecodingError.typeMismatch(Inline.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Inline"))
    }
    
    func encode(to encoder: Encoder) throws {
      var container = encoder.singleValueContainer()
      switch self {
      case .content(let x):
        try container.encode(x)
      case .linebreak(let x):
        try container.encode(x)
      case .literal(let x):
        try container.encode(x)
      }
    }
  }
  
  // MARK: - BlockClass
  struct BlockClass: Codable {
    let index: Double
    let text: String
  }
  
  // MARK: - Link
  struct Link: Codable {
    let content, href: String
  }
  
  enum HeaderLevel: String, Codable {
    case h1 = "h1"
    case h2 = "h2"
    case h3 = "h3"
    case h4 = "h4"
    case h5 = "h5"
    case h6 = "h6"
  }
  
  // MARK: - Image
  struct Image: Codable {
    let alt: String
    let height: Double
    let src: String
    let width: Double
  }
  
  // MARK: - List
  struct List: Codable {
    let contents: [Inline]
    let items: [Listing]
    let type: ListType
  }
  
  // MARK: - Listing
  struct Listing: Codable {
    let list: List?
    let item: [Inline]?
  }
  
  enum ListType: String, Codable {
    case ordered = "ordered"
    case tasklist = "tasklist"
    case unordered = "unordered"
  }
  
  // MARK: - MessageKey
  struct MessageKey: Codable {
    let id, time: String
  }
  
  // MARK: - DmReply
  struct DmReply: Codable {
    let content: [Verse]
    let key: MessageKey
    let mention: Bool
    let parent: MessageKey
    let whom: Whom
  }
  
  // MARK: - FlagPost
  struct FlagPost: Codable {
    let channel, group: String
    let key: MessageKey
  }
  
  // MARK: - FlagReply
  struct FlagReply: Codable {
    let channel, group: String
    let key, parent: MessageKey
  }
  
  // MARK: - GroupAsk
  struct GroupAsk: Codable {
    let group, ship: String
  }
  
  // MARK: - GroupInvite
  struct GroupInvite: Codable {
    let group, ship: String
  }
  
  // MARK: - GroupJoin
  struct GroupJoin: Codable {
    let group, ship: String
  }
  
  // MARK: - GroupKick
  struct GroupKick: Codable {
    let group, ship: String
  }
  
  // MARK: - GroupRole
  struct GroupRole: Codable {
    let group, role, ship: String
  }
  
  // MARK: - Post
  struct Post: Codable {
    let channel: String
    let content: [Verse]
    let group: String
    let key: MessageKey
    let mention: Bool
  }
  
  // MARK: - Reply
  struct Reply: Codable {
    let channel: String
    let content: [Verse]
    let group: String
    let key: MessageKey
    let mention: Bool
    let parent: MessageKey
  }
  
  // MARK: - Encode/decode helpers
  
  class JSONNull: Codable, Hashable {
    
    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
      return true
    }
    
    func hash(into hasher: inout Hasher) {}
    
    public init() {}
    
    public required init(from decoder: Decoder) throws {
      let container = try decoder.singleValueContainer()
      if !container.decodeNil() {
        throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
      }
    }
    
    public func encode(to encoder: Encoder) throws {
      var container = encoder.singleValueContainer()
      try container.encodeNil()
    }
  }
  
}
