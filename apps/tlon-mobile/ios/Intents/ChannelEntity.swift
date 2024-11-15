import AppIntents
import Intents

struct ChannelEntity: AppEntity {
  struct Group {
    let title: String
  }
  
  static var defaultQuery = ChannelQuery()
  
  var id: String
  let title: String
  let group: ChannelEntity.Group
  
  static var typeDisplayRepresentation: TypeDisplayRepresentation {
    TypeDisplayRepresentation(
      name: "Channel",
      numericFormat: "\(placeholder: .int) channels"
    )
  }
  
  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(title)",
      subtitle: "\(group.title)",
      image: nil
    )
  }
}

struct ChannelQuery: EntityStringQuery {
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
    
    database.close()
    
    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        group: ChannelEntity.Group(title: result["group_title"]!!)
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
    database.close()

    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        group: ChannelEntity.Group(title: result["group_title"]!!)
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
      limit 10
    """)
    database.close()

    return results.map { result in
      ChannelEntity(
        id: result["id"]!!,
        title: result["title"]!!,
        group: ChannelEntity.Group(title: result["group_title"]!!)
      )
    }
  }
}
