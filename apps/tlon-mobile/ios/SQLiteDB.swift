import sqlite3

let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

struct SQLiteDB {
  let db: OpaquePointer
  
  init?(dbUrl: URL) {
    var db: OpaquePointer?
    if sqlite3_open(dbUrl.path, &db) == SQLITE_OK {
      self.db = db!
    } else {
      return nil
    }
  }
  
  func close() {
    sqlite3_close(db)
  }
  
  func exec(_ sql: String, parameters: [String] = []) -> Array<[String?: String?]> {
    var results = Array<[String?: String?]>()
    
    var statement: OpaquePointer?
    sqlite3_prepare_v2(
      db,
      sql,
      -1, // max length of sql (we want no max)
      &statement,
      nil
    )
    
    parameters.enumerated().forEach { (index, parameter) in
      sqlite3_bind_text(
        statement,
        Int32(index + 1), // 1-indexed
        parameter,
        -1, // number of bytes in `parameter` (-1 for automatic to first zero terminator)
        SQLITE_TRANSIENT // I think
      )
    }
    
    while sqlite3_step(statement) == SQLITE_ROW {
      var row = [String?: String?]()
      for columnIndex in (0..<sqlite3_column_count(statement)) {
        let name = sqlite3_column_name(statement, columnIndex).map { String(cString: $0) }
        let value = sqlite3_column_text(statement, columnIndex).map { String(cString: $0) }
        row.updateValue(value, forKey: name)
      }
      results.append(row)
    }
    
    return results
  }
}

extension SQLiteDB {
  static func openApplicationDatabase() -> SQLiteDB? {
    // This behavior is partially defined in op-sqlite, and partially configured in Tlon app code:
    // https://github.com/OP-Engineering/op-sqlite/blob/cf5509d02d70460987ee48565dcea06d5b1436e7/cpp/libsql/bridge.cpp#L34
    // https://github.com/tloncorp/tlon-apps/blob/97bdb35a6a1745c5c208200ae9364f498715a064/packages/app/lib/nativeDb.ts#L22
    guard let dbUrl = try? FileManager.default
      .url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
      .appendingPathComponent("default/tlon.sqlite")
    else {
      return nil
    }
    return SQLiteDB(dbUrl: dbUrl)
  }
}
