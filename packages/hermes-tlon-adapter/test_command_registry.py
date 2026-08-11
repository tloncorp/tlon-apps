import asyncio
import importlib.util
import json
import os
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_command_registry_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


class Platform(str):
    pass


class PlatformConfig:
    def __init__(self, extra=None):
        self.extra = extra or {}


class MessageType:
    TEXT = "text"
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    VOICE = "voice"
    DOCUMENT = "document"


class MessageEvent:
    def __init__(
        self,
        *,
        text,
        message_type,
        source,
        raw_message,
        message_id,
        reply_to_message_id,
        timestamp,
        media_urls=None,
        media_types=None,
    ):
        self.text = text
        self.message_type = message_type
        self.source = source
        self.raw_message = raw_message
        self.message_id = message_id
        self.reply_to_message_id = reply_to_message_id
        self.timestamp = timestamp
        self.media_urls = media_urls or []
        self.media_types = media_types or []


class SendResult:
    def __init__(
        self,
        *,
        success,
        message_id=None,
        error=None,
        raw_response=None,
        retryable=False,
        continuation_message_ids=(),
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.raw_response = raw_response or {}
        self.retryable = retryable
        self.continuation_message_ids = tuple(continuation_message_ids)


class BasePlatformAdapter:
    def __init__(self, *, config, platform):
        self.config = config
        self.platform = platform
        self._running = True

    def _mark_connected(self):
        self._running = True

    def _mark_disconnected(self):
        self._running = False

    def build_source(self, **kwargs):
        return types.SimpleNamespace(**kwargs)

    async def handle_message(self, event):
        raise AssertionError("tests should install a recorder")


gateway = types.ModuleType("gateway")
gateway_config = types.ModuleType("gateway.config")
gateway_config.Platform = Platform
gateway_config.PlatformConfig = PlatformConfig
gateway_platforms = types.ModuleType("gateway.platforms")
gateway_base = types.ModuleType("gateway.platforms.base")
gateway_base.BasePlatformAdapter = BasePlatformAdapter
gateway_base.MessageEvent = MessageEvent
gateway_base.MessageType = MessageType
gateway_base.SendResult = SendResult
sys.modules["gateway"] = gateway
sys.modules["gateway.config"] = gateway_config
sys.modules["gateway.platforms"] = gateway_platforms
sys.modules["gateway.platforms.base"] = gateway_base


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(module_name, PACKAGE_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


commands = load_module("commands")
tlon_api = load_module("tlon_api")
owner_listen = load_module("owner_listen")
channel_access = load_module("channel_access")
approval = load_module("approval")
migration = load_module("migration")
version = load_module("version")
bot_info = load_module("bot_info")
adapter_mod = load_module("adapter")

FIXTURE_PATH = PACKAGE_DIR / "fixtures" / "commands.json"

ALL_TOKENS = [
    "/owner-listen",
    "/migrate",
    "/tlon",
    "/tlon-version",
    "/allow",
    "/reject",
    "/ban",
    "/unban",
    "/pending",
    "/banned",
    "/channel-access",
]

# Every advertised row, driven through the real dispatcher below with a
# representative input that its handler accepts.
DISPATCH_CASES = {
    "owner-listen": "/owner-listen status",
    "migrate": "/migrate",
    "tlon": "/tlon version",
    "allow": "/allow abc123",
    "reject": "/reject abc123",
    "ban": "/ban ~ten",
    "unban": "/unban ~ten",
    "pending": "/pending",
    "banned": "/banned",
    "channel-access": "/channel-access list",
}


class FakeSSE:
    def __init__(self, payloads=None):
        self.payloads = payloads or {}
        self.scries = []
        self.pokes = []
        self.fail_pokes = False
        # Transient-failure simulation for the publish retry.
        self.fail_first_pokes = 0
        self.poke_attempts = 0

    async def scry(self, path):
        self.scries.append(path)
        if path in self.payloads:
            return self.payloads[path]
        raise ConnectionError(f"no payload for {path}")

    async def poke(self, app, mark, json_payload):
        self.poke_attempts += 1
        if self.fail_pokes or self.poke_attempts <= self.fail_first_pokes:
            raise ConnectionError("poke rejected")
        self.pokes.append((app, mark, json_payload))
        return 1

    def pokes_for(self, mark):
        return [poke for poke in self.pokes if poke[1] == mark]


class FakeCLI:
    def __init__(self):
        self.commands = []
        self.messages = []
        self.replies = []

    async def run_command(self, args):
        self.commands.append(tuple(args))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", *args), stdout="ok\n"
        )

    async def send_message(self, chat_id, text, *, blob=None, sent_at=None):
        self.messages.append((chat_id, text))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", "posts", "send"), message_id="post-id"
        )

    async def send_reply(
        self, chat_id, post_id, text, *, parent_author=None, blob=None, sent_at=None
    ):
        self.replies.append((chat_id, post_id, text, parent_author))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", "posts", "reply"), message_id="reply-id"
        )


class CommandRegistryTests(unittest.TestCase):
    def test_registry_covers_all_eleven_control_commands(self):
        self.assertEqual([row.token for row in commands.COMMAND_REGISTRY], ALL_TOKENS)
        self.assertEqual(len(commands.COMMAND_REGISTRY), 11)

    def test_only_tlon_version_is_not_advertised_with_reason(self):
        hidden = [row for row in commands.COMMAND_REGISTRY if not row.advertise]
        self.assertEqual([row.token for row in hidden], ["/tlon-version"])
        self.assertEqual(
            hidden[0].do_not_advertise_reason, "legacy alias of /tlon version"
        )
        advertised = commands.advertised_command_rows()
        self.assertEqual(len(advertised), 10)
        self.assertNotIn("/tlon-version", [row.token for row in advertised])

    def test_detection_shapes_reproduce_todays_behavior(self):
        match = lambda name, text: bool(  # noqa: E731
            commands.command_detection_regex(name).match(str(text).strip())
        )
        # prefix shape: token plus anything (or nothing) after it
        self.assertTrue(match("owner-listen", "/owner-listen"))
        self.assertTrue(match("owner-listen", "  /Owner-Listen status"))
        self.assertFalse(match("owner-listen", "/owner-listening on"))
        self.assertTrue(match("tlon-version", "/tlon-version please"))
        self.assertFalse(match("tlon-version", "/tlon-versions"))
        self.assertTrue(match("tlon", "/tlon version"))
        # /tlon must not swallow the legacy alias
        self.assertFalse(match("tlon", "/tlon-version"))
        self.assertTrue(match("migrate", "/migrate diary/~pen/journal"))
        self.assertTrue(match("channel-access", "/Channel-Access"))
        self.assertFalse(match("channel-access", "/channel-accessory"))
        # anchored-optional-arg shape: token plus at most one argument
        self.assertTrue(match("allow", "/allow d1b2c"))
        self.assertTrue(match("allow", "/allow"))
        self.assertFalse(match("allow", "/allow a b"))
        self.assertTrue(match("unban", "/unban ~ten"))
        # strict-no-arg shape: anything else falls through to the model
        self.assertTrue(match("pending", "/pending"))
        self.assertFalse(match("pending", "/pending 2"))
        self.assertTrue(match("banned", "/banned"))
        self.assertFalse(match("banned", "/banned now"))

    def test_modules_use_the_registry_regex_objects(self):
        self.assertIs(
            owner_listen._COMMAND_RE, commands.command_detection_regex("owner-listen")
        )
        self.assertIs(
            channel_access._COMMAND_RE,
            commands.command_detection_regex("channel-access"),
        )
        self.assertIs(
            migration._MIGRATE_COMMAND_RE, commands.command_detection_regex("migrate")
        )
        self.assertIs(
            version._COMMAND_RE, commands.command_detection_regex("tlon-version")
        )
        self.assertIs(approval._ALLOW_RE, commands.command_detection_regex("allow"))
        self.assertIs(approval._REJECT_RE, commands.command_detection_regex("reject"))
        self.assertIs(approval._BAN_RE, commands.command_detection_regex("ban"))
        self.assertIs(approval._UNBAN_RE, commands.command_detection_regex("unban"))
        self.assertIs(approval._PENDING_RE, commands.command_detection_regex("pending"))
        self.assertIs(approval._BANNED_RE, commands.command_detection_regex("banned"))
        self.assertIs(adapter_mod._TLON_COMMAND_RE, commands.command_detection_regex("tlon"))

    def test_usage_strings_moved_verbatim(self):
        self.assertEqual(
            owner_listen.OWNER_LISTEN_USAGE,
            "Usage: /owner-listen [on|off|status|list] [<channel-nest>|<~host/group>] | "
            "/owner-listen all [on|off] | /owner-listen default [owned|all]",
        )
        self.assertEqual(
            channel_access.CHANNEL_ACCESS_USAGE,
            "Usage: /channel-access [open|restricted|status|list] [<channel-nest>]",
        )
        self.assertEqual(
            migration.MIGRATE_USAGE,
            "Usage: /migrate <diary-nest> [--allow-write-widening] | "
            "/migrate cleanup <notes-nest>",
        )
        rows = {row.name: row for row in commands.COMMAND_REGISTRY}
        self.assertEqual(rows["owner-listen"].usage, owner_listen.OWNER_LISTEN_USAGE)
        self.assertEqual(rows["channel-access"].usage, channel_access.CHANNEL_ACCESS_USAGE)
        self.assertEqual(rows["migrate"].usage, migration.MIGRATE_USAGE)

    def test_telemetry_tokens_match_the_dispatcher_literals(self):
        rows = {row.name: row for row in commands.COMMAND_REGISTRY}
        expected = {
            "owner-listen": "owner-listen",
            "migrate": "migrate",
            "tlon": None,  # per-subcommand tokens come from the handler
            "tlon-version": "tlon-version",
            "allow": "allow",
            "reject": "reject",
            "ban": "ban",
            "unban": "unban",
            "pending": "pending",
            "banned": "banned",
            "channel-access": "channel-access",
        }
        for name, token in expected.items():
            self.assertEqual(rows[name].telemetry_token, token, name)

    # The fixture is what the client's drift contract reads
    # (packages/shared/src/domain/runtimeCommandContract.test.ts). Regenerating
    # it is the deliberate step that says "the client's static list must change
    # too".
    def test_build_tokens_matches_fixture(self):
        fixture = FIXTURE_PATH.read_text(encoding="utf-8")
        self.assertEqual(commands.build_command_tokens_json(), fixture)
        # Byte-stable across calls.
        self.assertEqual(
            commands.build_command_tokens_json(),
            commands.build_command_tokens_json(),
        )

    def test_fixture_names_every_advertised_row_and_nothing_else(self):
        tokens = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            tokens, [row.token for row in commands.advertised_command_rows()]
        )
        self.assertEqual(commands.command_tokens(), tokens)
        # The hidden alias is handled but never named to the client.
        self.assertNotIn("/tlon-version", tokens)


class DispatcherParityTests(unittest.TestCase):
    """Every advertised row, driven through _maybe_handle_control_command:
    handled (consumed), not merely regex-matched. Pins registry↔dispatcher
    wiring."""

    def make_adapter(self):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "owner_ship": "~mug",
            "reaction_level": "off",
        }
        with patch.dict(os.environ, {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()
        adapter._settings_loaded = True
        adapter._pending_nudge_rehydrated = True

        def _skip_nudge_persistence(*_args, **_kwargs):
            return None

        adapter._nudge_activity_persistence.enqueue = _skip_nudge_persistence
        adapter._nudge_activity_persistence.enqueue_stage_clear = _skip_nudge_persistence
        adapter._pending_nudge_persistence.enqueue = _skip_nudge_persistence
        return adapter

    def owner_message(self, text):
        return tlon_api.TlonIncomingMessage(
            chat_id="~mug",
            chat_name="~mug",
            chat_type="dm",
            user_id="~mug",
            user_name="~mug",
            text=text,
            message_id=f"msg-{text}",
            reply_to_message_id=None,
            sent_at=datetime.now(tz=timezone.utc),
            raw={},
        )

    def dispatch(self, adapter, text):
        return asyncio.run(
            adapter._maybe_handle_control_command(
                self.owner_message(text), text, ctx_nest=None
            )
        )

    def test_dispatch_cases_cover_exactly_the_advertised_rows(self):
        # Closes the parity loop: without this, an advertised-but-undispatched
        # row is invisible because the test below only iterates DISPATCH_CASES.
        self.assertEqual(
            set(DISPATCH_CASES),
            {row.name for row in commands.advertised_command_rows()},
        )

    def test_every_advertised_row_is_handled(self):
        for name, sample in DISPATCH_CASES.items():
            with self.subTest(command=name):
                adapter = self.make_adapter()
                self.assertTrue(self.dispatch(adapter, sample), name)

    def test_hidden_tlon_version_is_still_handled(self):
        adapter = self.make_adapter()
        self.assertTrue(self.dispatch(adapter, "/tlon-version"))

    def test_non_owner_is_not_handled(self):
        adapter = self.make_adapter()
        message = tlon_api.TlonIncomingMessage(
            chat_id="~ten",
            chat_name="~ten",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="/pending",
            message_id="msg-1",
            reply_to_message_id=None,
            sent_at=datetime.now(tz=timezone.utc),
            raw={},
        )
        self.assertFalse(
            asyncio.run(
                adapter._maybe_handle_control_command(
                    message, "/pending", ctx_nest=None
                )
            )
        )

    def test_shape_behavior_is_preserved_through_the_dispatcher(self):
        # /pending 2 keeps falling through to the model...
        adapter = self.make_adapter()
        self.assertFalse(self.dispatch(adapter, "/pending 2"))
        # ...while /tlon-version please keeps matching.
        adapter = self.make_adapter()
        self.assertTrue(self.dispatch(adapter, "/tlon-version please"))


# Deliberately values nothing in the tree can produce, so a hardcoded literal
# in adapter.py cannot masquerade as correct sourcing. Using the *real* current
# versions here would make `build_bot_info_json("0.15.0", "0.17.0 (2026.6.19)")`
# at the call site indistinguishable from reading them. The real resolver has
# its own tests in BotInfoClaimTests.
FAKE_HARNESS_VERSION = "harness-sentinel-9.9.9 (2099-01-01)"
FAKE_PLUGIN_VERSION = "plugin-sentinel-8.8.8"


def expected_claim(_adapter):
    # Sourced the way the adapter must source it: its own package version plus
    # the host's. Hardcoding either in adapter.py would fail this.
    return bot_info.build_bot_info_json(
        FAKE_PLUGIN_VERSION, FAKE_HARNESS_VERSION
    )


class PublishTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(
            adapter_mod, "plugin_version", return_value=FAKE_PLUGIN_VERSION
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def make_adapter(self):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "owner_ship": "~mug",
            "reaction_level": "off",
        }
        with patch.dict(os.environ, {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
        adapter._sse = FakeSSE()
        adapter._harness_version_cache = FAKE_HARNESS_VERSION
        return adapter

    def test_publish_on_diff(self):
        adapter = self.make_adapter()
        asyncio.run(adapter._publish_bot_info({"nickname": {"type": "text", "value": "Bot"}}))
        pokes = adapter._sse.pokes_for("contact-action-1")
        self.assertEqual(len(pokes), 1)
        app, mark, payload = pokes[0]
        self.assertEqual(app, "contacts")
        self.assertEqual(
            payload,
            {
                "self": {
                    "bot-info": {
                        "type": "text",
                        "value": expected_claim(adapter),
                    }
                }
            },
        )

    def test_skip_on_match(self):
        adapter = self.make_adapter()
        self_contact = {
            "bot-info": {"type": "text", "value": expected_claim(adapter)}
        }
        asyncio.run(adapter._publish_bot_info(self_contact))
        self.assertEqual(adapter._sse.pokes_for("contact-action-1"), [])

    def test_republish_over_wrong_shape(self):
        adapter = self.make_adapter()
        self_contact = {"bot-info": {"type": "numb", "value": "0x1"}}
        asyncio.run(adapter._publish_bot_info(self_contact))
        self.assertEqual(len(adapter._sse.pokes_for("contact-action-1")), 1)

    def test_publish_failure_is_non_fatal(self):
        adapter = self.make_adapter()
        adapter._sse.fail_pokes = True
        with patch("asyncio.sleep", new_callable=AsyncMock) as sleeps:
            # The terminal failure must surface as the caller-visible warning:
            # swallowing it (or returning instead of raising internally) would
            # hide a permanently unadvertised bot.
            with self.assertLogs(adapter_mod.logger, level="WARNING") as logged:
                asyncio.run(adapter._publish_bot_info({}))
        # Every attempt was spent before giving up, and nothing was published.
        self.assertEqual(
            adapter._sse.poke_attempts, adapter_mod.BOT_INFO_PUBLISH_ATTEMPTS
        )
        self.assertEqual(adapter._sse.pokes_for("contact-action-1"), [])
        self.assertTrue(
            any("could not publish" in line for line in logged.output),
            logged.output,
        )
        # Sleeps were *awaited* (await_args_list catches a dropped await, which
        # call_args_list would not), only between attempts — never after the
        # final failure.
        self.assertEqual(
            [c.args[0] for c in sleeps.await_args_list],
            list(adapter_mod.BOT_INFO_PUBLISH_BACKOFF_SECONDS),
        )

    def test_publish_retries_a_transient_poke_failure(self):
        adapter = self.make_adapter()
        adapter._sse.fail_first_pokes = 2
        with patch("asyncio.sleep", new_callable=AsyncMock) as sleeps:
            asyncio.run(adapter._publish_bot_info({}))
        # Published on the third attempt, with backoff only between attempts.
        self.assertEqual(len(adapter._sse.pokes_for("contact-action-1")), 1)
        self.assertEqual(
            adapter._sse.poke_attempts, adapter_mod.BOT_INFO_PUBLISH_ATTEMPTS
        )
        self.assertEqual(
            [c.args[0] for c in sleeps.await_args_list],
            list(adapter_mod.BOT_INFO_PUBLISH_BACKOFF_SECONDS),
        )

    def test_publish_does_not_retry_when_the_read_failed(self):
        adapter = self.make_adapter()
        adapter._sse.fail_pokes = True
        with patch("asyncio.sleep", new_callable=AsyncMock) as sleeps:
            asyncio.run(adapter._publish_bot_info(None))
        self.assertEqual(adapter._sse.poke_attempts, 0)
        self.assertEqual(sleeps.call_count, 0)

    def test_publish_does_not_retry_an_unchanged_value(self):
        adapter = self.make_adapter()
        self_contact = {
            "bot-info": {"type": "text", "value": expected_claim(adapter)}
        }
        with patch("asyncio.sleep", new_callable=AsyncMock) as sleeps:
            asyncio.run(adapter._publish_bot_info(self_contact))
        self.assertEqual(adapter._sse.poke_attempts, 0)
        self.assertEqual(sleeps.call_count, 0)

    def test_publish_skipped_when_self_contact_unread(self):
        # A failed read is not evidence the key is absent, so poking blind
        # would defeat compare-then-poke exactly when the ship is unhealthy.
        adapter = self.make_adapter()
        asyncio.run(adapter._publish_bot_info(None))
        self.assertEqual(adapter._sse.pokes_for("contact-action-1"), [])

    def test_publish_on_successful_empty_self_contact(self):
        # A successful read of a contact map without the key *is* evidence.
        adapter = self.make_adapter()
        asyncio.run(adapter._publish_bot_info({}))
        self.assertEqual(len(adapter._sse.pokes_for("contact-action-1")), 1)

    def test_rejected_scry_publishes_nothing_end_to_end(self):
        adapter = self.make_adapter()

        async def failing_scry(_path):
            raise RuntimeError("ship unreachable")

        adapter._sse.scry = failing_scry
        self_contact = asyncio.run(adapter._load_bot_profile())
        asyncio.run(adapter._publish_bot_info(self_contact))
        self.assertEqual(adapter._sse.pokes_for("contact-action-1"), [])

    def test_successful_empty_scry_publishes_once_end_to_end(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/contacts/v1/self.json"] = {}
        self_contact = asyncio.run(adapter._load_bot_profile())
        asyncio.run(adapter._publish_bot_info(self_contact))
        self.assertEqual(len(adapter._sse.pokes_for("contact-action-1")), 1)

    def test_clear_pokes_null(self):
        adapter = self.make_adapter()
        asyncio.run(adapter._clear_bot_info())
        pokes = adapter._sse.pokes_for("contact-action-1")
        self.assertEqual(len(pokes), 1)
        self.assertEqual(pokes[0][2], {"self": {"bot-info": None}})

    def test_load_bot_profile_returns_raw_self_contact(self):
        adapter = self.make_adapter()
        profile = {"nickname": {"type": "text", "value": "Bot"}}
        adapter._sse.payloads["/contacts/v1/self.json"] = profile
        self.assertEqual(asyncio.run(adapter._load_bot_profile()), profile)
        self.assertEqual(adapter._bot_nickname, "Bot")

    def test_load_bot_profile_none_on_failure(self):
        adapter = self.make_adapter()
        self.assertIsNone(asyncio.run(adapter._load_bot_profile()))


class BotInfoClaimTests(unittest.TestCase):
    def test_claim_shape(self):
        self.assertEqual(
            json.loads(bot_info.build_bot_info_json("0.4.2", "0.17.0 (2026.6.19)")),
            {
                "v": 1,
                "harness": "hermes",
                "version": "0.4.2",
                "harnessVersion": "0.17.0 (2026.6.19)",
            },
        )

    def test_claim_is_byte_stable(self):
        self.assertEqual(
            bot_info.build_bot_info_json("0.4.2", "x"),
            bot_info.build_bot_info_json("0.4.2", "x"),
        )

    def test_missing_harness_version_is_omitted_not_fatal(self):
        for absent in (None, "", "   "):
            with self.subTest(harness_version=absent):
                self.assertEqual(
                    json.loads(bot_info.build_bot_info_json("0.4.2", absent)),
                    {"v": 1, "harness": "hermes", "version": "0.4.2"},
                )

    def test_cap_counts_utf8_bytes_not_characters(self):
        """The self-cap is on UTF-8 bytes, not characters — the ship's jam
        budget counts bytes, and non-ASCII is 2-4x its character length."""
        wide = "☃" * 40
        rendered = bot_info.build_bot_info_json(wide)
        self.assertGreater(len(rendered.encode("utf-8")), len(rendered))

        ceiling = (len(rendered) + len(rendered.encode("utf-8"))) // 2
        with patch.object(bot_info, "BOT_INFO_MAX_BYTES", ceiling):
            with self.assertRaises(ValueError):
                bot_info.build_bot_info_json(wide)

    def test_extract_bot_info_value_shape_checks(self):
        claim = bot_info.build_bot_info_json("0.4.2")
        self.assertEqual(
            bot_info.extract_bot_info_value(
                {"bot-info": {"type": "text", "value": claim}}
            ),
            claim,
        )
        self.assertIsNone(bot_info.extract_bot_info_value({}))
        self.assertIsNone(
            bot_info.extract_bot_info_value({"bot-info": {"type": "set", "value": []}})
        )
        self.assertIsNone(
            bot_info.extract_bot_info_value({"bot-info": {"type": "text", "value": 42}})
        )
        self.assertIsNone(bot_info.extract_bot_info_value({"bot-info": claim}))
        self.assertIsNone(bot_info.extract_bot_info_value(None))

    def test_build_bot_info_poke(self):
        self.assertEqual(
            bot_info.build_bot_info_poke("value"),
            {"self": {"bot-info": {"type": "text", "value": "value"}}},
        )
        self.assertEqual(
            bot_info.build_bot_info_poke(None),
            {"self": {"bot-info": None}},
        )

    def test_harness_version_prefers_the_hosts_own_constants(self):
        module = types.ModuleType("hermes_cli")
        module.__version__ = "0.17.0"
        module.__release_date__ = "2026.6.19"
        with patch.dict(sys.modules, {"hermes_cli": module}):
            self.assertEqual(
                bot_info.resolve_harness_version(), "0.17.0 (2026.6.19)"
            )

    def test_harness_version_falls_back_to_distribution_metadata(self):
        with patch.dict(sys.modules, {"hermes_cli": None}):
            with patch("importlib.metadata.version", return_value="0.17.0"):
                self.assertEqual(bot_info.resolve_harness_version(), "0.17.0")

    def test_half_the_host_constants_is_a_loud_fallback_not_a_value(self):
        # A present __version__ with an empty __release_date__ means the host
        # convention moved. Publishing the bare SemVer would look like success
        # while silently dropping the release identifier — and it is exactly
        # what the distribution fallback yields anyway, so the preferred source
        # must warn and fall through rather than return a degraded value.
        for version_value, release_date in (
            ("0.17.0", ""),
            ("", "2026.6.19"),
        ):
            with self.subTest(version=version_value, release=release_date):
                module = types.ModuleType("hermes_cli")
                module.__version__ = version_value
                module.__release_date__ = release_date
                with patch.dict(sys.modules, {"hermes_cli": module}):
                    with patch(
                        "importlib.metadata.version", return_value="9.9.9-dist"
                    ):
                        with self.assertLogs(
                            bot_info.logger, level="WARNING"
                        ) as logged:
                            self.assertEqual(
                                bot_info.resolve_harness_version(), "9.9.9-dist"
                            )
                self.assertTrue(
                    any("incomplete" in line for line in logged.output),
                    logged.output,
                )

    def test_harness_version_is_none_and_loud_when_nothing_is_available(self):
        def no_metadata(_name):
            raise LookupError("not installed")

        with patch.dict(sys.modules, {"hermes_cli": None}):
            with patch("importlib.metadata.version", no_metadata):
                with self.assertLogs(bot_info.logger, level="WARNING") as logged:
                    self.assertIsNone(bot_info.resolve_harness_version())
        self.assertTrue(
            any("no Hermes version available" in line for line in logged.output),
            logged.output,
        )


class StandaloneVersionImportTests(unittest.TestCase):
    """version.py must stay importable as a top-level module (its documented
    fingerprint recipe), while a packaged import uses the registry object."""

    def test_top_level_import_uses_the_fallback_pattern(self):
        saved = {
            name: sys.modules.pop(name)
            for name in ("version", "commands")
            if name in sys.modules
        }
        sys.path.insert(0, str(PACKAGE_DIR))
        try:
            import version as standalone_version

            self.assertIsNone(standalone_version.__package__ or None)
            self.assertTrue(standalone_version.is_tlon_version_command("/tlon-version"))
            self.assertTrue(
                standalone_version.is_tlon_version_command("/tlon-version please")
            )
            self.assertFalse(standalone_version.is_tlon_version_command("/tlon-versions"))
            self.assertTrue(standalone_version.content_fingerprint().startswith("fp1:"))
        finally:
            sys.path.remove(str(PACKAGE_DIR))
            sys.modules.pop("version", None)
            sys.modules.update(saved)

    def test_packaged_import_shares_the_registry_regex_object(self):
        self.assertIs(
            version._COMMAND_RE, commands.command_detection_regex("tlon-version")
        )


if __name__ == "__main__":
    unittest.main()
