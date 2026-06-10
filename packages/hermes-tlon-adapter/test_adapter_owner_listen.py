import asyncio
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_owner_listen_adapter_testpkg"

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
    ):
        self.text = text
        self.message_type = message_type
        self.source = source
        self.raw_message = raw_message
        self.message_id = message_id
        self.reply_to_message_id = reply_to_message_id
        self.timestamp = timestamp


class SendResult:
    def __init__(
        self,
        *,
        success,
        message_id=None,
        error=None,
        raw_response=None,
        retryable=False,
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.raw_response = raw_response or {}
        self.retryable = retryable


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


tlon_api = load_module("tlon_api")
load_module("attention")
load_module("mention")
load_module("owner_listen")
load_module("history")
load_module("version")
load_module("presence")
load_module("tlon_tool")
adapter_mod = load_module("adapter")


def channel_event(
    text,
    *,
    author="~mug",
    nest="chat/~pen/general",
    post_id="170.141",
    parent_id=None,
):
    set_payload = {
        "essay": {
            "author": author,
            "sent": 1000,
            "content": [{"inline": [text]}],
        }
    }
    if parent_id:
        set_payload["seal"] = {"parent-id": parent_id}
    return {
        "nest": nest,
        "response": {
            "post": {
                "id": post_id,
                "r-post": {
                    "set": set_payload,
                },
            }
        },
    }


def dm_event(text, *, author="~mug", whom="~mug", msg_id="dm-1"):
    return {
        "whom": whom,
        "id": msg_id,
        "response": {
            "add": {
                "essay": {
                    "author": author,
                    "sent": 1000,
                    "content": [{"inline": [text]}],
                }
            }
        },
    }


def essay(author, text, sent):
    return {"author": author, "sent": sent, "content": [{"inline": [text]}]}


class FakeSSE:
    def __init__(self, payloads=None, error=None, poke_error=None):
        self.payloads = payloads or {}
        self.error = error
        self.poke_error = poke_error
        self.scries = []
        self.pokes = []

    async def scry(self, path):
        self.scries.append(path)
        if self.error:
            raise self.error
        if path in self.payloads:
            return self.payloads[path]
        raise ConnectionError(f"no payload for {path}")

    async def poke(self, app, mark, json_payload):
        if self.poke_error:
            raise self.poke_error
        self.pokes.append((app, mark, json_payload))
        return 1


class FakeCLI:
    def __init__(self, version_stdout="0.3.2\n", version_error=None):
        self.messages = []
        self.replies = []
        self.commands = []
        self.version_stdout = version_stdout
        self.version_error = version_error

    async def run_command(self, args):
        self.commands.append(tuple(args))
        if self.version_error:
            return tlon_api.TlonSendResult(
                success=False,
                command=("tlon-test", *args),
                error=self.version_error,
                returncode=1,
            )
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", *args),
            stdout=self.version_stdout,
        )

    async def send_message(self, chat_id, text):
        self.messages.append((chat_id, text))
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "send"),
            message_id="post-id",
        )

    async def send_reply(self, chat_id, post_id, text, *, parent_author=None):
        self.replies.append((chat_id, post_id, text, parent_author))
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "reply"),
            message_id="reply-id",
        )


class AdapterOwnerListenTests(unittest.TestCase):
    def make_adapter(self, extra):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "owner_ship": "~mug",
        }
        base.update(extra)
        with patch.dict(os.environ, {}, clear=True):
            return adapter_mod.TlonAdapter(PlatformConfig(extra=base))

    def dispatches(self, adapter, raw, *, dm=False):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        handler = adapter._handle_dm_event if dm else adapter._handle_channel_event
        asyncio.run(handler(raw))
        return events

    # ── owner-listen attention ───────────────────────────────────────────

    def test_owner_heard_without_mention_in_bot_hosted_channel(self):
        adapter = self.make_adapter({})
        events = self.dispatches(adapter, channel_event("how are the dishes going"))
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "how are the dishes going")

    def test_authorized_non_owner_still_needs_mention(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        events = self.dispatches(adapter, channel_event("hello", author="~ten"))
        self.assertEqual(events, [])

    def test_env_disabled_channel_mutes_owner_listen(self):
        adapter = self.make_adapter(
            {"owner_listen_disabled_channels": "chat/~pen/general"}
        )
        events = self.dispatches(adapter, channel_event("hello"))
        self.assertEqual(events, [])

    def test_non_owned_channel_requires_opt_in(self):
        nest = "chat/~ten/lounge"
        silent = self.make_adapter({"channels": ["chat/~pen/general", nest]})
        opted_in = self.make_adapter(
            {
                "channels": ["chat/~pen/general", nest],
                "owner_listen_enabled_channels": nest,
            }
        )
        self.assertEqual(self.dispatches(silent, channel_event("hello", nest=nest)), [])
        self.assertEqual(
            len(self.dispatches(opted_in, channel_event("hello", nest=nest))), 1
        )

    def test_env_global_off_disables_owner_listen(self):
        adapter = self.make_adapter({"owner_listen": "false"})
        events = self.dispatches(adapter, channel_event("hello"))
        self.assertEqual(events, [])

    # ── control-plane command ────────────────────────────────────────────

    def test_command_toggles_persist_and_skip_model(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        muted = self.dispatches(adapter, channel_event("/owner-listen off", post_id="1"))
        dropped = self.dispatches(adapter, channel_event("hello?", post_id="2"))
        unmuted = self.dispatches(adapter, channel_event("/owner-listen on", post_id="3"))
        heard = self.dispatches(adapter, channel_event("hello again", post_id="4"))

        self.assertEqual(muted, [])
        self.assertEqual(dropped, [])
        self.assertEqual(unmuted, [])
        self.assertEqual(len(heard), 1)

        self.assertEqual(
            adapter._cli.messages[0],
            (
                "chat/~pen/general",
                "Owner-listen for chat/~pen/general: off (channel is muted).",
            ),
        )
        self.assertEqual(
            adapter._cli.messages[1],
            (
                "chat/~pen/general",
                "Owner-listen for chat/~pen/general: on (active).",
            ),
        )
        self.assertEqual(
            adapter._sse.pokes,
            [
                (
                    "settings",
                    "settings-event",
                    {
                        "put-entry": {
                            "desk": "moltbot",
                            "bucket-key": "tlon",
                            "entry-key": "ownerListenDisabledChannels",
                            "value": ["chat/~pen/general"],
                        }
                    },
                ),
                (
                    "settings",
                    "settings-event",
                    {
                        "put-entry": {
                            "desk": "moltbot",
                            "bucket-key": "tlon",
                            "entry-key": "ownerListenDisabledChannels",
                            "value": [],
                        }
                    },
                ),
            ],
        )

    def test_mention_prefixed_command_is_intercepted(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("~pen /owner-listen status"))

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.messages), 1)
        self.assertIn("Owner-listen for chat/~pen/general: on (active).", adapter._cli.messages[0][1])

    def test_command_replies_in_thread_when_sent_from_thread(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter,
            channel_event("/owner-listen status", parent_id="170141", post_id="170.142"),
        )

        self.assertEqual(events, [])
        self.assertEqual(adapter._cli.messages, [])
        self.assertEqual(len(adapter._cli.replies), 1)
        self.assertEqual(adapter._cli.replies[0][0], "chat/~pen/general")
        self.assertEqual(adapter._cli.replies[0][1], "170141")

    def test_command_from_non_owner_is_not_intercepted(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter, channel_event("/owner-listen off", author="~ten")
        )

        self.assertEqual(events, [])
        self.assertEqual(adapter._cli.messages, [])
        self.assertEqual(adapter._sse.pokes, [])

    def test_dm_command_enables_and_monitors_new_channel(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter,
            dm_event("/owner-listen on chat/~ten/lounge"),
            dm=True,
        )

        self.assertEqual(events, [])
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertEqual(len(adapter._cli.messages), 1)
        self.assertEqual(adapter._cli.messages[0][0], "~mug")
        self.assertIn("on (explicitly enabled)", adapter._cli.messages[0][1])
        self.assertIn("Now monitoring this channel.", adapter._cli.messages[0][1])

        poked_keys = [poke[2]["put-entry"]["entry-key"] for poke in adapter._sse.pokes]
        self.assertEqual(poked_keys, ["ownerListenEnabledChannels", "groupChannels"])
        self.assertEqual(
            adapter._sse.pokes[1][2]["put-entry"]["value"],
            ["chat/~ten/lounge"],
        )

    def test_dm_command_without_nest_returns_usage(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, dm_event("/owner-listen on"), dm=True)

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.messages), 1)
        self.assertIn("Run inside a channel", adapter._cli.messages[0][1])

    def test_dm_command_from_non_owner_dispatches_normally(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter,
            dm_event("/owner-listen off", author="~ten", whom="~ten"),
            dm=True,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._cli.messages, [])

    # ── settings store load ──────────────────────────────────────────────

    def test_settings_load_overrides_env_and_merges_group_channels(self):
        adapter = self.make_adapter(
            {"owner_listen_enabled_channels": "chat/~old/env"}
        )
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "ownerListenEnabled": True,
                                "ownerListenDisabledChannels": ["chat/~pen/general"],
                                "ownerListenEnabledChannels": ["chat/~ten/lounge"],
                                "groupChannels": ["chat/~ten/lounge"],
                            }
                        }
                    }
                }
            }
        )

        asyncio.run(adapter._load_settings_state())

        self.assertTrue(adapter._owner_listen.enabled)
        self.assertEqual(adapter._owner_listen.disabled_channels, {"chat/~pen/general"})
        self.assertEqual(adapter._owner_listen.enabled_channels, {"chat/~ten/lounge"})
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)

        events = self.dispatches(
            adapter, channel_event("hello", nest="chat/~ten/lounge")
        )
        self.assertEqual(len(events), 1)

    def test_command_loads_store_before_first_list_write(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "ownerListenDisabledChannels": ["chat/~pen/dev"],
                            }
                        }
                    }
                }
            }
        )

        self.dispatches(adapter, channel_event("/owner-listen off", post_id="1"))

        self.assertTrue(adapter._settings_loaded)
        disabled_writes = [
            poke[2]["put-entry"]["value"]
            for poke in adapter._sse.pokes
            if poke[2]["put-entry"]["entry-key"] == "ownerListenDisabledChannels"
        ]
        self.assertEqual(disabled_writes, [["chat/~pen/dev", "chat/~pen/general"]])

    def test_settings_load_failure_keeps_env_defaults(self):
        adapter = self.make_adapter(
            {"owner_listen_disabled_channels": "chat/~pen/general"}
        )
        adapter._sse = FakeSSE(error=RuntimeError("settings offline"))

        asyncio.run(adapter._load_settings_state())

        self.assertTrue(adapter._owner_listen.enabled)
        self.assertEqual(adapter._owner_listen.disabled_channels, {"chat/~pen/general"})
        self.assertEqual(adapter._owner_listen.enabled_channels, set())

    def test_failed_persistence_warns_owner_but_applies_in_memory(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE(poke_error=RuntimeError("settings agent down"))

        intercepted = self.dispatches(adapter, channel_event("/owner-listen off", post_id="1"))
        muted = self.dispatches(adapter, channel_event("hello?", post_id="2"))

        self.assertEqual(intercepted, [])
        self.assertEqual(muted, [])
        reply = adapter._cli.messages[0][1]
        self.assertIn("off (channel is muted).", reply)
        self.assertIn("Warning: could not save ownerListenDisabledChannels to %settings", reply)
        self.assertIn("revert when the gateway restarts", reply)

    def test_failed_persistence_warning_lists_all_failed_keys(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE(poke_error=RuntimeError("settings agent down"))

        self.dispatches(adapter, dm_event("/owner-listen on chat/~ten/lounge"), dm=True)

        reply = adapter._cli.messages[0][1]
        self.assertIn("Now monitoring this channel.", reply)
        self.assertIn(
            "Warning: could not save ownerListenEnabledChannels, groupChannels to %settings",
            reply,
        )
        # The channel still works for this process lifetime.
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)

    def test_successful_persistence_has_no_warning(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE()

        self.dispatches(adapter, channel_event("/owner-listen off", post_id="1"))

        self.assertNotIn("Warning", adapter._cli.messages[0][1])

    # ── /tlon-version ────────────────────────────────────────────────────

    def test_version_command_replies_with_field_lines(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon-version"))

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.messages), 1)
        self.assertEqual(adapter._cli.messages[0][0], "chat/~pen/general")
        lines = adapter._cli.messages[0][1].splitlines()
        self.assertEqual(len(lines), 4)
        self.assertEqual(lines[0], "Adapter: 0.1.0")
        self.assertTrue(lines[1].startswith("Source: "))
        self.assertRegex(lines[2], r"^Fingerprint: fp1:[0-9a-f]{12}$")
        self.assertEqual(lines[3], "Tlon CLI: 0.3.2")
        self.assertIn(("--version",), adapter._cli.commands)

    def test_version_command_works_from_dm_and_with_mention(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        dm_events = self.dispatches(adapter, dm_event("/tlon-version"), dm=True)
        mention_events = self.dispatches(
            adapter, channel_event("~pen /tlon-version", post_id="2")
        )

        self.assertEqual(dm_events, [])
        self.assertEqual(mention_events, [])
        self.assertEqual(len(adapter._cli.messages), 2)
        self.assertEqual(adapter._cli.messages[0][0], "~mug")

    def test_version_command_from_non_owner_is_not_intercepted(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon-version", author="~ten"))

        self.assertEqual(events, [])
        self.assertEqual(adapter._cli.messages, [])
        self.assertEqual(adapter._cli.commands, [])

    def test_version_command_reports_cli_failure(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI(version_error="tlon CLI not found: tlon")

        self.dispatches(adapter, channel_event("/tlon-version"))

        self.assertIn(
            "Tlon CLI: unavailable (tlon CLI not found: tlon)",
            adapter._cli.messages[0][1],
        )

    # ── /tlon-telemetry ──────────────────────────────────────────────────

    def test_telemetry_command_replies_with_status(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon-telemetry"))

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.messages), 1)
        reply = adapter._cli.messages[0][1]
        self.assertIn("Telemetry: disabled — TLON_TELEMETRY is not enabled", reply)
        self.assertIn("Distinct id: ~mug", reply)
        self.assertIn("Bot ship: ~pen", reply)

    def test_telemetry_test_subcommand_reports_disabled(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        self.dispatches(adapter, dm_event("/tlon-telemetry test"), dm=True)

        self.assertIn(
            "Cannot test: telemetry is disabled", adapter._cli.messages[0][1]
        )

    def test_telemetry_command_from_non_owner_is_not_intercepted(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter, channel_event("/tlon-telemetry", author="~ten")
        )

        self.assertEqual(events, [])
        self.assertEqual(adapter._cli.messages, [])

    # ── live settings subscription ───────────────────────────────────────

    def put_entry_event(self, key, value):
        return {
            "settings-event": {
                "put-entry": {
                    "desk": "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": key,
                    "value": value,
                }
            }
        }

    def test_settings_event_hot_reloads_owner_listen(self):
        adapter = self.make_adapter({})

        heard = self.dispatches(adapter, channel_event("hello", post_id="1"))
        adapter._handle_settings_event(
            self.put_entry_event("ownerListenDisabledChannels", ["chat/~pen/general"])
        )
        muted = self.dispatches(adapter, channel_event("hello again", post_id="2"))
        adapter._handle_settings_event(
            self.put_entry_event("ownerListenDisabledChannels", [])
        )
        unmuted = self.dispatches(adapter, channel_event("third time", post_id="3"))

        self.assertEqual(len(heard), 1)
        self.assertEqual(muted, [])
        self.assertEqual(len(unmuted), 1)

    def test_settings_del_entry_reverts_to_env_default(self):
        adapter = self.make_adapter({"owner_listen": "false"})

        adapter._handle_settings_event(self.put_entry_event("ownerListenEnabled", True))
        self.assertTrue(adapter._owner_listen.enabled)

        adapter._handle_settings_event(
            {
                "settings-event": {
                    "del-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "ownerListenEnabled",
                    }
                }
            }
        )
        self.assertFalse(adapter._owner_listen.enabled)

    def test_settings_event_updates_monitored_group_channels(self):
        adapter = self.make_adapter({})

        adapter._handle_settings_event(
            self.put_entry_event("groupChannels", ["chat/~ten/lounge", "chat/~bus/dock"])
        )
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertIn("chat/~bus/dock", adapter._monitored_channels)

        adapter._handle_settings_event(
            self.put_entry_event("groupChannels", ["chat/~ten/lounge"])
        )
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertNotIn("chat/~bus/dock", adapter._monitored_channels)

    def test_settings_event_never_drops_env_channels(self):
        adapter = self.make_adapter({})

        adapter._handle_settings_event(
            self.put_entry_event("groupChannels", ["chat/~pen/general"])
        )
        adapter._handle_settings_event(self.put_entry_event("groupChannels", []))

        self.assertIn("chat/~pen/general", adapter._monitored_channels)

    def test_settings_event_ignores_other_buckets(self):
        adapter = self.make_adapter({})

        adapter._handle_settings_event(
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "other",
                        "entry-key": "ownerListenEnabled",
                        "value": False,
                    }
                }
            }
        )

        self.assertTrue(adapter._owner_listen.enabled)

    # ── context enrichment ───────────────────────────────────────────────

    def test_mention_dispatch_includes_channel_context(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._sse = FakeSSE(
            payloads={
                "/channels/v4/chat/~pen/general/posts/newest/20/outline": {
                    "posts": {
                        "1": {"essay": essay("~ten", "older message", 500), "seal": {"id": "1"}},
                        "2": {"essay": essay("~mug", "newer message", 900), "seal": {"id": "2"}},
                        "3": {"essay": essay("~ten", "what do you think", 1000), "seal": {"id": "170.999"}},
                    }
                }
            }
        )

        events = self.dispatches(
            adapter,
            channel_event("~pen what do you think", author="~ten", post_id="170.999"),
        )

        self.assertEqual(len(events), 1)
        text = events[0].text
        self.assertIn("[Recent channel activity - 2 messages.", text)
        self.assertLess(text.index("older message"), text.index("newer message"))
        self.assertTrue(text.endswith("[Current message (mentioned you)]\nwhat do you think"))

    def test_owner_listen_dispatch_uses_plain_current_label(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE(
            payloads={
                "/channels/v4/chat/~pen/general/posts/newest/20/outline": {
                    "posts": {
                        "1": {"essay": essay("~ten", "earlier chatter", 500), "seal": {"id": "1"}},
                    }
                }
            }
        )

        events = self.dispatches(adapter, channel_event("sounds good", post_id="170.998"))

        self.assertEqual(len(events), 1)
        self.assertTrue(events[0].text.endswith("[Current message]\nsounds good"))

    def test_thread_dispatch_includes_thread_context(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._cli = FakeCLI()
        result = asyncio.run(
            adapter.send("chat/~pen/general", "bot reply", reply_to="170141")
        )
        self.assertTrue(result.success)

        adapter._sse = FakeSSE(
            payloads={
                "/channels/v4/chat/~pen/general/posts/post/170.141": {
                    "post": {"essay": essay("~ten", "root post", 100), "seal": {"id": "170.141"}}
                },
                "/channels/v4/chat/~pen/general/posts/post/id/170.141/replies/newest/20": {
                    "replies": [
                        {"memo": essay("~pen", "bot reply", 200), "seal": {"id": "2"}},
                        {"memo": essay("~ten", "following up", 300), "seal": {"id": "170.142"}},
                    ]
                },
            }
        )

        events = self.dispatches(
            adapter,
            channel_event(
                "following up",
                author="~ten",
                post_id="170.142",
                parent_id="170141",
            ),
        )

        self.assertEqual(len(events), 1)
        text = events[0].text
        self.assertIn("[Thread conversation - 2 messages", text)
        self.assertIn("~ten: root post", text)
        self.assertIn("~pen: bot reply", text)
        self.assertNotIn("~ten: following up\n", text)
        self.assertTrue(text.endswith("[Current message]\nfollowing up"))

    def test_context_disabled_when_limit_is_zero(self):
        adapter = self.make_adapter({"context_messages": 0})
        adapter._sse = FakeSSE()

        events = self.dispatches(adapter, channel_event("hello", post_id="170.997"))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "hello")
        self.assertEqual(adapter._sse.scries, [])

    def test_context_fetch_failure_falls_back_to_plain_text(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE(error=RuntimeError("scry offline"))

        events = self.dispatches(adapter, channel_event("hello", post_id="170.996"))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "hello")


if __name__ == "__main__":
    unittest.main()
