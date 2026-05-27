//
//  Error+logWithDomain.swift
//  Landscape
//
//  Created by Alec Ananian on 11/13/23.
//

import FirebaseCrashlytics
import Foundation

extension Error {
    func logWithDomain(_ domain: String) {
        Crashlytics.crashlytics().record(error: NSError(
            domain: domain,
            code: 0,
            userInfo: [
                "description": localizedDescription,
            ]
        ))
    }
}
