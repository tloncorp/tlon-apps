import Foundation

extension HTTPCookieStorage {
    private func copy(to otherCookieStorage: HTTPCookieStorage) {
        cookies?.forEach { cookie in
            if !(otherCookieStorage.cookies ?? []).contains(where: { $0 == cookie }) {
                otherCookieStorage.setCookie(cookie)
            }
        }
    }

    @objc func forwardChanges(to otherCookieStorage: HTTPCookieStorage) {
        copy(to: otherCookieStorage)
        NotificationCenter.default.addObserver(forName: .NSHTTPCookieManagerCookiesChanged, object: nil, queue: nil) { [weak self] _ in
            guard let self else { return }
            copy(to: otherCookieStorage)
        }
    }
}
