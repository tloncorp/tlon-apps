import ExpoModulesCore
import UIKit

// These replace equivalent existing layout Views. The registration owns no
// layout, accessibility labels, hit-testing behavior, or drawing operations.
public final class ScrollReadScopeContainer: ExpoView {
    private lazy var readingRegistration = TlonReadRegistration(host: self, scope: true)

    func setDescriptor(_ value: String?) {
        readingRegistration.publishDescriptor(value)
    }

    public override func didMoveToSuperview() {
        super.didMoveToSuperview()
        readingRegistration.refreshAttachment()
    }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        readingRegistration.refreshAttachment()
    }
}

public final class ScrollReadItemContainer: ExpoView {
    private lazy var readingRegistration = TlonReadRegistration(host: self, scope: false)

    func setDescriptor(_ value: String?) {
        readingRegistration.publishDescriptor(value)
    }

    public override func didMoveToSuperview() {
        super.didMoveToSuperview()
        readingRegistration.refreshAttachment()
    }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        readingRegistration.refreshAttachment()
    }
}
