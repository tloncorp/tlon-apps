@testable import TlonMessageContextMenu
import UIKit
import XCTest

final class TlonMessageMenuLayoutTests: XCTestCase {
    func testReactionPressDoesNotOpenMessageMenu() {
        let hostView = UIView()
        let reactionView = UIView()
        reactionView.accessibilityIdentifier = "ReactionDisplay"
        hostView.addSubview(reactionView)

        XCTAssertFalse(
            TlonMessageContextMenuView.shouldReceiveMessageMenuTouch(
                reactionView,
                within: hostView
            )
        )
    }

    func testReactionDescendantPressDoesNotOpenMessageMenu() {
        let hostView = UIView()
        let reactionView = UIView()
        reactionView.accessibilityIdentifier = "ReactionDisplay"
        let reactionLabel = UILabel()
        reactionView.addSubview(reactionLabel)
        hostView.addSubview(reactionView)

        XCTAssertFalse(
            TlonMessageContextMenuView.shouldReceiveMessageMenuTouch(
                reactionLabel,
                within: hostView
            )
        )
    }

    func testOtherPressDoesOpenMessageMenu() {
        let hostView = UIView()
        let messageContent = UIView()
        hostView.addSubview(messageContent)

        XCTAssertTrue(
            TlonMessageContextMenuView.shouldReceiveMessageMenuTouch(
                messageContent,
                within: hostView
            )
        )
    }

    func testLeadingLayoutPreservesSourcePositionUntilAccessoriesNeedSpace() {
        let layout = TlonMessageMenuPresentationView.resolveLayout(
            bounds: CGRect(x: 0, y: 0, width: 390, height: 844),
            safeInsets: UIEdgeInsets(top: 47, left: 0, bottom: 34, right: 0),
            sourceFrame: CGRect(x: 24, y: 300, width: 342, height: 100),
            actionContentHeight: 400,
            actionWidth: 252,
            reactionSize: CGSize(width: 200, height: 58),
            alignment: .leading,
            accessoryGap: 8
        )

        XCTAssertEqual(
            layout.previewFrame,
            CGRect(x: 24, y: 290, width: 342, height: 100)
        )
        XCTAssertEqual(
            layout.actionFrame,
            CGRect(x: 24, y: 398, width: 252, height: 400)
        )
        XCTAssertEqual(
            layout.reactionFrame,
            CGRect(x: 24, y: 224, width: 200, height: 58)
        )
    }

    func testTrailingLayoutAlignsAccessoriesWithPreviewEdge() {
        let layout = TlonMessageMenuPresentationView.resolveLayout(
            bounds: CGRect(x: 0, y: 0, width: 390, height: 844),
            safeInsets: UIEdgeInsets(top: 47, left: 0, bottom: 34, right: 0),
            sourceFrame: CGRect(x: 24, y: 200, width: 342, height: 100),
            actionContentHeight: 200,
            actionWidth: 252,
            reactionSize: CGSize(width: 200, height: 58),
            alignment: .trailing,
            accessoryGap: 8
        )

        XCTAssertEqual(layout.previewFrame.minY, 200)
        XCTAssertEqual(layout.actionFrame.minX, 114)
        XCTAssertEqual(layout.reactionFrame?.minX, 166)
    }
}
