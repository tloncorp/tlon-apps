//
//  YarnTests.swift
//  LandscapeTests
//
//  Created by Alec Ananian on 12/15/23.
//

import Landscape
import XCTest

final class YarnTests: XCTestCase {
    let testMessage = "Test message"
    let testShip = "~sampel-palnet"
    let shipContent = YarnContent.ship(YarnContentShip(ship: "~sampel-palnet"))
    let textContent = YarnContent.text("Test message")
    let testRope = Rope(group: nil, channel: nil, desk: "groups", thread: "testThread")

    func testSenderShipName() {
        let yarn = Yarn(
            id: "testNotification",
            rope: testRope,
            time: 1_702_689_341,
            con: [
                shipContent,
                YarnContent.text(": "),
                textContent,
            ],
            wer: "testWer"
        )

        XCTAssertTrue(yarn.isValidNotification)
        XCTAssertEqual(yarn.senderShipName, testShip)
        XCTAssertEqual(yarn.body, testMessage)
    }

    func testMentionBody() {
        let yarn = Yarn(
            id: "testNotification",
            rope: testRope,
            time: 1_702_689_341,
            con: [
                shipContent,
                YarnContent.text(" mentioned you: "),
                textContent,
            ],
            wer: "testWer"
        )

        XCTAssertEqual(yarn.body, testMessage)
    }

    func testDMReplyBody() {
        let yarn = Yarn(
            id: "testNotification",
            rope: testRope,
            time: 1_702_689_341,
            con: [
                shipContent,
                YarnContent.text(" replied to "),
                YarnContent.emph(YarnContentEmphasis(emph: "Test parent message")),
                YarnContent.text(": "),
                shipContent,
                YarnContent.text(": "),
                textContent,
            ],
            wer: "testWer"
        )

        XCTAssertEqual(yarn.body, testMessage)
    }

    func testGroupReplyBody() {
        let yarn = Yarn(
            id: "testNotification",
            rope: testRope,
            time: 1_702_689_341,
            con: [
                shipContent,
                YarnContent.text(" replied to you: "),
                textContent,
            ],
            wer: "testWer"
        )

        XCTAssertEqual(yarn.body, testMessage)
    }

    func testAllNotificationsBody() {
        let yarn = Yarn(
            id: "testNotification",
            rope: testRope,
            time: 1_702_689_341,
            con: [
                shipContent,
                YarnContent.text(" sent a message: "),
                textContent,
            ],
            wer: "testWer"
        )

        XCTAssertEqual(yarn.body, testMessage)
    }
}
