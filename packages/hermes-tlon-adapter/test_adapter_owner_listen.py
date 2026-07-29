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


def dm_thread_reply_event(text, *, author="~mug", whom="~mug", parent_id="170.140"):
    # A reply inside a DM thread rooted at writ `parent_id`.
    return {
        "whom": whom,
        "id": parent_id,
        "response": {
            "reply": {
                "id": "170.141",
                "delta": {
                    "add": {
                        "memo": {
                            "author": author,
                            "sent": 1000,
                            "content": [{"inline": [text]}],
                        }
                    }
                },
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

    async def send_message(self, chat_id, text, *, blob=None, sent_at=None):
        self.messages.append((chat_id, text))
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "send"),
            message_id="post-id",
        )

    async def send_reply(self, chat_id, post_id, text, *, parent_author=None, blob=None, sent_at=None):
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
            # Owner-listen/context assertions are independent of reaction id
            # rendering (covered by test_adapter_reactions).
            "reaction_level": "off",
        }
        base.update(extra)
        with patch.dict(os.environ, {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
        # These access-policy tests do not model a failed boot settings scry.
        # Keep pending-nudge ownership initialized so the unrelated
        # unrehydrated-reply recovery del-entry is not part of their fixtures.
        adapter._pending_nudge_rehydrated = True
        # An owner-listen command is itself owner activity, so the nudge hook
        # records lastOwnerMessage* via the async persistence drain. That is
        # covered in test_adapter_nudge; neutralize it here so its drain can't
        # leak non-deterministic pokes into these owner-listen poke assertions.
        def _skip_nudge_persistence(*_args, **_kwargs):
            return None

        adapter._nudge_activity_persistence.enqueue = _skip_nudge_persistence
        adapter._nudge_activity_persistence.enqueue_stage_clear = _skip_nudge_persistence
        adapter._pending_nudge_persistence.enqueue = _skip_nudge_persistence
        return adapter

    def dispatches(self, adapter, raw, *, dm=False):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        handler = adapter._handle_dm_event if dm else adapter._handle_channel_event
        asyncio.run(handler(raw))
        return events

    def apply_settings_event(self, adapter, event):
        asyncio.run(adapter._handle_settings_event(event))

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

    def test_mentions_dispatch_regardless_of_owner_listen_state(self):
        # Mentions are an unconditional wake: muting a channel or killing
        # owner-listen globally must never silence the bot's name.
        muted = self.make_adapter(
            {"owner_listen_disabled_channels": "chat/~pen/general"}
        )
        globally_off = self.make_adapter({"owner_listen": "false"})

        for adapter in (muted, globally_off):
            unmentioned = self.dispatches(adapter, channel_event("hello", post_id="1"))
            mentioned = self.dispatches(adapter, channel_event("~pen hello", post_id="2"))
            self.assertEqual(unmentioned, [])
            self.assertEqual(len(mentioned), 1)
            self.assertEqual(mentioned[0].text, "hello")

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

    # ── DM thread replies (issue: replies landed in main DM) ─────────────

    def test_top_level_dm_carries_no_thread_context(self):
        adapter = self.make_adapter({})
        events = self.dispatches(adapter, dm_event("hi", msg_id="dm-1"), dm=True)
        self.assertEqual(len(events), 1)
        self.assertIsNone(events[0].source.thread_id)

    def test_dm_thread_reply_flows_thread_context(self):
        # Inbound: a reply inside a DM thread must carry the thread root so
        # Hermes round-trips it back and the bot replies in-thread.
        adapter = self.make_adapter({})
        events = self.dispatches(
            adapter, dm_thread_reply_event("clarify please", parent_id="170.140"), dm=True
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].source.thread_id, "170.140")
        self.assertEqual(events[0].reply_to_message_id, "170.140")

    def test_send_threads_dm_reply_when_thread_metadata_present(self):
        # Outbound: with thread metadata, a DM reply uses posts reply (threaded)
        # rather than a top-level DM send.
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        asyncio.run(
            adapter.send("~mug", "in thread", reply_to="x", metadata={"thread_id": "170.140"})
        )
        asyncio.run(adapter.send("~mug", "top level"))

        self.assertEqual(len(adapter._cli.replies), 1)
        self.assertEqual(adapter._cli.replies[0][0], "~mug")
        self.assertEqual(adapter._cli.replies[0][1], "170.140")
        self.assertEqual([m[1] for m in adapter._cli.messages], ["top level"])

    def test_standalone_send_threads_dm_reply_when_thread_id_present(self):
        class FakeStandaloneCLI:
            instances = []

            def __init__(self, config):
                self.config = config
                self.messages = []
                self.replies = []
                self.instances.append(self)

            async def send_message(self, chat_id, text, *, blob=None, sent_at=None):
                self.messages.append((chat_id, text))
                return tlon_api.TlonSendResult(
                    success=True,
                    command=("tlon-test", "posts", "send"),
                    message_id="top-id",
                )

            async def send_reply(self, chat_id, post_id, text, *, parent_author=None, blob=None, sent_at=None):
                self.replies.append((chat_id, post_id, text, parent_author))
                return tlon_api.TlonSendResult(
                    success=True,
                    command=("tlon-test", "posts", "reply"),
                    message_id="reply-id",
                )

        pconfig = PlatformConfig(
            extra={
                "node_url": "https://pen.tlon.network",
                "node_id": "~pen",
                "access_code": "code",
            }
        )

        with patch.object(adapter_mod, "TlonCLI", FakeStandaloneCLI):
            result = asyncio.run(
                adapter_mod._standalone_send(
                    pconfig, "~ten", "thread reply", thread_id="root-post"
                )
            )

        cli = FakeStandaloneCLI.instances[0]
        self.assertTrue(result["success"])
        self.assertEqual(cli.messages, [])
        self.assertEqual(
            cli.replies,
            [("~ten", "root-post", "thread reply", "~ten")],
        )

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

    def test_settings_reload_drops_removed_settings_group_channels(self):
        adapter = self.make_adapter({})
        adapter._settings_group_channels = {
            "chat/~ten/lounge",
            "chat/~bus/dock",
            "chat/~pen/general",
        }
        adapter._monitored_channels.update(adapter._settings_group_channels)
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "groupChannels": ["chat/~ten/lounge"],
                            }
                        }
                    }
                }
            }
        )

        asyncio.run(adapter._load_settings_state())

        self.assertEqual(adapter._settings_group_channels, {"chat/~ten/lounge"})
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertNotIn("chat/~bus/dock", adapter._monitored_channels)
        self.assertIn("chat/~pen/general", adapter._monitored_channels)

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

    # ── TLON-6090: defaultAuthorizedShips / autoAcceptDmInvites /
    #    autoDiscoverChannels settings-key parity ─────────────────────────

    def test_settings_load_reads_the_three_new_keys(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "defaultAuthorizedShips": ["~ten", "~bus"],
                                "autoAcceptDmInvites": True,
                                "autoDiscoverChannels": True,
                            }
                        }
                    }
                }
            }
        )

        asyncio.run(adapter._load_settings_state())

        self.assertEqual(
            adapter._settings_default_authorized_ships, {"~ten", "~bus"}
        )
        self.assertTrue(adapter._auto_accept_dm_invites)
        self.assertTrue(adapter._auto_discover)

    def test_settings_load_absent_keys_keep_seeded_defaults(self):
        adapter = self.make_adapter({"auto_discover": "true"})
        adapter._auto_accept_dm_invites = True  # simulate a prior load
        adapter._settings_default_authorized_ships = {"~stale"}
        adapter._sse = FakeSSE(payloads={"/settings/all": {"all": {"moltbot": {"tlon": {}}}}})

        asyncio.run(adapter._load_settings_state())

        # defaultAuthorizedShips has no env seed: reverts to empty, not stale.
        self.assertEqual(adapter._settings_default_authorized_ships, set())
        # autoAcceptDmInvites has no env seed: reverts to False, not stale True.
        self.assertFalse(adapter._auto_accept_dm_invites)
        # autoDiscoverChannels reverts to the env seed (true here), not False.
        self.assertTrue(adapter._auto_discover)

    def test_settings_load_invalid_typed_values_fall_back_to_default(self):
        adapter = self.make_adapter({"auto_discover": "true"})
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "autoAcceptDmInvites": "false",  # truthy string, not bool
                                "autoDiscoverChannels": 0,
                                "defaultAuthorizedShips": [7, "~zod"],
                            }
                        }
                    }
                }
            }
        )

        asyncio.run(adapter._load_settings_state())

        # "false" is not a genuine bool -> falls back to the default (False),
        # not coerced to True via bool("false").
        self.assertFalse(adapter._auto_accept_dm_invites)
        # 0 is not a genuine bool -> falls back to the env seed (True).
        self.assertTrue(adapter._auto_discover)
        # Non-string entries are dropped, not coerced.
        self.assertEqual(adapter._settings_default_authorized_ships, {"~zod"})

    def test_settings_reload_after_key_disappears_reverts_to_default(self):
        adapter = self.make_adapter({})
        adapter._sse = FakeSSE(
            payloads={
                "/settings/all": {
                    "all": {
                        "moltbot": {
                            "tlon": {
                                "autoAcceptDmInvites": True,
                                "defaultAuthorizedShips": ["~ten"],
                            }
                        }
                    }
                }
            }
        )
        asyncio.run(adapter._load_settings_state())
        self.assertTrue(adapter._auto_accept_dm_invites)
        self.assertEqual(adapter._settings_default_authorized_ships, {"~ten"})

        # Reconnect: the bucket no longer has the keys (deleted while down).
        adapter._sse = FakeSSE(
            payloads={"/settings/all": {"all": {"moltbot": {"tlon": {}}}}}
        )
        asyncio.run(adapter._load_settings_state())

        self.assertFalse(adapter._auto_accept_dm_invites)
        self.assertEqual(adapter._settings_default_authorized_ships, set())

    def test_settings_event_del_entry_reverts_new_keys(self):
        adapter = self.make_adapter({"auto_discover": "true"})

        self.apply_settings_event(
            adapter, self.put_entry_event("autoAcceptDmInvites", True)
        )
        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", False)
        )
        self.assertTrue(adapter._auto_accept_dm_invites)
        self.assertFalse(adapter._auto_discover)

        def del_entry(key):
            return {
                "settings-event": {
                    "del-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": key,
                    }
                }
            }

        self.apply_settings_event(adapter, del_entry("autoAcceptDmInvites"))
        self.apply_settings_event(adapter, del_entry("autoDiscoverChannels"))

        self.assertFalse(adapter._auto_accept_dm_invites)
        # Reverts to the env seed (true), not unconditionally False.
        self.assertTrue(adapter._auto_discover)

    def test_settings_event_hot_reloads_default_authorized_ships(self):
        adapter = self.make_adapter({})

        self.apply_settings_event(
            adapter, self.put_entry_event("defaultAuthorizedShips", ["~ten"])
        )
        self.assertEqual(adapter._settings_default_authorized_ships, {"~ten"})

        # Unrelated key updates leave it untouched.
        self.apply_settings_event(
            adapter, self.put_entry_event("groupChannels", ["chat/~bus/dock"])
        )
        self.assertEqual(adapter._settings_default_authorized_ships, {"~ten"})

    def test_settings_event_hot_reloads_auto_discover_channels(self):
        adapter = self.make_adapter({"auto_discover": "false"})
        self.assertFalse(adapter._auto_discover)

        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", True)
        )
        self.assertTrue(adapter._auto_discover)

        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", False)
        )
        self.assertFalse(adapter._auto_discover)

    def test_auto_discover_channels_store_true_overrides_env_false(self):
        adapter = self.make_adapter({"auto_discover": "false"})
        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", True)
        )

        events = self.dispatches(
            adapter, channel_event("hi", nest="chat/~mug/new-spot")
        )

        self.assertEqual(len(events), 1)
        self.assertIn("chat/~mug/new-spot", adapter._monitored_channels)

    def test_auto_discover_channels_store_false_overrides_env_true(self):
        adapter = self.make_adapter({"auto_discover": "true"})
        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", False)
        )

        events = self.dispatches(
            adapter, channel_event("hi", nest="chat/~mug/new-spot")
        )

        self.assertEqual(events, [])
        self.assertNotIn("chat/~mug/new-spot", adapter._monitored_channels)

    def test_auto_discover_toggle_off_does_not_unmonitor_discovered_channel(self):
        adapter = self.make_adapter({"auto_discover": "true"})

        discovered = self.dispatches(
            adapter, channel_event("hi", nest="chat/~mug/new-spot")
        )
        self.assertEqual(len(discovered), 1)
        self.assertIn("chat/~mug/new-spot", adapter._monitored_channels)

        self.apply_settings_event(
            adapter, self.put_entry_event("autoDiscoverChannels", False)
        )

        still_dispatches = self.dispatches(
            adapter, channel_event("hi again", nest="chat/~mug/new-spot", post_id="2")
        )
        self.assertEqual(len(still_dispatches), 1)
        self.assertIn("chat/~mug/new-spot", adapter._monitored_channels)

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

    # ── group targets + default mode ─────────────────────────────────────

    def test_group_flag_command_enables_all_group_channels(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE(
            payloads={
                "/groups-ui/v7/init": {
                    "groups": {
                        "~ten/projects": {
                            "channels": {
                                "chat/~ten/general": {},
                                "heap/~ten/art": {},
                                "diary/~ten/notes": {},
                            }
                        }
                    }
                }
            }
        )

        events = self.dispatches(
            adapter,
            dm_event("/owner-listen on ~ten/projects", author="~mug", whom="~mug"),
            dm=True,
        )

        self.assertEqual(events, [])
        self.assertEqual(
            adapter._owner_listen.enabled_channels,
            {"chat/~ten/general", "heap/~ten/art", "diary/~ten/notes"},
        )
        self.assertLessEqual(
            {"chat/~ten/general", "heap/~ten/art", "diary/~ten/notes"},
            adapter._monitored_channels,
        )
        reply = adapter._cli.messages[-1][1]
        self.assertIn("on for 3 channel(s) in ~ten/projects", reply)
        self.assertIn("Now monitoring 3 of them.", reply)
        poked_keys = [
            poke[2]["put-entry"]["entry-key"]
            for poke in adapter._sse.pokes
            if poke[1] == "settings-event"
        ]
        self.assertIn("ownerListenEnabledChannels", poked_keys)
        self.assertIn("groupChannels", poked_keys)

        # owner is now heard in those channels without a mention
        heard = self.dispatches(
            adapter, channel_event("hello there", nest="chat/~ten/general")
        )
        self.assertEqual(len(heard), 1)

    def test_group_flag_command_reports_lookup_failure(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE()  # no init payload -> scry fails

        self.dispatches(
            adapter,
            dm_event("/owner-listen on ~ten/projects", author="~mug", whom="~mug"),
            dm=True,
        )

        self.assertIn(
            "Could not look up channels for ~ten/projects",
            adapter._cli.messages[-1][1],
        )
        self.assertEqual(adapter._owner_listen.enabled_channels, set())

    def test_default_all_command_makes_owner_heard_everywhere(self):
        nest = "chat/~ten/lounge"
        adapter = self.make_adapter({"channels": ["chat/~pen/general", nest]})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE()

        before = self.dispatches(adapter, channel_event("hello?", nest=nest, post_id="1"))
        self.dispatches(
            adapter,
            dm_event("/owner-listen default all", author="~mug", whom="~mug"),
            dm=True,
        )
        after = self.dispatches(adapter, channel_event("hello!", nest=nest, post_id="2"))

        self.assertEqual(before, [])
        self.assertEqual(len(after), 1)
        self.assertIn(
            "default is now all monitored channels", adapter._cli.messages[-1][1]
        )
        default_writes = [
            poke[2]["put-entry"]
            for poke in adapter._sse.pokes
            if poke[2]["put-entry"]["entry-key"] == "ownerListenDefault"
        ]
        self.assertEqual(default_writes[-1]["value"], "all")

    # ── /tlon-version ────────────────────────────────────────────────────

    def test_version_command_replies_with_field_lines(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon-version"))

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.messages), 1)
        self.assertEqual(adapter._cli.messages[0][0], "chat/~pen/general")
        lines = adapter._cli.messages[0][1].splitlines()
        self.assertEqual(len(lines), 5)
        self.assertEqual(lines[0], "*Harness*: **Hermes**")
        # exact version is covered in test_version; here we pin field + format
        self.assertRegex(lines[1], r"^\*Adapter Version\*: \*\*.+\*\*$")
        self.assertEqual(lines[2], "*Tlon Skill*: **0.3.2**")
        self.assertRegex(lines[3], r"^\*Fingerprint\*: \*\*fp1:[0-9a-f]{12}\*\*$")
        self.assertTrue(lines[4].startswith("*Source*: **"))
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
            "*Tlon Skill*: **unavailable (tlon CLI not found: tlon)**",
            adapter._cli.messages[0][1],
        )

    # ── /tlon command namespace ──────────────────────────────────────────

    def test_tlon_version_subcommand(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon version"))

        self.assertEqual(events, [])
        lines = adapter._cli.messages[0][1].splitlines()
        self.assertEqual(lines[0], "*Harness*: **Hermes**")
        self.assertRegex(lines[1], r"^\*Adapter Version\*: \*\*.+\*\*$")

    def test_tlon_status_telemetry_subcommand(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        events = self.dispatches(adapter, channel_event("/tlon status telemetry"))

        self.assertEqual(events, [])
        reply = adapter._cli.messages[0][1]
        self.assertIn("Telemetry: disabled — TLON_TELEMETRY is not enabled", reply)
        self.assertIn("Distinct id: ~mug", reply)

    def test_tlon_status_telemetry_test_subcommand(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        self.dispatches(adapter, dm_event("/tlon status telemetry test"), dm=True)

        self.assertIn(
            "Cannot test: telemetry is disabled", adapter._cli.messages[0][1]
        )

    def test_tlon_status_storage_subcommand(self):
        # hosting resolved at construction (from extra), like the real adapter —
        # the diagnostic reflects the config that actually drives uploads.
        adapter = self.make_adapter({"hosting": True})
        adapter._cli = FakeCLI()
        adapter._sse = FakeSSE(
            payloads={
                "/storage/configuration": {
                    "storage-update": {"configuration": {"service": "presigned-url"}}
                },
                "/storage/credentials": {"storage-update": {"credentials": None}},
                "/genuine/secret": "genuine-token",
            }
        )

        self.dispatches(adapter, channel_event("/tlon status storage"))

        reply = adapter._cli.messages[0][1]
        self.assertIn("*Storage service*: **presigned-url**", reply)
        self.assertIn("*TLON_HOSTING*: **set**", reply)
        self.assertIn("*%genuine token*: **reachable**", reply)
        self.assertIn("*Upload path*: **memex (hosted)**", reply)

    def test_tlon_status_binary_reports_hash_and_version(self):
        import tempfile

        with tempfile.NamedTemporaryFile(suffix="-tlon", delete=False) as fh:
            fh.write(b"fake tlon binary bytes")
            binary_path = fh.name
        adapter = self.make_adapter({"cli": binary_path})
        adapter._cli = FakeCLI(version_stdout="0.4.0 (deadbeef)\n")

        reply = asyncio.run(adapter._binary_status_reply())
        os.unlink(binary_path)

        self.assertIn("*Tlon Skill*: **0.4.0 (deadbeef)**", reply)
        self.assertRegex(reply, r"\*Build\*: \*\*sha256:[0-9a-f]{12}\*\*")
        self.assertIn("*Size*: **22 bytes**", reply)
        self.assertIn(binary_path, reply)

    def test_tlon_status_binary_handles_missing_binary(self):
        adapter = self.make_adapter({"cli": "/nonexistent/tlon-binary"})
        adapter._cli = FakeCLI(version_stdout="0.4.0\n")
        reply = asyncio.run(adapter._binary_status_reply())
        self.assertIn("unreadable", reply)

    def test_tlon_bare_and_unknown_show_usage(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        self.dispatches(adapter, channel_event("/tlon", post_id="1"))
        self.dispatches(adapter, channel_event("/tlon wat", post_id="2"))

        for msg in adapter._cli.messages:
            self.assertIn("Usage: /tlon", msg[1])

    def test_legacy_tlon_version_alias_still_works(self):
        adapter = self.make_adapter({})
        adapter._cli = FakeCLI()

        self.dispatches(adapter, channel_event("/tlon-version"))

        self.assertEqual(adapter._cli.messages[0][1].splitlines()[0], "*Harness*: **Hermes**")

    def test_tlon_command_from_non_owner_is_not_intercepted(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._cli = FakeCLI()

        events = self.dispatches(
            adapter, channel_event("/tlon status telemetry", author="~ten")
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
        self.apply_settings_event(
            adapter,
            self.put_entry_event("ownerListenDisabledChannels", ["chat/~pen/general"]),
        )
        muted = self.dispatches(adapter, channel_event("hello again", post_id="2"))
        self.apply_settings_event(
            adapter, self.put_entry_event("ownerListenDisabledChannels", [])
        )
        unmuted = self.dispatches(adapter, channel_event("third time", post_id="3"))

        self.assertEqual(len(heard), 1)
        self.assertEqual(muted, [])
        self.assertEqual(len(unmuted), 1)

    def test_settings_del_entry_reverts_to_env_default(self):
        adapter = self.make_adapter({"owner_listen": "false"})

        self.apply_settings_event(
            adapter, self.put_entry_event("ownerListenEnabled", True)
        )
        self.assertTrue(adapter._owner_listen.enabled)

        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "del-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "ownerListenEnabled",
                    }
                }
            },
        )
        self.assertFalse(adapter._owner_listen.enabled)

    def test_settings_event_updates_monitored_group_channels(self):
        adapter = self.make_adapter({})

        self.apply_settings_event(
            adapter,
            self.put_entry_event("groupChannels", ["chat/~ten/lounge", "chat/~bus/dock"]),
        )
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertIn("chat/~bus/dock", adapter._monitored_channels)

        self.apply_settings_event(
            adapter, self.put_entry_event("groupChannels", ["chat/~ten/lounge"])
        )
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertNotIn("chat/~bus/dock", adapter._monitored_channels)

    def test_settings_event_never_drops_env_channels(self):
        adapter = self.make_adapter({})

        self.apply_settings_event(
            adapter, self.put_entry_event("groupChannels", ["chat/~pen/general"])
        )
        self.apply_settings_event(adapter, self.put_entry_event("groupChannels", []))

        self.assertIn("chat/~pen/general", adapter._monitored_channels)

    def test_settings_event_ignores_other_buckets(self):
        adapter = self.make_adapter({})

        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "other",
                        "entry-key": "ownerListenEnabled",
                        "value": False,
                    }
                }
            },
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
            adapter.send(
                "chat/~pen/general",
                "bot reply",
                reply_to="170141",
                metadata={"thread_id": "170141"},
            )
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
