import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_channel_access_testpkg"

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
load_module("owner_listen")
ca = load_module("channel_access")

NEST = "chat/~pen/general"


class ParseRulesTests(unittest.TestCase):
    def test_canonicalizes_keys_and_preserves_fields(self):
        rules = ca.parse_channel_rules(
            {
                "Chat/~PEN/general": {"mode": "open", "extra": 1},
                "bogus": {"mode": "open"},
                "chat/~ten/lounge": "junk",
            }
        )
        self.assertEqual(list(rules), [NEST])
        self.assertEqual(rules[NEST], {"mode": "open", "extra": 1})

    def test_parse_accepts_json_string_encoding(self):
        # how the value actually round-trips through %settings (and OpenClaw)
        encoded = json.dumps({NEST: {"mode": "open"}})
        self.assertEqual(ca.parse_channel_rules(encoded), {NEST: {"mode": "open"}})
        self.assertEqual(ca.parse_channel_rules("not json"), {})

    def test_modes_default_restricted(self):
        rules = {NEST: {"mode": "open"}}
        self.assertTrue(ca.is_channel_open(rules, NEST))
        self.assertFalse(ca.is_channel_open(rules, "chat/~ten/lounge"))
        self.assertFalse(ca.is_channel_open({NEST: {"mode": "weird"}}, NEST))
        self.assertFalse(ca.is_channel_open({}, "not-a-nest"))

    def test_allowed_ships_normalized(self):
        rules = {NEST: {"allowedShips": ["ten", "~bus", 7]}}
        self.assertEqual(ca.channel_allowed_ships(rules, NEST), frozenset({"~ten", "~bus", "~7"}))
        self.assertEqual(ca.channel_allowed_ships(rules, "chat/~x/y"), frozenset())

    def test_set_mode_preserves_other_fields_and_nests(self):
        rules = {
            NEST: {"mode": "open", "allowedShips": ["~ten"]},
            "chat/~ten/lounge": {"mode": "restricted"},
        }
        updated = ca.set_channel_mode(rules, NEST, "restricted")
        self.assertEqual(updated[NEST]["mode"], "restricted")
        self.assertEqual(updated[NEST]["allowedShips"], ["~ten"])
        self.assertEqual(updated["chat/~ten/lounge"], {"mode": "restricted"})
        # original untouched
        self.assertEqual(rules[NEST]["mode"], "open")

    def test_add_allowed_ship_dedups_and_preserves_mode(self):
        rules = {NEST: {"mode": "restricted", "allowedShips": ["~ten"]}}
        updated = ca.add_channel_allowed_ship(rules, NEST, "ten")
        self.assertEqual(updated[NEST]["allowedShips"], ["~ten"])
        updated = ca.add_channel_allowed_ship(updated, NEST, "~bus")
        self.assertEqual(updated[NEST]["allowedShips"], ["~ten", "~bus"])
        self.assertEqual(updated[NEST]["mode"], "restricted")
        fresh = ca.add_channel_allowed_ship({}, "chat/~new/spot", "~ten")
        self.assertEqual(fresh["chat/~new/spot"]["allowedShips"], ["~ten"])


class CommandTests(unittest.TestCase):
    def test_command_detection_and_args(self):
        self.assertTrue(ca.is_channel_access_command("/channel-access open"))
        self.assertTrue(ca.is_channel_access_command("/Channel-Access"))
        self.assertFalse(ca.is_channel_access_command("/channel-accessory"))
        self.assertEqual(ca.channel_access_command_args("/channel-access open x"), "open x")

    def test_status_uses_ctx_nest(self):
        outcome = ca.apply_channel_access_command({}, "", ctx_nest=NEST)
        self.assertIn(f"Channel access for {NEST}: restricted", outcome.reply)
        self.assertIsNone(outcome.new_rules)

    def test_open_returns_rules_and_opened_nest(self):
        outcome = ca.apply_channel_access_command({}, "open", ctx_nest=NEST)
        self.assertIsNotNone(outcome.new_rules)
        self.assertEqual(outcome.new_rules[NEST]["mode"], "open")
        self.assertEqual(outcome.opened_nest, NEST)
        self.assertIn("open — anyone here can address the bot", outcome.reply)

    def test_restrict_with_explicit_nest(self):
        rules = {NEST: {"mode": "open"}}
        outcome = ca.apply_channel_access_command(rules, f"restricted {NEST}", ctx_nest=None)
        self.assertEqual(outcome.new_rules[NEST]["mode"], "restricted")
        self.assertIsNone(outcome.opened_nest)

    def test_noop_when_mode_already_set(self):
        outcome = ca.apply_channel_access_command({}, "restricted", ctx_nest=NEST)
        self.assertIsNone(outcome.new_rules)
        self.assertIn("already restricted", outcome.reply)

    def test_list_and_errors(self):
        self.assertEqual(
            ca.apply_channel_access_command({}, "list", ctx_nest=None).reply,
            "No per-channel access rules.",
        )
        listing = ca.apply_channel_access_command(
            {NEST: {"mode": "open"}}, "list", ctx_nest=None
        ).reply
        self.assertIn(f"• {NEST}: open", listing)
        self.assertIn(
            "not a valid channel nest",
            ca.apply_channel_access_command({}, "open nope", ctx_nest=None).reply,
        )
        self.assertIn(
            "Run inside a channel",
            ca.apply_channel_access_command({}, "open", ctx_nest=None).reply,
        )
        self.assertEqual(
            ca.apply_channel_access_command({}, "sideways", ctx_nest=NEST).reply,
            ca.CHANNEL_ACCESS_USAGE,
        )


if __name__ == "__main__":
    unittest.main()
