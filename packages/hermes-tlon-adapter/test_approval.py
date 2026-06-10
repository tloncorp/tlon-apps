import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_approval_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(module_name, PACKAGE_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


load_module("tlon_api")
approval = load_module("approval")

NOW_MS = 1_700_000_000_000.0


def make_approval(**overrides):
    base = {
        "id": "d1b2c",
        "type": "dm",
        "requestingShip": "~ten",
        "timestamp": int(NOW_MS),
        "messagePreview": "hello there",
    }
    base.update(overrides)
    return base


class CodecTests(unittest.TestCase):
    def test_create_pending_approval_shape(self):
        item = approval.create_pending_approval(
            approval_kind="channel",
            requesting_ship="ten",
            now_ms=NOW_MS,
            channel_nest="chat/~pen/general",
            message_preview="x" * 200,
            original_message={"messageId": "1", "messageText": "x" * 200, "timestamp": 5},
        )
        self.assertTrue(item["id"].startswith("c"))
        self.assertEqual(len(item["id"]), 5)
        self.assertEqual(item["requestingShip"], "~ten")
        self.assertEqual(item["channelNest"], "chat/~pen/general")
        self.assertLessEqual(len(item["messagePreview"]), approval.PREVIEW_MAX_CHARS)
        self.assertEqual(item["timestamp"], int(NOW_MS))

    def test_generate_id_avoids_collisions(self):
        existing = []
        for _ in range(50):
            new_id = approval.generate_approval_id("dm", existing)
            self.assertNotIn(new_id, existing)
            existing.append(new_id)

    def test_expiry_and_prune(self):
        fresh = make_approval()
        stale = make_approval(id="d9999", timestamp=int(NOW_MS - approval.APPROVAL_TTL_MS - 1))
        missing = {"id": "dxxxx", "type": "dm", "requestingShip": "~bus"}
        pruned = approval.prune_expired([fresh, stale, missing, "junk"], NOW_MS)
        self.assertEqual([approval.approval_id(item) for item in pruned], ["d1b2c"])

    def test_parse_preserves_unknown_fields(self):
        raw = [make_approval(notificationMessageId="170.1", customField={"x": 1}), 7, "junk"]
        parsed = approval.parse_pending_approvals(raw)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["customField"], {"x": 1})

    def test_find_and_remove(self):
        items = [make_approval(), make_approval(id="c3d4e", type="channel")]
        self.assertIsNotNone(approval.find_approval(items, "d1b2c"))
        self.assertIsNotNone(approval.find_approval(items, "#D1B2C"))
        self.assertIsNone(approval.find_approval(items, "zzzzz"))
        remaining = approval.remove_approval(items, "#d1b2c")
        self.assertEqual([approval.approval_id(item) for item in remaining], ["c3d4e"])

    def test_find_duplicate_scopes_channel_by_nest(self):
        dm = make_approval()
        channel = make_approval(id="c1111", type="channel", channelNest="chat/~pen/general")
        items = [dm, channel]
        self.assertIsNotNone(
            approval.find_duplicate(items, make_approval(id="other"))
        )
        self.assertIsNotNone(
            approval.find_duplicate(
                items,
                make_approval(id="x", type="channel", channelNest="chat/~pen/general"),
            )
        )
        self.assertIsNone(
            approval.find_duplicate(
                items,
                make_approval(id="x", type="channel", channelNest="chat/~pen/other"),
            )
        )

    def test_parse_dm_allowlist(self):
        self.assertEqual(
            approval.parse_dm_allowlist(["~ten", "bus", "", 7]),
            {"~ten", "~bus", "~7"},
        )
        self.assertEqual(approval.parse_dm_allowlist("nope"), set())


class CommandParseTests(unittest.TestCase):
    def test_commands_parse(self):
        self.assertEqual(approval.parse_approval_command("/allow d1b2c"), ("allow", "d1b2c"))
        self.assertEqual(approval.parse_approval_command("/reject #d1b2c"), ("reject", "#d1b2c"))
        self.assertEqual(approval.parse_approval_command("/ban ~ten"), ("ban", "~ten"))
        self.assertEqual(approval.parse_approval_command("/unban ~ten"), ("unban", "~ten"))
        self.assertEqual(approval.parse_approval_command("/pending"), ("pending", ""))
        self.assertEqual(approval.parse_approval_command("/banned"), ("banned", ""))
        self.assertEqual(approval.parse_approval_command("/allow"), ("allow", ""))

    def test_non_commands_do_not_parse(self):
        for text in ("/allowance d1", "/pending now", "allow d1", "/bans ~x"):
            self.assertIsNone(approval.parse_approval_command(text), text)

class FormattingTests(unittest.TestCase):
    def test_request_text_includes_id_ship_preview_and_hints(self):
        text = approval.format_approval_request(make_approval())
        self.assertIn("#d1b2c", text)
        self.assertIn("From: ~ten", text)
        self.assertIn('"hello there"', text)
        self.assertIn("/allow d1b2c", text)

    def test_channel_request_includes_nest(self):
        text = approval.format_approval_request(
            make_approval(type="channel", channelNest="chat/~pen/general")
        )
        self.assertIn("Channel: chat/~pen/general", text)

    def test_pending_list(self):
        self.assertEqual(approval.format_pending_list([]), "No pending approvals.")
        text = approval.format_pending_list([make_approval()])
        self.assertIn("1 pending approval(s):", text)
        self.assertIn("#d1b2c", text)

    def test_confirmations(self):
        self.assertIn("can now DM", approval.format_confirmation(make_approval(), "allow"))
        self.assertIn(
            "can now address the bot in chat/~pen/general",
            approval.format_confirmation(
                make_approval(type="channel", channelNest="chat/~pen/general"), "allow"
            ),
        )
        self.assertIn("Rejected", approval.format_confirmation(make_approval(), "reject"))
        self.assertIn("Blocked ~ten", approval.format_confirmation(make_approval(), "ban"))

    def test_blocked_list(self):
        self.assertEqual(approval.format_blocked_list([]), "No blocked ships.")
        text = approval.format_blocked_list(["~ten", "bus"])
        self.assertIn("• ~bus", text)
        self.assertIn("• ~ten", text)


class A2UICardTests(unittest.TestCase):
    def card_components(self, card):
        update = card["messages"][1]["updateComponents"]
        return {component["id"]: component for component in update["components"]}, update

    def test_blob_envelope(self):
        card = approval.build_approval_card(make_approval())
        self.assertEqual(card["type"], "a2ui")
        self.assertEqual(card["version"], 1)
        create = card["messages"][0]["createSurface"]
        self.assertEqual(create["catalogId"], approval.A2UI_CATALOG_ID)
        self.assertEqual(create["surfaceId"], "approval-d1b2c")
        serialized = approval.serialize_blob(card)
        parsed = json.loads(serialized)
        self.assertIsInstance(parsed, list)
        self.assertEqual(parsed[0]["type"], "a2ui")

    def test_component_tree_is_fully_linked(self):
        card = approval.build_approval_card(
            make_approval(
                type="channel",
                channelNest="chat/~pen/general",
                originalMessage={"messageId": "170.1", "messageText": "hi", "timestamp": 1},
            )
        )
        components, update = self.card_components(card)
        self.assertEqual(update["root"], "root")
        self.assertIn("root", components)
        for component in components.values():
            for ref in [
                *(component.get("children") or []),
                *([component["child"]] if component.get("child") else []),
            ]:
                self.assertIn(ref, components, f"dangling ref {ref}")

    def test_buttons_send_owner_commands(self):
        card = approval.build_approval_card(make_approval())
        components, _ = self.card_components(card)
        self.assertEqual(
            components["allow"]["action"]["event"]["context"]["text"], "/allow d1b2c"
        )
        self.assertEqual(
            components["reject"]["action"]["event"]["context"]["text"], "/reject d1b2c"
        )
        self.assertEqual(
            components["ban"]["action"]["event"]["context"]["text"], "/ban d1b2c"
        )
        self.assertEqual(
            components["allow"]["action"]["event"]["name"], "tlon.sendMessage"
        )

    def test_dm_card_navigation_targets_dm(self):
        card = approval.build_approval_card(
            make_approval(originalMessage={"messageId": "170.1", "messageText": "hi", "timestamp": 1})
        )
        components, _ = self.card_components(card)
        target = components["viewMessage"]["action"]["event"]["context"]["target"]
        self.assertEqual(target["type"], "message")
        self.assertEqual(target["postId"], "170.1")
        self.assertEqual(target["channelId"], "~ten")

    def test_channel_card_navigation_targets_nest(self):
        card = approval.build_approval_card(
            make_approval(
                type="channel",
                channelNest="chat/~pen/general",
                originalMessage={
                    "messageId": "170.1",
                    "messageText": "hi",
                    "timestamp": 1,
                    "parentId": "170.0",
                },
            )
        )
        components, _ = self.card_components(card)
        target = components["viewMessage"]["action"]["event"]["context"]["target"]
        self.assertEqual(target["channelId"], "chat/~pen/general")
        self.assertEqual(target["parentId"], "170.0")

    def test_invite_card_has_no_view_button(self):
        card = approval.build_approval_card(make_approval(messagePreview=approval.DM_INVITE_PREVIEW))
        components, _ = self.card_components(card)
        self.assertNotIn("viewMessage", components)
        self.assertNotIn("viewMessage", components["actions"]["children"])


if __name__ == "__main__":
    unittest.main()
