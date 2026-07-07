import asyncio
import importlib.util
import json
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
    blob=None,
    content=None,
):
    story_content = [{"inline": [text]}] if content is None else content
    set_payload = {
        "essay": {
            "author": author,
            "sent": 1000,
            "content": story_content,
        }
    }
    if blob is not None:
        set_payload["essay"]["blob"] = blob
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
    async def send_reply(self, chat_id, post_id, text, *, parent_author=None, blob=None):
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "reply"),
            message_id="reply-id",
        )

    async def send_message(self, chat_id, text, *, blob=None):
        return tlon_api.TlonSendResult(
            success=True,
            command=("tlon-test", "posts", "send"),
            message_id="post-id",
        )


class HermesToolPermissionSnapshotTests(unittest.TestCase):
    def _with_fake_hermes_config(
        self,
        config,
        enabled_toolsets,
        *,
        registry_toolsets=None,
        registry_aliases=None,
    ):
        parent = types.ModuleType("hermes_cli")
        parent.__path__ = []
        config_mod = types.ModuleType("hermes_cli.config")
        config_mod.load_config = lambda: config
        tools_config_mod = types.ModuleType("hermes_cli.tools_config")
        tools_config_mod._get_platform_tools = (
            lambda loaded, platform, include_default_mcp_servers=True: enabled_toolsets
        )
        toolsets_mod = types.ModuleType("toolsets")
        tools_parent = types.ModuleType("tools")
        tools_parent.__path__ = []
        registry_mod = types.ModuleType("tools.registry")
        registry_toolsets = registry_toolsets or {}
        registry_aliases = registry_aliases or {}

        def resolve_toolset(name):
            # Match Hermes' collision behavior: the built-in/plugin "tlon"
            # toolset wins over an MCP alias with the same raw server name.
            if name == "tlon":
                return [tool for tool, toolset in registry_toolsets.items() if toolset == "tlon"]
            target = registry_aliases.get(name, name)
            return [tool for tool, toolset in registry_toolsets.items() if toolset == target]

        toolsets_mod.resolve_toolset = resolve_toolset

        class FakeRegistry:
            def get_tool_to_toolset_map(self):
                return registry_toolsets

            def get_registered_toolset_aliases(self):
                return registry_aliases

        registry_mod.registry = FakeRegistry()
        return patch.dict(
            sys.modules,
            {
                "hermes_cli": parent,
                "hermes_cli.config": config_mod,
                "hermes_cli.tools_config": tools_config_mod,
                "toolsets": toolsets_mod,
                "tools": tools_parent,
                "tools.registry": registry_mod,
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

    def test_mcp_snapshot_counts_configured_registered_and_visible_tools(self):
        config = {
            "platform_toolsets": {"tlon": ["tlon", "tlon-mcp"]},
            "mcp_servers": {
                "tlon-mcp": {"enabled": True},
                "linear": {"enabled": False},
            },
        }

        with self._with_fake_hermes_config(
            config,
            {"tlon", "tlon-mcp"},
            registry_toolsets={
                "mcp_tlon_mcp_search": "mcp-tlon-mcp",
                "tlon": "tlon",
            },
            registry_aliases={"tlon-mcp": "mcp-tlon-mcp"},
        ):
            snapshot = adapter_mod._hermes_tool_permission_snapshot({})

        self.assertEqual(snapshot["hermesMcpServersConfigured"], ["linear", "tlon-mcp"])
        self.assertEqual(snapshot["hermesMcpServersConfiguredCount"], 2)
        self.assertEqual(snapshot["hermesMcpServersEnabled"], ["tlon-mcp"])
        self.assertEqual(snapshot["hermesMcpServersEnabledCount"], 1)
        self.assertEqual(snapshot["hermesMcpExplicitServerAllowlist"], ["tlon-mcp"])
        self.assertFalse(snapshot["hermesMcpDefaultServerSetEnabled"])
        self.assertEqual(snapshot["hermesMcpRegisteredToolsets"], ["mcp-tlon-mcp"])
        self.assertEqual(snapshot["hermesMcpRegisteredToolsetsCount"], 1)
        self.assertEqual(snapshot["hermesMcpRegisteredToolsCount"], 1)
        self.assertEqual(snapshot["hermesMcpRegisteredToolsEnabledForTlonCount"], 1)

    def test_mcp_snapshot_detects_server_name_collision_with_tlon_toolset(self):
        config = {
            "platform_toolsets": {"tlon": ["tlon", "cronjob"]},
            "mcp_servers": {"tlon": {"enabled": True}},
        }

        with self._with_fake_hermes_config(
            config,
            {"tlon", "cronjob"},
            registry_toolsets={
                "mcp_tlon_search": "mcp-tlon",
                "tlon": "tlon",
            },
            registry_aliases={"tlon": "mcp-tlon"},
        ):
            snapshot = adapter_mod._hermes_tool_permission_snapshot({})

        self.assertEqual(snapshot["hermesMcpServersEnabled"], ["tlon"])
        self.assertEqual(snapshot["hermesMcpRegisteredToolsets"], ["mcp-tlon"])
        self.assertEqual(snapshot["hermesMcpRegisteredToolsCount"], 1)
        self.assertEqual(snapshot["hermesMcpRegisteredToolsEnabledForTlonCount"], 0)

    def test_mcp_snapshot_identifies_default_server_set(self):
        config = {
            "platform_toolsets": {"tlon": ["tlon", "cronjob"]},
            "mcp_servers": {"tlon-mcp": {"enabled": "true"}},
        }

        with self._with_fake_hermes_config(config, {"tlon", "cronjob", "tlon-mcp"}):
            snapshot = adapter_mod._hermes_tool_permission_snapshot({})

        self.assertEqual(snapshot["hermesMcpServersEnabled"], ["tlon-mcp"])
        self.assertEqual(snapshot["hermesMcpExplicitServerAllowlist"], [])
        self.assertTrue(snapshot["hermesMcpDefaultServerSetEnabled"])

    def test_mcp_snapshot_does_not_mark_default_server_set_when_unresolved(self):
        config = {
            "platform_toolsets": {"tlon": ["tlon", "cronjob"]},
            "mcp_servers": {"tlon-mcp": {"enabled": True}},
        }

        with self._with_fake_hermes_config(config, {"tlon", "cronjob"}):
            snapshot = adapter_mod._hermes_tool_permission_snapshot({})

        self.assertEqual(snapshot["hermesMcpServersEnabled"], ["tlon-mcp"])
        self.assertEqual(snapshot["hermesMcpExplicitServerAllowlist"], [])
        self.assertFalse(snapshot["hermesMcpDefaultServerSetEnabled"])


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

    def test_attachment_media_is_prepared_for_dispatch(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~mug"],
                "require_mention": False,
            }
        )
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/report.pdf",
                    "name": "report.pdf",
                }
            ]
        )

        async def fake_prepare(content, raw_blob):
            self.assertEqual(raw_blob, blob)
            return adapter_mod.PreparedMedia(
                text_prefix="📎 [report.pdf] (application/pdf, 1KB)",
                media_urls=("/cache/report.pdf",),
                media_types=("application/pdf",),
                message_type="document",
            )

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            events = asyncio.run(
                self.dispatches(adapter, channel_event("hello", blob=blob))
            )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "📎 [report.pdf] (application/pdf, 1KB)\nhello")
        self.assertEqual(events[0].media_urls, ["/cache/report.pdf"])
        self.assertEqual(events[0].media_types, ["application/pdf"])
        self.assertEqual(events[0].message_type, MessageType.DOCUMENT)

    def test_mention_stripping_runs_before_blob_annotations(self):
        adapter = self.make_adapter({"allowed_users": ["~mug"]})
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/report.pdf",
                    "name": "report.pdf",
                }
            ]
        )

        async def fake_prepare(content, raw_blob):
            return adapter_mod.PreparedMedia(text_prefix="📎 [report.pdf]")

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            events = asyncio.run(
                self.dispatches(adapter, channel_event("~pen hello", blob=blob))
            )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "📎 [report.pdf]\nhello")

    def test_story_image_media_uses_photo_message_type(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~mug"],
                "require_mention": False,
            }
        )
        content = [
            {
                "block": {
                    "image": {
                        "src": "https://storage.example.com/diagram.png",
                        "alt": "diagram",
                    }
                }
            }
        ]

        async def fake_prepare(story_content, raw_blob):
            self.assertEqual(story_content, content)
            return adapter_mod.PreparedMedia(
                media_urls=("/cache/diagram.png",),
                media_types=("image/png",),
                message_type="photo",
            )

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            events = asyncio.run(
                self.dispatches(adapter, channel_event("", content=content))
            )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].message_type, MessageType.PHOTO)
        self.assertEqual(events[0].media_urls, ["/cache/diagram.png"])

    def test_blob_only_owner_listen_dispatches(self):
        adapter = self.make_adapter({"owner_ship": "~mug"})
        blob = json.dumps(
            [
                {
                    "type": "voicememo",
                    "version": 1,
                    "fileUri": "https://storage.example.com/memo.m4a",
                }
            ]
        )

        async def fake_prepare(content, raw_blob):
            return adapter_mod.PreparedMedia(
                text_prefix="🎙️ [voice memo] (?)",
                media_urls=("/cache/memo.m4a",),
                media_types=("audio/mp4",),
                message_type="voice",
            )

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            events = asyncio.run(
                self.dispatches(adapter, channel_event("", blob=blob))
            )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "🎙️ [voice memo] (?)")
        self.assertEqual(events[0].message_type, MessageType.VOICE)

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

            async def send_message(self, chat_id, text, *, blob=None):
                self.sends.append((chat_id, text))
                return await super().send_message(chat_id, text)

            async def send_reply(self, chat_id, post_id, text, *, parent_author=None, blob=None):
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

        async def record_reply(chat_id, post_id, text, *, parent_author=None, blob=None):
            recorded.append(post_id)
            return tlon_api.TlonSendResult(
                success=True, command=("tlon-test",), message_id="reply-id"
            )

        adapter._cli.send_reply = record_reply
        asyncio.run(adapter.send("chat/~pen/general", "reply", reply_to="170.141"))
        self.assertEqual(recorded, ["170.141"])

    def test_send_stamps_active_lens_run(self):
        adapter = self.make_adapter(
            {"allowed_users": ["~mug"], "context_lens": True, "context_lens_owner": "~zod"}
        )
        self.assertTrue(adapter._lens.enabled)
        # Simulate a started sync that verified %steward at startup.
        adapter._lens_sync._ready = True
        captured = {}

        async def record_message(chat_id, text, *, blob=None):
            captured["blob"] = blob
            return tlon_api.TlonSendResult(
                success=True, command=("tlon-test",), message_id="post-id"
            )

        adapter._cli = FakeCLI()
        adapter._cli.send_message = record_message
        adapter._lens.begin(
            "chat/~pen/general",
            adapter_mod.LensRun(
                lens_id="L42",
                message_id="m",
                chat_type="channel",
                trigger="mention",
                conversation_kind="channel",
            ),
        )
        asyncio.run(adapter.send("chat/~pen/general", "hi"))
        entry = json.loads(captured["blob"])[0]
        self.assertEqual(entry["type"], "tlon-context-lens")
        self.assertEqual(entry["lensId"], "L42")
        self.assertEqual(entry["botShip"], "~pen")

    def test_send_without_active_lens_run_omits_blob(self):
        adapter = self.make_adapter(
            {"allowed_users": ["~mug"], "context_lens": True, "context_lens_owner": "~zod"}
        )
        # Active sync, but no run began for this conversation → no stamp.
        adapter._lens_sync._ready = True
        captured = {"blob": "unset"}

        async def record_message(chat_id, text, *, blob=None):
            captured["blob"] = blob
            return tlon_api.TlonSendResult(
                success=True, command=("tlon-test",), message_id="post-id"
            )

        adapter._cli = FakeCLI()
        adapter._cli.send_message = record_message
        asyncio.run(adapter.send("chat/~pen/general", "hi"))
        self.assertIsNone(captured["blob"])

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

    def test_tlon_session_blocks_all_tools_without_owner_identity(self):
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~pen",
            },
            clear=True,
        ):
            block = adapter_mod.block_tlon_session_tool(
                "image_search",
                {"query": "moon"},
            )

        self.assertIsNotNone(block)
        self.assertEqual(block["action"], "block")
        self.assertIn("owner identity is not configured", block["message"])

    def test_tlon_session_blocks_skill_management(self):
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
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

    def test_non_owner_tlon_session_blocks_owner_only_tools(self):
        owner_only_tools = (
            "tlon",
            "cronjob",
            "read",
            "read_file",
            "write_file",
            "patch",
            "search_files",
            "mcp_tlon_mcp_search",
        )
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~mug",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
            for tool_name in owner_only_tools:
                with self.subTest(tool_name=tool_name):
                    block = adapter_mod.block_tlon_session_tool(tool_name, {})
                    self.assertIsNotNone(block)
                    self.assertEqual(block["action"], "block")
                    self.assertIn("owner-only", block["message"])

    def test_owner_tlon_session_allows_owner_only_tools(self):
        owner_only_tools = (
            "tlon",
            "cronjob",
            "read",
            "read_file",
            "write_file",
            "patch",
            "search_files",
            "mcp_tlon_mcp_search",
        )
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~pen",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
            for tool_name in owner_only_tools:
                with self.subTest(tool_name=tool_name):
                    block = adapter_mod.block_tlon_session_tool(tool_name, {})
                    self.assertIsNone(block)

    def test_tlon_session_blocks_owner_only_tool_without_sender_identity(self):
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
            block = adapter_mod.block_tlon_session_tool("cronjob", {})

        self.assertIsNotNone(block)
        self.assertEqual(block["action"], "block")
        self.assertIn("no Tlon sender identity", block["message"])

    def test_tlon_session_blocks_registry_mcp_tool_for_non_owner(self):
        fake_model_tools = types.ModuleType("model_tools")
        fake_model_tools.get_toolset_for_tool = (
            lambda tool_name: "mcp-urbit" if tool_name == "linear_create_issue" else None
        )

        with patch.dict(sys.modules, {"model_tools": fake_model_tools}):
            with patch.dict(
                os.environ,
                {
                    "HERMES_SESSION_PLATFORM": "tlon",
                    "HERMES_SESSION_USER_ID": "~mug",
                    "TLON_OWNER_SHIP": "~pen",
                },
                clear=True,
            ):
                block = adapter_mod.block_tlon_session_tool("linear_create_issue", {})

        self.assertIsNotNone(block)
        self.assertEqual(block["action"], "block")
        self.assertIn("owner-only", block["message"])


if __name__ == "__main__":
    unittest.main()
