import Foundation

struct Login: Decodable {
    let shipName: String
    let shipUrl: String
    let authCookie: String
}
