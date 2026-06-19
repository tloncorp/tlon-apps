import asyncio
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_attention_testpkg"

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


class FakeSSE:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    async def scry(self, path):
        if self.error:
            raise self.error
        return self.payload


class FakeCLI:
    async def send_reply(self, chat_id, post_id, text, *, parent_author=None):
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "reply"),
            message_id="reply-id",
        )

    async def send_message(self, chat_id, text):
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "send"),
            message_id="post-id",
        )


class HermesToolPermissionSnapshotTests(unittest.TestCase):
    def _with_fake_hermes_config(self, config, enabled_toolsets):
        parent = types.ModuleType("hermes_cli")
        parent.__path__ = []
        config_mod = types.ModuleType("hermes_cli.config")
        config_mod.load_config = lambda: config
        tools_config_mod = types.ModuleType("hermes_cli.tools_config")
        tools_config_mod._get_platform_tools = (
            lambda loaded, platform, include_default_mcp_servers=True: enabled_toolsets
        )
        return patch.dict(
            sys.modules,
            {
                "hermes_cli": parent,
                "hermes_cli.config": config_mod,
                "hermes_cli.tools_config": tools_config_mod,
            },
        )

    def test_cronjob_available_when_runtime_and_toolset_are_enabled(self):
        env = {"HERMES_EXEC_ASK": "1", "TLON_HOME_CHANNEL": "chat/~pen/general"}
        config = {
            "platform_toolsets": {"tlon": ["web", "cronjob"]},
            "agent": {"disabled_toolsets": ["messaging"]},
        }

        with self._with_fake_hermes_config(config, {"web", "cronjob", "tlon"}):
            snapshot = adapter_mod._hermes_tool_permission_snapshot(env)

        self.assertTrue(snapshot["hermesCronjobRuntimeAllowed"])
        self.assertTrue(snapshot["hermesCronjobToolsetEnabled"])
        self.assertFalse(snapshot["hermesCronjobDisabledByAgentConfig"])
        self.assertTrue(snapshot["hermesCronjobAvailableAtStartup"])
        self.assertTrue(snapshot["hermesCronDeliveryHomeChannelConfigured"])
        self.assertEqual(snapshot["hermesTlonToolsetsResolved"], ["cronjob", "tlon", "web"])

    def test_cronjob_unavailable_when_agent_config_disables_it(self):
        env = {"HERMES_GATEWAY_SESSION": "true"}
        config = {
            "platform_toolsets": {"tlon": ["cronjob"]},
            "agent": {"disabled_toolsets": ["cronjob"]},
        }

        with self._with_fake_hermes_config(config, {"cronjob"}):
            snapshot = adapter_mod._hermes_tool_permission_snapshot(env)

        self.assertTrue(snapshot["hermesCronjobRuntimeAllowed"])
        self.assertTrue(snapshot["hermesCronjobToolsetEnabled"])
        self.assertTrue(snapshot["hermesCronjobDisabledByAgentConfig"])
        self.assertFalse(snapshot["hermesCronjobAvailableAtStartup"])

    def test_cronjob_unavailable_without_runtime_permission_flags(self):
        config = {"platform_toolsets": {"tlon": ["cronjob"]}}

        with self._with_fake_hermes_config(config, {"cronjob"}):
            snapshot = adapter_mod._hermes_tool_permission_snapshot({})

        self.assertFalse(snapshot["hermesCronjobRuntimeAllowed"])
        self.assertTrue(snapshot["hermesCronjobToolsetEnabled"])
        self.assertFalse(snapshot["hermesCronjobAvailableAtStartup"])


class AdapterAttentionTests(unittest.TestCase):
    def make_adapter(self, extra):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
        }
        base.update(extra)
        with patch.dict(os.environ, {}, clear=True):
            return adapter_mod.TlonAdapter(PlatformConfig(extra=base))

    async def dispatches(self, adapter, raw):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        await adapter._handle_channel_event(raw)
        return events

    def test_group_alias_dispatches_and_strips_leading_wake(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~mug"],
                "bot_mentions": ["Mr Arvo"],
            }
        )

        events = asyncio.run(self.dispatches(adapter, channel_event("Mr Arvo, hello")))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "hello")

    def test_unmentioned_group_drops_until_free_response_is_configured(self):
        default_open = self.make_adapter(
            {
                "require_mention": False,
            }
        )
        allowed = self.make_adapter(
            {
                "allowed_users": ["~mug"],
                "require_mention": False,
            }
        )

        self.assertEqual(
            asyncio.run(self.dispatches(default_open, channel_event("hello"))),
            [],
        )
        self.assertEqual(
            len(asyncio.run(self.dispatches(allowed, channel_event("hello")))),
            1,
        )

    def test_participated_thread_dispatches_without_repeated_wake(self):
        adapter = self.make_adapter({"allowed_users": ["~mug"]})
        adapter._cli = FakeCLI()

        # Core passes metadata.thread_id when the bot replies inside a thread;
        # that (not reply_to) is what makes the send a Tlon thread reply.
        result = asyncio.run(
            adapter.send(
                "chat/~pen/general",
                "reply text",
                reply_to="some-reply-id",
                metadata={"thread_id": "root-post"},
            )
        )
        events = asyncio.run(
            self.dispatches(
                adapter,
                channel_event("following up", post_id="170.142", parent_id="root-post"),
            )
        )

        self.assertTrue(result.success)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "following up")

    def test_known_bot_loop_cap_is_per_channel_and_resets_on_human_dispatch(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot", "~mug"],
                "require_mention": False,
                "known_bot_users": ["~bot"],
                "max_consecutive_bot_responses": 2,
            }
        )

        first = asyncio.run(
            self.dispatches(adapter, channel_event("bot one", author="~bot", post_id="1"))
        )
        second = asyncio.run(
            self.dispatches(adapter, channel_event("bot two", author="~bot", post_id="2"))
        )
        third = asyncio.run(
            self.dispatches(adapter, channel_event("bot three", author="~bot", post_id="3"))
        )
        human = asyncio.run(
            self.dispatches(adapter, channel_event("human reset", author="~mug", post_id="4"))
        )
        after_reset = asyncio.run(
            self.dispatches(adapter, channel_event("bot four", author="~bot", post_id="5"))
        )

        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)
        self.assertEqual(third, [])
        self.assertEqual(len(human), 1)
        self.assertEqual(len(after_reset), 1)

    def test_loop_counter_ignores_messages_that_drop_before_dispatch(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "known_bot_users": ["~bot"],
                "max_consecutive_bot_responses": 1,
            }
        )

        dropped = asyncio.run(
            self.dispatches(adapter, channel_event("not addressed", author="~bot", post_id="1"))
        )
        mentioned = asyncio.run(
            self.dispatches(adapter, channel_event("~pen hello", author="~bot", post_id="2"))
        )
        duplicate = asyncio.run(
            self.dispatches(adapter, channel_event("~pen hello", author="~bot", post_id="2"))
        )

        self.assertEqual(dropped, [])
        self.assertEqual(len(mentioned), 1)
        self.assertEqual(duplicate, [])
        self.assertEqual(adapter._known_bot_consecutive_by_channel, {"chat/~pen/general": 1})

    def test_dm_behavior_stays_outside_group_loop_cap(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "known_bot_users": ["~bot"],
                "max_consecutive_bot_responses": 1,
            }
        )
        message = tlon_api.TlonIncomingMessage(
            chat_id="~bot",
            chat_name="~bot",
            chat_type="dm",
            user_id="~bot",
            user_name="~bot",
            text="hello",
            message_id="dm-1",
            reply_to_message_id=None,
            sent_at=tlon_api._datetime_from_ms(1000),
            raw={},
        )
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        asyncio.run(adapter._dispatch_message(message, is_dm=True))

        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._known_bot_consecutive_by_channel, {})

    def test_group_reply_is_top_level_unless_thread_metadata(self):
        adapter = self.make_adapter({"allowed_users": ["~mug"]})

        class RecordingCLI(FakeCLI):
            def __init__(self):
                self.sends = []
                self.thread_replies = []

            async def send_message(self, chat_id, text):
                self.sends.append((chat_id, text))
                return await super().send_message(chat_id, text)

            async def send_reply(self, chat_id, post_id, text, *, parent_author=None):
                self.thread_replies.append((chat_id, post_id, text))
                return await super().send_reply(
                    chat_id, post_id, text, parent_author=parent_author
                )

        adapter._cli = RecordingCLI()

        # Core anchors replies to the triggering message, but with no thread
        # metadata the Tlon reply goes top-level in the channel.
        asyncio.run(
            adapter.send("chat/~pen/general", "top-level reply", reply_to="170.141")
        )
        self.assertEqual(len(adapter._cli.sends), 1)
        self.assertEqual(adapter._cli.thread_replies, [])
        self.assertEqual(adapter._participated_threads, set())

        # Thread metadata carries the thread ROOT — that is what gets threaded.
        asyncio.run(
            adapter.send(
                "chat/~pen/general",
                "in-thread reply",
                reply_to="170.150",
                metadata={"thread_id": "170.100"},
            )
        )
        self.assertEqual(len(adapter._cli.thread_replies), 1)
        self.assertEqual(adapter._cli.thread_replies[0][1], "170.100")
        self.assertIn(
            "chat/~pen/general:170.100", adapter._participated_threads
        )

    def test_reply_in_thread_config_restores_legacy_threading(self):
        adapter = self.make_adapter(
            {"allowed_users": ["~mug"], "reply_in_thread": True}
        )
        adapter._cli = FakeCLI()
        recorded = []

        async def record_reply(chat_id, post_id, text, *, parent_author=None):
            recorded.append(post_id)
            return tlon_api.TlonSendResult(
                success=True, command=("tlon-test",), message_id="reply-id"
            )

        adapter._cli.send_reply = record_reply
        asyncio.run(adapter.send("chat/~pen/general", "reply", reply_to="170.141"))
        self.assertEqual(recorded, ["170.141"])

    def test_nickname_fetch_failure_keeps_ship_and_alias_wakes(self):
        adapter = self.make_adapter({"allowed_users": ["~mug"], "bot_mentions": ["arvo"]})
        adapter._sse = FakeSSE(error=RuntimeError("not ready"))

        asyncio.run(adapter._load_bot_nickname())

        self.assertTrue(adapter._mention_matcher.mentioned("~pen hello"))
        self.assertTrue(adapter._mention_matcher.mentioned("arvo hello"))

    def test_nickname_fetch_success_adds_nickname_wake(self):
        adapter = self.make_adapter({"allowed_users": ["~mug"]})
        adapter._sse = FakeSSE(payload={"nickname": {"value": "Jon"}})

        asyncio.run(adapter._load_bot_nickname())
        events = asyncio.run(self.dispatches(adapter, channel_event("jon, hello")))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "hello")

    def test_env_enablement_seeds_owner_dm_as_home_channel(self):
        with patch.dict(
            os.environ,
            {
                "TLON_NODE_URL": "https://pen.tlon.network",
                "TLON_NODE_ID": "~pen",
                "TLON_ACCESS_CODE": "code",
                "TLON_OWNER_SHIP": "~mug",
                "TLON_CHANNELS": "chat/~pen/general",
            },
            clear=True,
        ):
            seed = adapter_mod._env_enablement()
            allowed_users = os.environ.get("TLON_ALLOWED_USERS")

        self.assertEqual(seed["home_channel"], {"chat_id": "~mug", "name": "~mug"})
        # The adapter owns access policy; core's env allowlist is never seeded.
        self.assertIsNone(allowed_users)

    def test_adapter_enforces_own_access_policy_for_core(self):
        adapter = self.make_adapter({"owner_ship": "~mug"})
        self.assertIs(adapter.enforces_own_access_policy, True)
        self.assertEqual(adapter._dm_policy, "allowlist")
        self.assertEqual(adapter._group_policy, "allowlist")

    def test_node_url_is_hosted(self):
        self.assertTrue(adapter_mod.node_url_is_hosted("https://sampel.tlon.network"))
        self.assertTrue(adapter_mod.node_url_is_hosted("https://x.tlon.network/"))
        self.assertFalse(adapter_mod.node_url_is_hosted("http://localhost:8080"))
        self.assertFalse(adapter_mod.node_url_is_hosted("https://my.ship.example.com"))

    def test_format_storage_status_decision_matrix(self):
        f = adapter_mod.format_storage_status
        # forced hosting + presigned + token → memex
        r = f(node_url="http://localhost:8080", url_hosted=False, hosting_forced=True,
              service="presigned-url", has_s3_creds=False, genuine_reachable=True)
        self.assertIn("*Upload path*: **memex (hosted)**", r)
        # forced hosting but no token → memex would fail
        r = f(node_url="http://localhost:8080", url_hosted=False, hosting_forced=True,
              service="presigned-url", has_s3_creds=False, genuine_reachable=False)
        self.assertIn("would FAIL: no %genuine token", r)
        # not hosted, no creds → fails (the bug screenshot)
        r = f(node_url="http://localhost:8080", url_hosted=False, hosting_forced=False,
              service="presigned-url", has_s3_creds=False, genuine_reachable=True)
        self.assertIn("would FAIL: no storage credentials", r)
        self.assertIn("*TLON_HOSTING*: **unset**", r)
        # custom S3 creds → S3
        r = f(node_url="http://localhost:8080", url_hosted=False, hosting_forced=False,
              service="credentials", has_s3_creds=True, genuine_reachable=False)
        self.assertIn("*Upload path*: **S3 (custom credentials)**", r)

    def test_env_enablement_does_not_infer_home_channel_from_allowlist(self):
        with patch.dict(
            os.environ,
            {
                "TLON_NODE_URL": "https://pen.tlon.network",
                "TLON_NODE_ID": "~pen",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_CHANNELS": "chat/~pen/general",
            },
            clear=True,
        ):
            seed = adapter_mod._env_enablement()

        self.assertNotIn("home_channel", seed)

    def test_env_enablement_respects_explicit_home_channel(self):
        with patch.dict(
            os.environ,
            {
                "TLON_NODE_URL": "https://pen.tlon.network",
                "TLON_NODE_ID": "~pen",
                "TLON_ACCESS_CODE": "code",
                "TLON_ALLOWED_USERS": "~mug",
                "TLON_HOME_CHANNEL": "chat/~pen/home",
            },
            clear=True,
        ):
            seed = adapter_mod._env_enablement()

        self.assertEqual(
            seed["home_channel"],
            {"chat_id": "chat/~pen/home", "name": "chat/~pen/home"},
        )

    def test_tlon_session_blocks_skill_management(self):
        with patch.dict(os.environ, {"HERMES_SESSION_PLATFORM": "tlon"}, clear=True):
            block = adapter_mod.block_tlon_session_tool(
                "skill_manage",
                {"action": "create"},
            )

        self.assertIsNotNone(block)
        self.assertEqual(block["action"], "block")
        self.assertIn("managed Tlon prompt", block["message"])

    def test_non_tlon_session_allows_skill_management_hook(self):
        with patch.dict(os.environ, {"HERMES_SESSION_PLATFORM": "cli"}, clear=True):
            block = adapter_mod.block_tlon_session_tool(
                "skill_manage",
                {"action": "create"},
            )

        self.assertIsNone(block)


if __name__ == "__main__":
    unittest.main()
