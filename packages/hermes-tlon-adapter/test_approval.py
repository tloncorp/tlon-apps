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

    def test_skips_joins_already_in_flight(self):
        # The post-/allow foreigns fact still carries the valid invite with
        # progress set; reprocessing it would re-card the owner.
        joining = foreign("~ten")
        joining["progress"] = "join"
        errored = foreign("~bus")
        errored["progress"] = "error"
        payload = {"~host/joining": joining, "~host/errored": errored}
        invites = approval.parse_foreigns(payload)
        self.assertEqual([inv["groupFlag"] for inv in invites], ["~host/errored"])

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
        # Host flag rides alongside the title on every owner-facing surface.
        self.assertIn("Group: Project Space (~host/projects)", request)
        self.assertIn(
            "joining Project Space (~host/projects)",
            approval.format_confirmation(group, "allow"),
        )
        self.assertIn(
            "declined invite to Project Space (~host/projects)",
            approval.format_confirmation(group, "reject"),
        )
        # falls back to flag when no title
        no_title = make_approval(type="group", groupFlag="~host/projects")
        self.assertIn("~host/projects", approval.format_confirmation(no_title, "allow"))
        self.assertNotIn("()", approval.format_confirmation(no_title, "allow"))

    def test_pending_list_group_row_is_bounded(self):
        oversized = make_approval(
            id="g1a2b",
            type="group",
            groupFlag=f"~host/{'g' * 5_000}",
            groupTitle="x" * 5_000,
        )
        text = approval.format_pending_list([oversized])
        self.assertIn("~host/", text)
        self.assertLess(len(text), 1_000)

    def test_blocked_list(self):
        self.assertEqual(approval.format_blocked_list([]), "No blocked ships.")
        text = approval.format_blocked_list(["~ten", "bus"])
        self.assertIn("• ~bus", text)
        self.assertIn("• ~ten", text)


class A2UICardTests(unittest.TestCase):
    def card_components(self, card):
        update = card["messages"][1]["updateComponents"]
        return {component["id"]: component for component in update["components"]}, update

    def test_migration_cards_have_one_exact_action(self):
        for command, expected_copy in (
            (
                "/migrate diary/~bot/log --allow-write-widening",
                (
                    "Write access",
                    'Migrate "Field Notes" to %notes with wider write access?',
                    "The diary permissions cannot be preserved without widening write access.",
                    "Every reader will become an editor and will be able to edit every note in the migrated notebook.",
                    "Accept widening and proceed — every reader becomes an editor",
                ),
            ),
            (
                "/migrate diary/~bot/log",
                (
                    "Diary migration",
                    'Migrate "Field Notes" to %notes?',
                    "%diary is deprecated; migrating lets the bot read and post in this channel.",
                    approval.MIGRATION_CARD_WARNING,
                    "Migrate diary",
                ),
            ),
            (
                "/migrate cleanup notes/~bot/log",
                (
                    "Migration cleanup",
                    'Delete migrated notebook "Field Notes"?',
                    "Use this after a failed migration leaves a partial %notes notebook.",
                    "The migrated notebook will be deleted; the archived diary will not be changed.",
                    "Delete notebook",
                ),
            ),
        ):
            eyebrow, title, context, allow_note, expected_label = expected_copy
            card = json.loads(
                approval.build_migrate_card(command, title="  Field Notes  ")
            )[0]
            self.assertTrue(approval.validate_a2ui_card(card))
            components, _ = self.card_components(card)
            self.assertEqual(components["root"]["child"], "body")
            self.assertEqual(
                components["body"]["children"],
                [
                    "eyebrow",
                    "title",
                    "titleDivider",
                    "context0",
                    "context1",
                    "divider",
                    "details",
                    "actions",
                ],
            )
            self.assertEqual(components["eyebrow"]["variant"], "caption")
            self.assertEqual(components["eyebrow"]["text"], eyebrow)
            self.assertEqual(components["title"]["variant"], "h3")
            self.assertEqual(components["title"]["text"], title)
            self.assertEqual(components["context0"]["text"], context)
            self.assertEqual(components["context1"]["text"], f"Command: {command}")
            self.assertEqual(components["details"]["children"], ["allowNote"])
            self.assertEqual(components["allowNote"]["text"], allow_note)
            self.assertEqual(components["actions"]["children"], ["action"])
            buttons = [
                component
                for component in components.values()
                if component["component"] == "Button"
            ]
            self.assertEqual(len(buttons), 1)
            button = buttons[0]
            self.assertEqual(
                button["action"]["event"]["context"]["text"],
                command,
            )
            self.assertEqual(
                components[button["child"]]["text"],
                expected_label,
            )

    def test_migration_card_truncates_title_and_command_like_reference(self):
        command = f"/migrate {'c' * 983}"
        card = json.loads(
            approval.build_migrate_card(command, title="t" * 61)
        )[0]
        components, _ = self.card_components(card)

        self.assertEqual(
            components["title"]["text"],
            f'Migrate "{"t" * 57}..." to %notes?',
        )
        self.assertEqual(
            components["context1"]["text"],
            f"Command: {command[:988]}...",
        )
        self.assertEqual(len(components["context1"]["text"]), 1000)

    def test_migration_card_keeps_31_emoji_title_intact(self):
        title = "\U0001f600" * 31
        card = json.loads(
            approval.build_migrate_card("/migrate diary/~pen/log", title=title)
        )[0]
        components, _ = self.card_components(card)

        self.assertEqual(
            components["title"]["text"],
            f'Migrate "{title}" to %notes?',
        )

    def test_migration_card_rejects_failed_validation(self):
        original = approval.validate_a2ui_card
        approval.validate_a2ui_card = lambda _card: False
        self.addCleanup(setattr, approval, "validate_a2ui_card", original)

        with self.assertRaisesRegex(ValueError, "invalid migration"):
            approval.build_migrate_card(
                "/migrate cleanup notes/~bot/log"
            )

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

    def test_card_navigation_carries_parent_author_and_group(self):
        card = approval.build_approval_card(
            make_approval(
                type="channel",
                channelNest="chat/~pen/general",
                originalMessage={
                    "messageId": "170.1",
                    "messageText": "hi",
                    "timestamp": 1,
                    "parentId": "170.0",
                    "parentAuthorId": "~mug",
                },
            ),
            channel_groups={"chat/~pen/general": "~host/projects"},
        )
        components, _ = self.card_components(card)
        target = components["viewMessage"]["action"]["event"]["context"]["target"]
        self.assertEqual(target["parentId"], "170.0")
        self.assertEqual(target["parentAuthorId"], "~mug")
        self.assertEqual(target["groupId"], "~host/projects")
        self.assertTrue(approval.validate_a2ui_card(card))

    def test_card_navigation_omits_unresolved_optional_fields(self):
        """An empty optional field invalidates the whole blob, so absent data
        must stay absent rather than render as ''."""
        card = approval.build_approval_card(
            make_approval(
                type="channel",
                channelNest="chat/~pen/general",
                originalMessage={
                    "messageId": "170.1",
                    "messageText": "hi",
                    "timestamp": 1,
                    "parentAuthorId": "   ",
                },
            ),
            channel_groups={"chat/~other/general": "~host/projects"},
        )
        components, _ = self.card_components(card)
        target = components["viewMessage"]["action"]["event"]["context"]["target"]
        for field in ("parentId", "parentAuthorId", "groupId"):
            self.assertNotIn(field, target)
        self.assertTrue(approval.validate_a2ui_card(card))

    def test_dm_source_hidden_when_recipient_does_not_see_bot_dms(self):
        dm = make_approval(
            originalMessage={"messageId": "170.1", "messageText": "hi", "timestamp": 1}
        )
        channel = make_approval(
            id="c1a2b",
            type="channel",
            channelNest="chat/~pen/general",
            originalMessage={"messageId": "170.2", "messageText": "hi", "timestamp": 1},
        )

        gated_dm, _ = self.card_components(
            approval.build_approval_card(dm, recipient_sees_bot_dms=False)
        )
        self.assertNotIn("viewMessage", gated_dm)
        self.assertNotIn("viewMessage", gated_dm["actions"]["children"])

        # channel sources stay navigable for a separate owner ship
        gated_channel, _ = self.card_components(
            approval.build_approval_card(channel, recipient_sees_bot_dms=False)
        )
        self.assertIn("viewMessage", gated_channel["actions"]["children"])

        default_dm, _ = self.card_components(approval.build_approval_card(dm))
        self.assertIn("viewMessage", default_dm["actions"]["children"])

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
        # Card title stays title-only; the host flag rides the context line.
        self.assertIn("Project Space", components["title"]["text"])
        self.assertNotIn("~host/projects", components["title"]["text"])
        context_texts = [
            components[c]["text"] for c in components if c.startswith("context")
        ]
        self.assertIn("Inviter: ~ten", context_texts)
        self.assertIn("Group: Project Space (~host/projects)", context_texts)
        self.assertEqual(
            components["allow"]["action"]["event"]["context"]["text"], "/allow g9f3a"
        )

    def test_card_survives_oversized_persisted_fields(self):
        """Pending approvals are untrusted persisted JSON; a corrupted
        groupTitle or channelNest must not blow the a2ui validator's size
        limits — every button command must still resolve to its approval."""
        oversized_group = make_approval(
            id="g1a2b",
            type="group",
            requestingShip="~ten",
            groupFlag="~host/projects",
            groupTitle="x" * 50_000,
        )
        oversized_channel = make_approval(
            id="c3d4e",
            type="channel",
            requestingShip="~pen",
            channelNest="y" * 50_000,
        )
        store = [oversized_group, oversized_channel]
        for item in store:
            card = approval.build_approval_card(item)
            self.assertTrue(approval.validate_a2ui_card(card))
            components, _ = self.card_components(card)
            for component in components.values():
                if component.get("component") != "Button":
                    continue
                command_text = component["action"]["event"]["context"]["text"]
                parsed = approval.parse_approval_command(command_text)
                self.assertIsNotNone(parsed)
                _action, arg = parsed
                resolved = approval.find_approval(store, arg)
                self.assertIsNotNone(resolved)
                self.assertEqual(resolved["id"], item["id"])
        # The host flag survives the oversized title on the Group context line.
        group_card = approval.build_approval_card(oversized_group)
        group_components, _ = self.card_components(group_card)
        context_texts = [
            component["text"]
            for component in group_components.values()
            if component.get("component") == "Text"
            and str(component.get("text", "")).startswith("Group: ")
        ]
        self.assertEqual(len(context_texts), 1)
        self.assertIn("~host/projects", context_texts[0])


class PendingApprovalsA2UITests(unittest.TestCase):
    def approvals(self, count):
        """Fully loaded items: preview line plus a navigable source message."""
        return [
            make_approval(
                id=f"d{index}",
                messagePreview=f"request {index}",
                requestingShip=f"~ship{index}",
                originalMessage={
                    "messageId": f"170.14{index}",
                    "messageText": f"request {index}",
                    "timestamp": 1,
                    "parentId": "170.100",
                    "parentAuthorId": "~mug",
                },
            )
            for index in range(count)
        ]

    @staticmethod
    def components(card):
        return card["messages"][1]["updateComponents"]["components"]

    def component_map(self, card):
        return {component["id"]: component for component in self.components(card)}

    def test_pending_card_is_valid_for_one_and_four_items(self):
        for count in (1, 4):
            card = approval.build_pending_approvals_card(self.approvals(count))
            self.assertTrue(approval.validate_a2ui_card(card))
            components = self.components(card)
            ids = [component["id"] for component in components]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertLessEqual(len(components), 50)
            self.assertIn(f"/allow d{count - 1}", json.dumps(card))
            self.assertIn(f"/reject d{count - 1}", json.dumps(card))
            self.assertIn(f"/ban d{count - 1}", json.dumps(card))
            self.assertIn(f"item{count - 1}View", ids)
        # the budget the MAX_PENDING_APPROVALS_A2UI comment is derived from:
        # 9 shared + 9 per fully loaded item + 3 dividers
        four_items = approval.build_pending_approvals_card(self.approvals(4))
        self.assertEqual(len(self.components(four_items)), 48)

    def test_pending_card_items_carry_their_own_source_links(self):
        items = [
            *self.approvals(1),
            make_approval(
                id="c1a2b",
                type="channel",
                channelNest="chat/~pen/general",
                requestingShip="~bus",
                messagePreview="mention",
                originalMessage={
                    "messageId": "170.9",
                    "messageText": "mention",
                    "timestamp": 1,
                },
            ),
        ]

        card = approval.build_pending_approvals_card(
            items, channel_groups={"chat/~pen/general": "~host/projects"}
        )
        components = self.component_map(card)

        self.assertTrue(approval.validate_a2ui_card(card))
        # the view button rides in the item's actions row, not a row of its own
        self.assertEqual(
            components["item0Actions"]["children"],
            ["item0Allow", "item0Reject", "item0Block", "item0View"],
        )
        self.assertEqual(components["item0View"]["child"], "viewMessageLabel")
        self.assertEqual(components["item1View"]["child"], "viewMessageLabel")
        first = components["item0View"]["action"]["event"]
        second = components["item1View"]["action"]["event"]
        self.assertEqual(first["name"], approval.A2UI_ACTION_NAVIGATE)
        self.assertEqual(first["context"]["target"]["postId"], "170.140")
        self.assertEqual(first["context"]["target"]["channelId"], "~ship0")
        self.assertEqual(first["context"]["target"]["parentAuthorId"], "~mug")
        self.assertEqual(second["context"]["target"]["postId"], "170.9")
        self.assertEqual(
            second["context"]["target"]["channelId"], "chat/~pen/general"
        )
        self.assertEqual(second["context"]["target"]["groupId"], "~host/projects")

    def test_pending_card_gate_hides_dm_sources_and_keeps_channel_sources(self):
        items = [
            *self.approvals(1),
            make_approval(
                id="c1a2b",
                type="channel",
                channelNest="chat/~pen/general",
                requestingShip="~bus",
                originalMessage={
                    "messageId": "170.9",
                    "messageText": "mention",
                    "timestamp": 1,
                },
            ),
        ]

        card = approval.build_pending_approvals_card(
            items, recipient_sees_bot_dms=False
        )
        components = self.component_map(card)

        self.assertTrue(approval.validate_a2ui_card(card))
        self.assertNotIn("item0View", components)
        self.assertEqual(
            components["item0Actions"]["children"],
            ["item0Allow", "item0Reject", "item0Block"],
        )
        self.assertIn("item1View", components["item1Actions"]["children"])

    def test_pending_card_falls_back_outside_dm_card_budget_or_with_bad_id(self):
        self.assertIsNone(approval.build_pending_approvals_card([]))
        self.assertIsNone(approval.build_pending_approvals_card(self.approvals(5)))
        malformed = self.approvals(1)
        malformed[0]["id"] = "bad id"
        self.assertIsNone(approval.build_pending_approvals_card(malformed))

        text, blob = approval.build_pending_approvals_response(malformed, is_dm=True)
        self.assertIsNone(blob)
        self.assertIn("[unactionable approval ID]", text)
        self.assertIn("/allow <id>", text)

    def test_pending_response_keeps_full_text_fallback_beneath_card(self):
        approvals = self.approvals(2)
        text, blob = approval.build_pending_approvals_response(approvals, is_dm=True)

        self.assertEqual(text, approval.format_pending_list(approvals))
        self.assertIn("#d0", text)
        self.assertIn("#d1", text)
        self.assertIn("/allow <id> · /reject <id> · /ban <id>", text)
        self.assertIsNotNone(blob)
        self.assertTrue(approval.validate_a2ui_card(json.loads(blob)[0]))

        channel_text, channel_blob = approval.build_pending_approvals_response(
            approvals, is_dm=False
        )
        self.assertEqual(channel_text, text)
        self.assertIsNone(channel_blob)

    def test_pending_response_falls_back_when_validation_rejects_card(self):
        approvals = self.approvals(2)
        original = approval.validate_a2ui_card
        approval.validate_a2ui_card = lambda _card: False
        self.addCleanup(setattr, approval, "validate_a2ui_card", original)

        text, blob = approval.build_pending_approvals_response(approvals, is_dm=True)
        self.assertEqual(text, approval.format_pending_list(approvals))
        self.assertIsNone(blob)

    def test_pending_response_falls_back_when_any_card_stage_raises(self):
        """Build, validate, and serialize are all inside the guard, and the
        guard is not limited to (TypeError, ValueError)."""
        approvals = self.approvals(2)
        for stage, error in (
            ("build_pending_approvals_card", RuntimeError("builder regression")),
            ("validate_a2ui_card", KeyError("component")),
            ("serialize_blob", RuntimeError("not serializable")),
        ):
            with self.subTest(stage=stage):
                original = getattr(approval, stage)

                def raise_error(*_args, _error=error, **_kwargs):
                    raise _error

                setattr(approval, stage, raise_error)
                self.addCleanup(setattr, approval, stage, original)
                try:
                    text, blob = approval.build_pending_approvals_response(
                        approvals, is_dm=True
                    )
                finally:
                    setattr(approval, stage, original)

                self.assertEqual(text, approval.format_pending_list(approvals))
                self.assertIsNone(blob)

    def test_validator_rejects_duplicate_dangling_and_cyclic_components(self):
        card = approval.build_pending_approvals_card(self.approvals(1))
        components = self.components(card)
        components.append(dict(components[0]))
        self.assertFalse(approval.validate_a2ui_card(card))

        card = approval.build_pending_approvals_card(self.approvals(1))
        components = self.components(card)
        next(component for component in components if component["id"] == "body")["children"].append(
            "missing"
        )
        self.assertFalse(approval.validate_a2ui_card(card))

        card = approval.build_pending_approvals_card(self.approvals(1))
        next(component for component in self.components(card) if component["id"] == "body")[
            "children"
        ].append("root")
        self.assertFalse(approval.validate_a2ui_card(card))

    def test_pending_text_is_bounded_for_hostile_persisted_data(self):
        approvals = [
            make_approval(
                id=" " * 50_000,
                type="not-a-real-kind" * 5_000,
                requestingShip="~" + "s" * 50_000,
                channelNest="n" * 50_000,
                groupFlag="g" * 50_000,
                groupTitle="t" * 50_000,
                messagePreview="p" * 50_000,
            )
            for _ in range(30)
        ]
        text, blob = approval.build_pending_approvals_response(approvals, is_dm=True)

        self.assertIsNone(blob)
        self.assertLessEqual(len(text), 10_000)
        self.assertIn("[unactionable approval ID]", text)
        self.assertIn("5 more pending approval(s) not shown.", text)
        self.assertIn("/allow <id> · /reject <id> · /ban <id>", text)


if __name__ == "__main__":
    unittest.main()
