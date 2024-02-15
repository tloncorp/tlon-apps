//
//  Error+Extension.swift
//  Landscape
//
//  Created by Alec Ananian on 11/13/23.
//

import Foundation
import RNFBCrashlytics

extension Error {
    var isAFTimeout: Bool {
        guard let afError = asAFError else {
            return false
        }

        return afError.isSessionTaskError && (afError.underlyingError as? NSError)?.code == NSURLErrorTimedOut
    }

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
