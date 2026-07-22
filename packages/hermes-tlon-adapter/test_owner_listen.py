import importlib.util
import sys
import types
import unittest
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_owner_listen_unit_testpkg"

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


tlon_api = load_module("tlon_api")
ol = load_module("owner_listen")

OWNER = "~mug"
BOT = "~pen"


def make_state(**kwargs):
    return ol.OwnerListenState(**kwargs)


class CanonicalizeNestTests(unittest.TestCase):
    def test_valid_nest_passes_through(self):
        self.assertEqual(ol.canonicalize_nest("chat/~zod/general"), "chat/~zod/general")

    def test_prefix_and_host_lowercase_name_preserved(self):
        self.assertEqual(ol.canonicalize_nest("Chat/~ZOD/General"), "chat/~zod/General")

    def test_host_gains_sig(self):
        self.assertEqual(ol.canonicalize_nest("heap/zod/art"), "heap/~zod/art")

    def test_invalid_inputs_return_none(self):
        for raw in ("", "chat/~zod", "chat/~zod/a/b", "garden/~zod/x", "chat//x", "~zod"):
            self.assertIsNone(ol.canonicalize_nest(raw), raw)


class OwnedChannelTests(unittest.TestCase):
    def test_owner_and_bot_hosts_are_owned(self):
        self.assertTrue(ol.is_owned_channel("chat/~mug/club", owner_ship=OWNER, bot_ship=BOT))
        self.assertTrue(ol.is_owned_channel("chat/~pen/general", owner_ship=OWNER, bot_ship=BOT))

    def test_other_host_is_not_owned(self):
        self.assertFalse(ol.is_owned_channel("chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT))

    def test_case_variants_match(self):
        self.assertTrue(ol.is_owned_channel("chat/~MUG/club", owner_ship="mug", bot_ship=BOT))


class OwnerListenActiveTests(unittest.TestCase):
    def test_owned_channel_defaults_on(self):
        self.assertTrue(
            ol.owner_listen_active(make_state(), "chat/~pen/general", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_non_owned_channel_defaults_off(self):
        self.assertFalse(
            ol.owner_listen_active(make_state(), "chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_enabled_channels_opt_in_any_channel(self):
        state = make_state(enabled_channels={"chat/~ten/lounge"})
        self.assertTrue(
            ol.owner_listen_active(state, "chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_disabled_channels_mute_owned_default(self):
        state = make_state(disabled_channels={"chat/~pen/general"})
        self.assertFalse(
            ol.owner_listen_active(state, "chat/~pen/general", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_global_off_overrides_everything(self):
        state = make_state(enabled=False, enabled_channels={"chat/~ten/lounge"})
        self.assertFalse(
            ol.owner_listen_active(state, "chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT)
        )
        self.assertFalse(
            ol.owner_listen_active(state, "chat/~pen/general", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_requires_owner_ship(self):
        self.assertFalse(
            ol.owner_listen_active(make_state(), "chat/~pen/general", owner_ship="", bot_ship=BOT)
        )


class SettingsCodecTests(unittest.TestCase):
    def test_parse_settings_bucket_happy_path(self):
        payload = {"all": {"moltbot": {"tlon": {"ownerListenEnabled": True}}}}
        self.assertEqual(ol.parse_settings_bucket(payload), {"ownerListenEnabled": True})

    def test_parse_settings_bucket_realistic_busy_store(self):
        # /settings/all on a real ship carries every desk's buckets; we must
        # pick out exactly moltbot/tlon.
        payload = {
            "all": {
                "landscape": {"calmEngine": {"disableNicknames": False}},
                "groups": {"groups": {"theme": "auto"}},
                "moltbot": {
                    "tlon": {"ownerListenEnabled": False, "groupChannels": ["chat/~ten/lounge"]},
                    "other-bucket": {"ownerListenEnabled": True},
                },
            }
        }
        bucket = ol.parse_settings_bucket(payload)
        self.assertEqual(
            bucket,
            {"ownerListenEnabled": False, "groupChannels": ["chat/~ten/lounge"]},
        )

    def test_parse_settings_bucket_desk_scoped_shape(self):
        # /settings/desk/moltbot wraps in "desk" instead of "all".
        payload = {"desk": {"tlon": {"ownerListenEnabled": True}}}
        self.assertEqual(ol.parse_settings_bucket(payload), {"ownerListenEnabled": True})

    def test_parse_settings_bucket_missing_levels(self):
        self.assertEqual(ol.parse_settings_bucket(None), {})
        self.assertEqual(ol.parse_settings_bucket({}), {})
        self.assertEqual(ol.parse_settings_bucket({"all": {}}), {})
        self.assertEqual(ol.parse_settings_bucket({"all": {"moltbot": {}}}), {})
        self.assertEqual(ol.parse_settings_bucket({"all": {"moltbot": {"tlon": 7}}}), {})

    def test_openclaw_store_carries_over(self):
        bucket = {
            "ownerListenEnabled": False,
            "ownerListenDisabledChannels": ["Chat/~PEN/general", "bogus"],
        }
        state = ol.owner_listen_state_from_settings(
            bucket,
            defaults=make_state(enabled_channels={"chat/~ten/lounge"}),
        )
        self.assertFalse(state.enabled)
        self.assertEqual(state.disabled_channels, {"chat/~pen/general"})
        # Key absent in the store: env default survives.
        self.assertEqual(state.enabled_channels, {"chat/~ten/lounge"})

    def test_settings_keys_override_defaults_when_present(self):
        bucket = {
            "ownerListenDisabledChannels": [],
            "ownerListenEnabledChannels": ["chat/~ten/lounge"],
        }
        state = ol.owner_listen_state_from_settings(
            bucket,
            defaults=make_state(disabled_channels={"chat/~pen/general"}),
        )
        self.assertTrue(state.enabled)
        self.assertEqual(state.disabled_channels, set())
        self.assertEqual(state.enabled_channels, {"chat/~ten/lounge"})

    def test_non_bool_enabled_falls_back_to_default(self):
        state = ol.owner_listen_state_from_settings(
            {"ownerListenEnabled": "yes"},
            defaults=make_state(enabled=False),
        )
        self.assertFalse(state.enabled)

    def test_settings_group_channels_filters_invalid(self):
        bucket = {"groupChannels": ["chat/~ten/lounge", "nope", 7]}
        self.assertEqual(ol.settings_group_channels(bucket), {"chat/~ten/lounge"})

    def test_settings_put_entry_matches_openclaw_shape(self):
        self.assertEqual(
            ol.settings_put_entry("ownerListenEnabled", False),
            {
                "put-entry": {
                    "desk": "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": "ownerListenEnabled",
                    "value": False,
                }
            },
        )


class SettingsEventTests(unittest.TestCase):
    def test_parse_put_entry_with_and_without_wrapper(self):
        put = {
            "put-entry": {
                "desk": "moltbot",
                "bucket-key": "tlon",
                "entry-key": "ownerListenEnabled",
                "value": False,
            }
        }
        for raw in (put, {"settings-event": put}):
            event = ol.parse_settings_event(raw)
            self.assertEqual(
                event,
                ol.SettingsEvent(key="ownerListenEnabled", value=False),
            )

    def test_parse_del_entry(self):
        event = ol.parse_settings_event(
            {
                "settings-event": {
                    "del-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "ownerListenDisabledChannels",
                    }
                }
            }
        )
        self.assertEqual(
            event,
            ol.SettingsEvent(key="ownerListenDisabledChannels", value=None),
        )

    def test_parse_ignores_other_desks_buckets_and_shapes(self):
        wrong_desk = {
            "put-entry": {
                "desk": "garden",
                "bucket-key": "tlon",
                "entry-key": "ownerListenEnabled",
                "value": True,
            }
        }
        wrong_bucket = {
            "del-entry": {"desk": "moltbot", "bucket-key": "other", "entry-key": "x"}
        }
        for raw in (wrong_desk, wrong_bucket, {"put-bucket": {}}, "junk", None, {}):
            self.assertIsNone(ol.parse_settings_event(raw), raw)

    def test_parse_requires_entry_key(self):
        self.assertIsNone(
            ol.parse_settings_event(
                {"put-entry": {"desk": "moltbot", "bucket-key": "tlon", "value": 1}}
            )
        )

    def apply(self, state, key, value, *, defaults=None):
        return ol.apply_owner_listen_settings_event(
            state,
            ol.SettingsEvent(key=key, value=value),
            defaults=defaults or make_state(),
        )

    def test_apply_enabled_put_and_change_detection(self):
        state = make_state()
        self.assertTrue(self.apply(state, "ownerListenEnabled", False))
        self.assertFalse(state.enabled)
        self.assertFalse(self.apply(state, "ownerListenEnabled", False))

    def test_apply_enabled_delete_or_invalid_reverts_to_default(self):
        for bad_value in (None, "yes", 1):
            state = make_state(enabled=False)
            changed = self.apply(
                state, "ownerListenEnabled", bad_value, defaults=make_state(enabled=True)
            )
            self.assertTrue(changed, bad_value)
            self.assertTrue(state.enabled)

    def test_apply_channel_lists_canonicalize(self):
        state = make_state()
        changed = self.apply(
            state, "ownerListenDisabledChannels", ["Chat/~PEN/general", "junk"]
        )
        self.assertTrue(changed)
        self.assertEqual(state.disabled_channels, {"chat/~pen/general"})

        changed = self.apply(state, "ownerListenEnabledChannels", ["chat/~ten/lounge"])
        self.assertTrue(changed)
        self.assertEqual(state.enabled_channels, {"chat/~ten/lounge"})

    def test_apply_channel_list_delete_or_invalid_reverts_to_default(self):
        defaults = make_state(disabled_channels={"chat/~pen/dev"})
        for bad_value in (None, "chat/~pen/general", 7):
            state = make_state(disabled_channels={"chat/~pen/general"})
            changed = self.apply(
                state, "ownerListenDisabledChannels", bad_value, defaults=defaults
            )
            self.assertTrue(changed, bad_value)
            self.assertEqual(state.disabled_channels, {"chat/~pen/dev"})

    def test_apply_unknown_key_is_ignored(self):
        state = make_state()
        self.assertFalse(self.apply(state, "dmAllowlist", ["~ten"]))
        self.assertTrue(state.enabled)


class CommandDetectionTests(unittest.TestCase):
    def test_command_detection(self):
        self.assertTrue(ol.is_owner_listen_command("/owner-listen"))
        self.assertTrue(ol.is_owner_listen_command("  /Owner-Listen status"))
        self.assertFalse(ol.is_owner_listen_command("/owner-listening on"))
        self.assertFalse(ol.is_owner_listen_command("owner-listen on"))

    def test_command_args(self):
        self.assertEqual(ol.owner_listen_command_args("/owner-listen on all"), "on all")
        self.assertEqual(ol.owner_listen_command_args("/owner-listen"), "")


class ApplyCommandTests(unittest.TestCase):
    def apply(self, state, raw_args, *, ctx_nest="chat/~pen/general", monitored=("chat/~pen/general",)):
        return ol.apply_owner_listen_command(
            state,
            raw_args,
            ctx_nest=ctx_nest,
            owner_ship=OWNER,
            bot_ship=BOT,
            monitored_channels=frozenset(monitored),
        )

    def test_all_status(self):
        outcome = self.apply(make_state(), "all")
        self.assertEqual(outcome.reply, "Global owner-listen: on.")
        self.assertEqual(outcome.settings_changes, {})

    def test_all_off_and_swapped_order(self):
        state = make_state()
        outcome = self.apply(state, "all off")
        self.assertFalse(state.enabled)
        self.assertEqual(outcome.settings_changes, {"ownerListenEnabled": False})

        outcome = self.apply(state, "on all")
        self.assertTrue(state.enabled)
        self.assertEqual(outcome.settings_changes, {"ownerListenEnabled": True})

    def test_all_invalid_subcommand(self):
        outcome = self.apply(make_state(), "all sideways")
        self.assertEqual(outcome.reply, "Usage: /owner-listen all [on|off]")

    def test_list_shows_overrides(self):
        state = make_state(
            disabled_channels={"chat/~pen/general"},
            enabled_channels={"chat/~ten/lounge"},
        )
        reply = self.apply(state, "list").reply
        self.assertIn("Global owner-listen: on.", reply)
        self.assertIn("• chat/~pen/general", reply)
        self.assertIn("• chat/~ten/lounge", reply)

    def test_status_uses_ctx_nest(self):
        reply = self.apply(make_state(), "status").reply
        self.assertEqual(reply, "Owner-listen for chat/~pen/general: on (active).")

    def test_bare_command_in_channel_is_status(self):
        reply = self.apply(make_state(), "").reply
        self.assertEqual(reply, "Owner-listen for chat/~pen/general: on (active).")

    def test_status_non_owned_default(self):
        reply = self.apply(make_state(), "status chat/~ten/lounge").reply
        self.assertEqual(
            reply,
            "Owner-listen for chat/~ten/lounge: off (not enabled for this channel).",
        )

    def test_enable_non_owned_channel_persists_and_monitors(self):
        state = make_state()
        outcome = self.apply(state, "on chat/~ten/lounge")
        self.assertEqual(state.enabled_channels, {"chat/~ten/lounge"})
        self.assertEqual(
            outcome.settings_changes,
            {"ownerListenEnabledChannels": ["chat/~ten/lounge"]},
        )
        self.assertEqual(outcome.monitor_nests, ("chat/~ten/lounge",))
        self.assertIn("on (explicitly enabled)", outcome.reply)
        self.assertIn("Now monitoring this channel.", outcome.reply)

    def test_enable_monitored_channel_skips_monitor_nest(self):
        state = make_state()
        outcome = self.apply(
            state,
            "on chat/~ten/lounge",
            monitored=("chat/~pen/general", "chat/~ten/lounge"),
        )
        self.assertEqual(outcome.monitor_nests, ())
        self.assertNotIn("Now monitoring", outcome.reply)

    def test_mute_owned_channel(self):
        state = make_state()
        outcome = self.apply(state, "off")
        self.assertEqual(state.disabled_channels, {"chat/~pen/general"})
        self.assertEqual(
            outcome.settings_changes,
            {"ownerListenDisabledChannels": ["chat/~pen/general"]},
        )
        self.assertEqual(
            outcome.reply,
            "Owner-listen for chat/~pen/general: off (channel is muted).",
        )

    def test_unmute_owned_channel(self):
        state = make_state(disabled_channels={"chat/~pen/general"})
        outcome = self.apply(state, "on")
        self.assertEqual(state.disabled_channels, set())
        self.assertEqual(outcome.settings_changes, {"ownerListenDisabledChannels": []})
        self.assertEqual(
            outcome.reply,
            "Owner-listen for chat/~pen/general: on (active).",
        )

    def test_disable_non_owned_channel_clears_opt_in(self):
        state = make_state(enabled_channels={"chat/~ten/lounge"})
        outcome = self.apply(state, "off chat/~ten/lounge")
        self.assertEqual(state.enabled_channels, set())
        # Sticky mute: explicit off lands in the disabled list too, so it
        # survives a later default flip to "all".
        self.assertEqual(
            outcome.settings_changes,
            {
                "ownerListenEnabledChannels": [],
                "ownerListenDisabledChannels": ["chat/~ten/lounge"],
            },
        )

    def test_enable_with_global_off_records_override(self):
        state = make_state(enabled=False)
        outcome = self.apply(state, "on chat/~ten/lounge")
        self.assertEqual(state.enabled_channels, {"chat/~ten/lounge"})
        self.assertIn("global is off", outcome.reply)
        self.assertIn("/owner-listen all on", outcome.reply)
        self.assertEqual(
            outcome.settings_changes,
            {"ownerListenEnabledChannels": ["chat/~ten/lounge"]},
        )

    def test_no_target_outside_channel_returns_usage(self):
        outcome = self.apply(make_state(), "on", ctx_nest=None)
        self.assertIn("Run inside a channel", outcome.reply)

    def test_invalid_nest_rejected(self):
        outcome = self.apply(make_state(), "on not-a-nest")
        self.assertIn("not a valid channel nest", outcome.reply)
        self.assertEqual(outcome.settings_changes, {})

    def test_unknown_action_returns_usage(self):
        outcome = self.apply(make_state(), "sideways")
        self.assertEqual(outcome.reply, ol.OWNER_LISTEN_USAGE)


class DefaultModeTests(unittest.TestCase):
    def test_default_all_makes_every_channel_active(self):
        state = make_state(default_all=True)
        self.assertTrue(
            ol.owner_listen_active(state, "chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT)
        )
        # explicit mute still wins
        state.disabled_channels.add("chat/~ten/lounge")
        self.assertFalse(
            ol.owner_listen_active(state, "chat/~ten/lounge", owner_ship=OWNER, bot_ship=BOT)
        )

    def test_default_command_round_trip(self):
        state = make_state()
        status = ol.apply_owner_listen_command(
            state, "default", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertEqual(status.reply, "Owner-listen default: owned channels only.")

        outcome = ol.apply_owner_listen_command(
            state, "default all", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertTrue(state.default_all)
        self.assertEqual(outcome.settings_changes, {"ownerListenDefault": "all"})
        self.assertIn("all monitored channels", outcome.reply)

        outcome = ol.apply_owner_listen_command(
            state, "default owned", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertFalse(state.default_all)
        self.assertEqual(outcome.settings_changes, {"ownerListenDefault": "owned"})

        bogus = ol.apply_owner_listen_command(
            state, "default sideways", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertEqual(bogus.reply, "Usage: /owner-listen default [owned|all]")

    def test_default_does_not_collide_with_global_all_toggle(self):
        state = make_state()
        outcome = ol.apply_owner_listen_command(
            state, "all off", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertFalse(state.enabled)
        self.assertFalse(state.default_all)
        self.assertEqual(outcome.settings_changes, {"ownerListenEnabled": False})

    def test_default_from_settings_and_event(self):
        state = ol.owner_listen_state_from_settings(
            {"ownerListenDefault": "all"}, defaults=make_state()
        )
        self.assertTrue(state.default_all)
        # invalid value falls back to defaults
        state = ol.owner_listen_state_from_settings(
            {"ownerListenDefault": "sideways"}, defaults=make_state(default_all=True)
        )
        self.assertTrue(state.default_all)

        live = make_state()
        changed = ol.apply_owner_listen_settings_event(
            live, ol.SettingsEvent(key="ownerListenDefault", value="all"),
            defaults=make_state(),
        )
        self.assertTrue(changed)
        self.assertTrue(live.default_all)

    def test_status_detail_reflects_all_default(self):
        state = make_state(default_all=True)
        outcome = ol.apply_owner_listen_command(
            state, "status chat/~ten/lounge", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        )
        self.assertIn("on (active (all-channels default))", outcome.reply)

    def test_list_shows_default(self):
        reply = ol.apply_owner_listen_command(
            make_state(default_all=True), "list", ctx_nest=None, owner_ship=OWNER, bot_ship=BOT
        ).reply
        self.assertIn("Default: all monitored channels.", reply)


class GroupTargetTests(unittest.TestCase):
    def test_parse_group_flag(self):
        self.assertEqual(ol.parse_group_flag("~HOST/my-group"), "~host/my-group")
        self.assertEqual(ol.parse_group_flag("~ten/projects"), "~ten/projects")
        self.assertIsNone(ol.parse_group_flag("chat/~ten/projects"))
        self.assertIsNone(ol.parse_group_flag("~ten"))
        self.assertIsNone(ol.parse_group_flag("nope/projects"))

    def test_group_target_detection(self):
        self.assertEqual(
            ol.owner_listen_group_target("on ~ten/projects"), ("on", "~ten/projects")
        )
        self.assertEqual(
            ol.owner_listen_group_target("off ~ten/projects"), ("off", "~ten/projects")
        )
        # channel nests and other forms are not group targets
        self.assertIsNone(ol.owner_listen_group_target("on chat/~ten/projects"))
        self.assertIsNone(ol.owner_listen_group_target("on"))
        self.assertIsNone(ol.owner_listen_group_target("all on"))

    def test_group_apply_on_enables_all_channels(self):
        state = make_state()
        outcome = ol.apply_owner_listen_group_command(
            state,
            "on",
            "~ten/projects",
            ["chat/~ten/general", "heap/~ten/art", "chat/~pen/owned-by-bot"],
            owner_ship=OWNER,
            bot_ship=BOT,
            monitored_channels=frozenset({"chat/~ten/general"}),
        )
        # non-owned channels land in the enabled set; bot-hosted one doesn't need to
        self.assertEqual(
            state.enabled_channels, {"chat/~ten/general", "heap/~ten/art"}
        )
        self.assertEqual(
            sorted(outcome.monitor_nests), ["chat/~pen/owned-by-bot", "heap/~ten/art"]
        )
        self.assertIn("on for 3 channel(s) in ~ten/projects", outcome.reply)
        self.assertIn("Now monitoring 2 of them.", outcome.reply)
        self.assertEqual(
            outcome.settings_changes,
            {"ownerListenEnabledChannels": ["chat/~ten/general", "heap/~ten/art"]},
        )

    def test_group_apply_off_mutes_all_channels(self):
        state = make_state(enabled_channels={"chat/~ten/general"})
        outcome = ol.apply_owner_listen_group_command(
            state,
            "off",
            "~ten/projects",
            ["chat/~ten/general", "heap/~ten/art"],
            owner_ship=OWNER,
            bot_ship=BOT,
        )
        self.assertEqual(state.enabled_channels, set())
        self.assertEqual(
            state.disabled_channels, {"chat/~ten/general", "heap/~ten/art"}
        )
        self.assertIn("muted for 2 channel(s)", outcome.reply)
        self.assertEqual(outcome.monitor_nests, ())

    def test_group_apply_rejects_other_actions_and_empty(self):
        state = make_state()
        self.assertIn(
            "on|off only",
            ol.apply_owner_listen_group_command(
                state, "status", "~ten/projects", ["chat/~ten/general"],
                owner_ship=OWNER, bot_ship=BOT,
            ).reply,
        )
        self.assertIn(
            "No channels found",
            ol.apply_owner_listen_group_command(
                state, "on", "~ten/projects", [],
                owner_ship=OWNER, bot_ship=BOT,
            ).reply,
        )


class ConfigEnvTests(unittest.TestCase):
    def test_owner_listen_env_fields(self):
        config = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://pen.tlon.network",
                "TLON_NODE_ID": "~pen",
                "TLON_ACCESS_CODE": "code",
                "TLON_OWNER_LISTEN": "false",
                "TLON_OWNER_LISTEN_DISABLED_CHANNELS": "chat/~pen/general, chat/~pen/dev",
                "TLON_OWNER_LISTEN_ENABLED_CHANNELS": "chat/~ten/lounge",
                "TLON_CONTEXT_MESSAGES": "0",
            }
        )
        self.assertFalse(config.owner_listen)
        self.assertEqual(
            config.owner_listen_disabled_channels,
            ("chat/~pen/general", "chat/~pen/dev"),
        )
        self.assertEqual(config.owner_listen_enabled_channels, ("chat/~ten/lounge",))
        self.assertEqual(config.context_messages, 0)

    def test_owner_listen_defaults(self):
        config = tlon_api.TlonConfig.from_env(env={})
        self.assertTrue(config.owner_listen)
        self.assertEqual(config.owner_listen_disabled_channels, ())
        self.assertEqual(config.owner_listen_enabled_channels, ())
        self.assertEqual(config.context_messages, 20)


if __name__ == "__main__":
    unittest.main()
