import asyncio
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_notebooks_testpkg"

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
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class SendResult:
    def __init__(self, *, success, message_id=None, error=None, raw_response=None, retryable=False, continuation_message_ids=()):
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


load_module("tlon_api")
load_module("attention")
load_module("mention")
load_module("presence")
load_module("tlon_tool")
adapter_mod = load_module("adapter")


INIT_DATA = {
    "groups": {
        "~pen/gardening": {
            "channels": {
                "chat/~pen/general": {"meta": {"title": "General"}},
                "diary/~pen/journal": {"meta": {"title": "Journal"}},
                "notes/~pen/plans": {"meta": {"title": "Plans"}},
                "notes/~pen/specs": {"meta": {"title": "  Specs  "}},
            },
        },
        "~nec/reading": {
            "channels": {
                "chat/~nec/lounge": {"meta": {"title": "Lounge"}},
                "notes/~nec/library": {},
            },
        },
        "~bad/group": "not-a-dict",
    },
}


class FakeSSE:
    def __init__(self, init_data=INIT_DATA):
        self.init_data = init_data
        self.scry_paths = []

    async def scry(self, path):
        self.scry_paths.append(path)
        return self.init_data


def make_adapter(extra=None):
    base = {
        "node_url": "https://pen.tlon.network",
        "node_id": "~pen",
        "access_code": "code",
        "channels": ["chat/~pen/general"],
        "context_messages": 0,
        "reaction_level": "off",
    }
    base.update(extra or {})
    with patch.dict(os.environ, {}, clear=True):
        return adapter_mod.TlonAdapter(PlatformConfig(extra=base))


def group_message(nest="chat/~pen/general"):
    return types.SimpleNamespace(
        chat_id=nest, reply_to_message_id=None, message_id="170.141"
    )


class RefreshGroupDirectoryTests(unittest.TestCase):
    def test_collects_notebooks_and_channel_groups(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        asyncio.run(adapter._refresh_group_directory())

        self.assertEqual(
            adapter._group_notebooks,
            {
                "~pen/gardening": {
                    "notes/~pen/plans": "Plans",
                    "notes/~pen/specs": "Specs",
                },
                "~nec/reading": {"notes/~nec/library": ""},
            },
        )
        self.assertEqual(adapter._channel_group["chat/~pen/general"], "~pen/gardening")
        self.assertEqual(adapter._channel_group["notes/~nec/library"], "~nec/reading")
        # diary stays a message channel, but is still mapped to its group
        self.assertEqual(adapter._channel_group["diary/~pen/journal"], "~pen/gardening")

    def test_notebooks_never_join_monitored_channels(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        asyncio.run(adapter._refresh_group_directory())
        self.assertFalse(
            any(nest.startswith("notes/") for nest in adapter._monitored_channels)
        )

    def test_scry_failure_preserves_existing_directory(self):
        adapter = make_adapter()
        adapter._group_notebooks = {"~pen/gardening": {"notes/~pen/plans": "Plans"}}
        adapter._channel_group = {"chat/~pen/general": "~pen/gardening"}

        class FailingSSE:
            async def scry(self, path):
                raise RuntimeError("scry failed")

        adapter._sse = FailingSSE()
        asyncio.run(adapter._refresh_group_directory())
        self.assertEqual(
            adapter._group_notebooks, {"~pen/gardening": {"notes/~pen/plans": "Plans"}}
        )

class NotebookHintTests(unittest.TestCase):
    def seeded_adapter(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        asyncio.run(adapter._refresh_group_directory())
        return adapter

    def test_hint_lists_only_current_groups_notebooks(self):
        adapter = self.seeded_adapter()
        hint = adapter._group_notebook_hint("chat/~pen/general")
        self.assertIn('"Plans" (notes/~pen/plans)', hint)
        self.assertIn('"Specs" (notes/~pen/specs)', hint)
        self.assertNotIn("notes/~nec/library", hint)
        self.assertIn("tlon tool", hint)

    def test_untitled_notebook_falls_back_to_nest(self):
        adapter = self.seeded_adapter()
        hint = adapter._group_notebook_hint("chat/~nec/lounge")
        self.assertIn("notes/~nec/library", hint)
        self.assertNotIn('""', hint)

    def test_no_hint_for_unknown_channel_or_bare_group(self):
        adapter = self.seeded_adapter()
        self.assertEqual(adapter._group_notebook_hint("chat/~zod/elsewhere"), "")
        adapter._channel_group["chat/~zod/elsewhere"] = "~zod/empty"
        self.assertEqual(adapter._group_notebook_hint("chat/~zod/elsewhere"), "")

    def test_with_group_context_appends_hint(self):
        adapter = self.seeded_adapter()
        result = asyncio.run(
            adapter._with_group_context(group_message(), "hello there", "mention")
        )
        self.assertTrue(result.startswith("hello there"))
        self.assertIn("[This group has notebooks:", result)

    def test_with_group_context_without_notebooks_is_unchanged(self):
        adapter = self.seeded_adapter()
        adapter._group_notebooks = {}
        result = asyncio.run(
            adapter._with_group_context(group_message(), "hello there", "mention")
        )
        self.assertEqual(result, "hello there")

    def test_hint_reads_only_the_cache_and_never_scries(self):
        # The dispatch path must never wait on a ship scry for the hint — a
        # hung scry here would block the reply turn.
        adapter = self.seeded_adapter()
        sse = adapter._sse
        before = len(sse.scry_paths)
        asyncio.run(
            adapter._with_group_context(group_message(), "hello there", "mention")
        )
        self.assertEqual(len(sse.scry_paths), before)


if __name__ == "__main__":
    unittest.main()
