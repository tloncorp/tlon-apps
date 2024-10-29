import AppIntents
import Intents

struct ChannelEntity: AppEntity {
  init(id: String, title: String, groupTitle: String) {
    self.id = id
    self.title = title
    self.groupTitle = groupTitle
  }
  
  struct Group {
    let title: String
  }
  
  static var defaultQuery = ChannelQuery()
  
  var id: String
  
  @Property(title: "Title")
  var title: String
  
  @Property(title: "Group title")
  var groupTitle: String
  
  static var typeDisplayRepresentation: TypeDisplayRepresentation {
    TypeDisplayRepresentation(
      name: "Channel",
      numericFormat: "\(placeholder: .int) channels"
    )
  }
  
  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(title)",
      subtitle: "\(groupTitle)",
      image: nil
    )
  }
}

struct ChannelQuery: EntityPropertyQuery {
  typealias ComparatorMappingType = ComparatorMapping
  
  enum ComparatorMapping {
    case equalTo(String, column: String)
    case contains(String, column: String)
  }
  
  static var properties = QueryProperties {
    Property(\ChannelEntity.$title) {
      EqualToComparator { .equalTo($0, column: "c.title") }
      ContainsComparator { .contains($0, column: "c.title") }
    }
    Property(\ChannelEntity.$groupTitle) {
      EqualToComparator { .equalTo($0, column: "g.title") }
      ContainsComparator { .contains($0, column: "g.title") }
    }
  }
  
  static var sortingOptions = SortingOptions {
    SortableBy(\ChannelEntity.$title)
    SortableBy(\ChannelEntity.$groupTitle)
  }
  
  private var database: SQLiteDB? {
    SQLiteDB.openApplicationDatabase()
  }

  func entities(matching string: String) async throws -> [ChannelEntity] {
    guard let database else { return [] }
    
    let results = database.exec("""
      select
        c.id,
        c.title, 
        g.title as group_title
      from channels c
      join groups g on c.group_id = g.id
      where c.title like ?
    """, parameters: ["%\(string)%"])
    
    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        groupTitle: result["group_title"]!!
      )
    }
  }
  
  func entities(for identifiers: [ChannelEntity.ID]) async throws -> [ChannelEntity] {
    guard let database else { return [] }
    
    let results = database.exec("""
      with query(id) as (
         values \(identifiers.map { _ in "(?)" }.joined(separator: ", "))
      )
      select
        c.id,
        c.title,
        g.title as group_title
      from query
      join channels c on query.id = c.id
      join groups g on c.group_id = g.id
    """, parameters: identifiers)

    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        groupTitle: result["group_title"]!!
      )
    }
  }
  
  func suggestedEntities() async throws -> [ChannelEntity] {
    guard let database else { return [] }
    
    let results = database.exec("""
      select
        c.id,
        c.title, 
        g.title as group_title
      from channels c
      join groups g on c.group_id = g.id
      order by max(c.last_viewed_at, c.last_post_at) desc
      limit 50
    """)
    
    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        groupTitle: result["group_title"]!!
      )
    }
  }
  
  func entities(
    matching comparators: [ComparatorMappingType],
    mode: ComparatorMode,
    sortedBy: [Sort<ChannelEntity>],
    limit: Int?
  ) async throws -> [ChannelEntity] {
    guard let database else { return [] }

    var sql = """
      select
        c.id,
        c.title,
        g.title as group_title
      from channels c
      join groups g on c.group_id = g.id
    """
    
    var parameters = [String]()
    
    
    if !comparators.isEmpty {
      sql += " where " + comparators.map { comparator in
        switch comparator {
        case let .equalTo(value, column):
          parameters.append(value)
          return "\(column) = ?"
        case let .contains(value, column):
          parameters.append("%\(value)%")
          return "\(column) like ?"
        }
      }.joined(separator: mode == .and ? " and " : " or ")
    }
    
    if !sortedBy.isEmpty {
      sql += " order by " + sortedBy.map { sort in
        var direction: String {
          switch sort.order {
          case .ascending: return "asc"
          case .descending: return "desc"
          }
        }
        
        var column: String {
          switch sort.by {
          case \ChannelEntity.$title: return "c.title"
          case \ChannelEntity.$groupTitle: return "g.title"
          default: return ""
          }
        }
        
        return "\(column) \(direction)"
      }.joined(separator: ", ")
    }
    
    if let limit {
      sql += " limit \(limit)"
    }
    
    let results = database.exec(sql, parameters: parameters)
    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        groupTitle: result["group_title"]!!
      )
    }
  }
}
