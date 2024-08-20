//
//  Error+logWithDomain.swift
//  Landscape
//
//  Created by Alec Ananian on 11/13/23.
//

import Foundation
import RNFBCrashlytics

extension Error {
    func logWithDomain(_ domain: String) {
        RNFBCrashlyticsNativeHelper.recordNativeError(NSError(
            domain: domain,
            code: 0,
            userInfo: [
                "description": localizedDescription,
            ]
        ))
    }
}
