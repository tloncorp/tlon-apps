//
//  UIColor+Extension.swift
//  Pocket Communicator
//
//  Created by Nick Arner on 2/5/21.
//

import UIKit

extension UIColor {
    var contrastedForegroundColor: UIColor {
        let red = CIColor(color: self).red * 255
        let green = CIColor(color: self).green * 255
        let blue = CIColor(color: self).blue * 255
        let brightness = ((299 * red) + (587 * green) + (114 * blue)) / 1000
        return 255 - brightness < 50 ? .black : .white
    }

    var isWhitish: Bool {
        var white: CGFloat = 0
        getWhite(&white, alpha: nil)
        return white > 0.89
    }

    var isBlackish: Bool {
        var white: CGFloat = 0
        getWhite(&white, alpha: nil)
        return white < 0.1
    }

    convenience init(_ hex: String, alpha: CGFloat = 1.0) {
        var cString: String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        if cString.hasPrefix("#") { cString.removeFirst() }

        cString = cString.replacingOccurrences(of: ".", with: "")
        cString = cString.replacingOccurrences(of: "0X", with: "")

        var rgbValue: UInt64 = 0
        Scanner(string: cString).scanHexInt64(&rgbValue)

        self.init(red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
                  green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
                  blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
                  alpha: alpha)
    }

    convenience init(red: Int, green: Int, blue: Int, alpha: CGFloat) {
        assert(red >= 0 && red <= 255, "Invalid red component")
        assert(green >= 0 && green <= 255, "Invalid green component")
        assert(blue >= 0 && blue <= 255, "Invalid blue component")

        self.init(red: CGFloat(red) / 255.0, green: CGFloat(green) / 255.0, blue: CGFloat(blue) / 255.0, alpha: alpha)
    }
}
