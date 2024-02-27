//
//  INPerson+Extension.swift
//  Pocket
//
//  Created by Alec Ananian on 3/22/23.
//

import Foundation
import Intents
import UIKit
import UrsusSigil

extension INPerson {
    static var empty: Self {
        .init(
            personHandle: INPersonHandle(value: nil, type: .unknown),
            nameComponents: nil,
            displayName: nil,
            image: nil,
            contactIdentifier: nil,
            customIdentifier: nil
        )
    }

    static func from(shipName: String, withImage: Bool = false) async -> Self {
        var contact: Contact? = nil
        do {
            contact = try await ContactStore.sharedInstance.getOrFetchItem(shipName)
        } catch {
            error.logWithDomain(TlonError.NotificationsFetchContacts)
        }

        let displayName = contact?.displayName ?? shipName
        var image: INImage?

        if withImage {
            var backgroundColor = UIColor.black
            if let contact {
                if !SettingsStore.disableAvatars,
                   let avatarURL = contact.avatarURL,
                   let avatarData = try? Data(contentsOf: avatarURL)
                {
                    image = INImage(imageData: avatarData)
                }

                backgroundColor = contact.customColor
            }

            if image == nil, let ship = Sigil.Ship(rawValue: shipName) {
                let imageSize = CGSize(width: 512, height: 512)
                let sigilSize = CGSize(width: imageSize.width / 2, height: imageSize.height / 2)
                let sigil = Sigil(
                    ship: ship,
                    color: backgroundColor.contrastedForegroundColor
                )
                let sigilImage = sigil.image(with: sigilSize)
                UIGraphicsBeginImageContextWithOptions(imageSize, false, 1)
                if let ctx = UIGraphicsGetCurrentContext() {
                    defer { UIGraphicsEndImageContext() }
                    ctx.setFillColor(backgroundColor.cgColor)
                    ctx.fill(CGRect(origin: .zero, size: imageSize))
                    sigilImage.draw(at: CGPoint(x: (imageSize.width - sigilSize.width) / 2, y: (imageSize.height - sigilSize.height) / 2))
                    if let imageData = UIGraphicsGetImageFromCurrentImageContext()?.pngData() {
                        image = INImage(imageData: imageData)
                    }
                }
            }
        }

        return .init(
            personHandle: INPersonHandle(value: shipName, type: .unknown),
            nameComponents: PersonNameComponents(nickname: displayName),
            displayName: displayName,
            image: image,
            contactIdentifier: nil,
            customIdentifier: nil,
            isMe: false,
            suggestionType: .none
        )
    }
}
