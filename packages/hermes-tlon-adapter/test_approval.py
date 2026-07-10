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

    def test_parse_accepts_json_string_encoding(self):
        # how the value actually round-trips through %settings (and OpenClaw)
        encoded = json.dumps([make_approval()])
        parsed = approval.parse_pending_approvals(encoded)
        self.assertEqual(parsed[0]["id"], "d1b2c")
        self.assertEqual(approval.parse_pending_approvals("not json"), [])

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

    def test_find_duplicate_scopes_group_by_flag_not_inviter(self):
        existing = make_approval(id="g1", type="group", groupFlag="~host/projects")
        items = [existing]
        # Same group, different inviter → duplicate (dedup by flag).
        self.assertIsNotNone(
            approval.find_duplicate(
                items,
                make_approval(id="x", type="group", requestingShip="~bus", groupFlag="~host/projects"),
            )
        )
        # Different group, same inviter → not a duplicate.
        self.assertIsNone(
            approval.find_duplicate(
                items,
                make_approval(id="x", type="group", groupFlag="~host/other"),
            )
        )

    def test_parse_dm_allowlist(self):
        self.assertEqual(
            approval.parse_dm_allowlist(["~ten", "bus", "", 7]),
            {"~ten", "~bus", "~7"},
        )
        self.assertEqual(approval.parse_dm_allowlist("nope"), set())

    def test_parse_ship_list_ignores_non_string_entries(self):
        # Unlike parse_dm_allowlist, non-string items are dropped rather than
        # coerced (a malformed settings value must not broaden authorization).
        self.assertEqual(
            approval.parse_ship_list([7, "~zod", "", None, "bus"]),
            {"~zod", "~bus"},
        )
        self.assertEqual(approval.parse_ship_list("nope"), set())
        self.assertEqual(approval.parse_ship_list(None), set())

    def test_settings_bool_only_accepts_genuine_booleans(self):
        self.assertTrue(approval.settings_bool(True, False))
        self.assertFalse(approval.settings_bool(False, True))
        self.assertFalse(approval.settings_bool("false", False))
        self.assertTrue(approval.settings_bool("false", True))
        self.assertEqual(approval.settings_bool(1, False), False)
        self.assertEqual(approval.settings_bool(None, True), True)
        self.assertEqual(approval.settings_bool({}, False), False)


def foreign(from_ship, *, valid=True, title="Project Space", time=1):
    return {
        "invites": [
            {
                "from": from_ship,
                "valid": valid,
                "time": time,
                "preview": {"meta": {"title": title}},
            }
        ]
    }


class ForeignsTests(unittest.TestCase):
    def test_parse_extracts_valid_invites(self):
        payload = {
            "~host/projects": foreign("~ten", title="Projects"),
            "~host/lounge": foreign("~bus", title="Lounge"),
        }
        invites = approval.parse_foreigns(payload)
        by_flag = {inv["groupFlag"]: inv for inv in invites}
        self.assertEqual(set(by_flag), {"~host/projects", "~host/lounge"})
        self.assertEqual(by_flag["~host/projects"]["from"], "~ten")
        self.assertEqual(by_flag["~host/projects"]["title"], "Projects")

    def test_skips_invalid_and_empty(self):
        payload = {
            "~host/revoked": foreign("~ten", valid=False),
            "~host/none": {"invites": []},
            "~host/notmap": "junk",
            "~host/good": foreign("~bus"),
        }
        invites = approval.parse_foreigns(payload)
        self.assertEqual([inv["groupFlag"] for inv in invites], ["~host/good"])

    def test_picks_most_recent_valid_invite(self):
        payload = {
            "~host/g": {
                "invites": [
                    {"from": "~ten", "valid": True, "time": 1, "preview": {"meta": {"title": "Old"}}},
                    {"from": "~bus", "valid": True, "time": 9, "preview": {"meta": {"title": "New"}}},
                ]
            }
        }
        invite = approval.parse_foreigns(payload)[0]
        self.assertEqual(invite["from"], "~bus")
        self.assertEqual(invite["title"], "New")

    def test_non_mapping_payload(self):
        self.assertEqual(approval.parse_foreigns(None), [])
        self.assertEqual(approval.parse_foreigns([]), [])


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

    def test_group_request_and_confirmations(self):
        group = make_approval(
            type="group", groupFlag="~host/projects", groupTitle="Project Space"
        )
        request = approval.format_approval_request(group)
        self.assertIn("group invite", request)
        self.assertIn("Inviter: ~ten", request)
        self.assertIn("Group: Project Space", request)
        self.assertIn("joining Project Space", approval.format_confirmation(group, "allow"))
        self.assertIn("declined invite to Project Space", approval.format_confirmation(group, "reject"))
        # falls back to flag when no title
        no_title = make_approval(type="group", groupFlag="~host/projects")
        self.assertIn("~host/projects", approval.format_confirmation(no_title, "allow"))

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

    def test_group_card_shape_and_buttons(self):
        card = approval.build_approval_card(
            make_approval(
                id="g9f3a",
                type="group",
                requestingShip="~ten",
                groupFlag="~host/projects",
                groupTitle="Project Space",
            )
        )
        components, update = self.card_components(card)
        # fully linked, no dangling refs, no View-message button for invites
        self.assertNotIn("viewMessage", components)
        for component in components.values():
            for ref in [
                *(component.get("children") or []),
                *([component["child"]] if component.get("child") else []),
            ]:
                self.assertIn(ref, components, f"dangling ref {ref}")
        self.assertEqual(components["eyebrow"]["text"], "Group invite")
        self.assertIn("Project Space", components["title"]["text"])
        context_texts = [
            components[c]["text"] for c in components if c.startswith("context")
        ]
        self.assertIn("Inviter: ~ten", context_texts)
        self.assertIn("Group: Project Space", context_texts)
        self.assertEqual(
            components["allow"]["action"]["event"]["context"]["text"], "/allow g9f3a"
        )


if __name__ == "__main__":
    unittest.main()
