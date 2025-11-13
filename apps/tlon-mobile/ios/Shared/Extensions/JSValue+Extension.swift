//
//  JSValue+Extension.swift
//  Landscape
//
//  Created by Hunter Miller on 9/29/25.
//

import Foundation
import JavaScriptCore

extension JSValue {
    func decode<T: Decodable>(as type: T.Type) throws -> T {
        guard
            let object = self.toObject(),
            JSONSerialization.isValidJSONObject(object)
        else {
            throw NSError(
                domain: "JSValueError",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "JSValue is not a valid JSON object"]
            )
        }
        let jsonData = try JSONSerialization.data(withJSONObject: object, options: [])
        return try JSONDecoder().decode(T.self, from: jsonData)
    }
}
