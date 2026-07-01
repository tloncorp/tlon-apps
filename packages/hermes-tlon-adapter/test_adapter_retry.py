import asyncio
import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = __import__("pathlib").Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_retry_testpkg"

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
        self, *, success, message_id=None, error=None, raw_response=None, retryable=False
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
lens = load_module("lens")
adapter_mod = load_module("adapter")


class FakeSSE:
    def __init__(self, payloads=None):
        self.payloads = payloads or {}
        self.scries = []

    async def scry(self, path):
        self.scries.append(path)
        if path in self.payloads:
            return self.payloads[path]
        raise ConnectionError(f"no payload for {path}")


def retryable_lens(
    *,
    lens_id="LX",
    status="error",
    conversation_kind="dm",
    author="~alice",
    conversation_id="~alice",
    seed=None,
):
    run = lens.LensRun(
        lens_id=lens_id,
        message_id="m1",
        chat_type=conversation_kind,
        trigger="dm",
        conversation_kind=conversation_kind,
        conversation_id=conversation_id,
        author_ship=author,
        retry_seed=seed if seed is not None else {"messageText": "please retry"},
    )
    run.set_status(status)
    return run


class RetryHandlerTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.store_path = str(Path(tmp.name) / "context-lens-runs.jsonl")

    def make_adapter(self, extra=None, payloads=None):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "owner_ship": "~mug",
            "context_lens_enabled": True,
            "context_lens_store_path": self.store_path,
        }
        base.update(extra or {})
        with patch.dict("os.environ", {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
        adapter._sse = FakeSSE(payloads=payloads)
        adapter._settings_loaded = True
        # Simulate a started lens sync that verified %steward at startup, so
        # begin/stamp are active (production receives retry facts only when
        # %steward is present, i.e. the startup probe passed).
        adapter._lens_sync._ready = True
        return adapter

    def handle(self, adapter, fact):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        asyncio.run(adapter._handle_steward_event(fact))
        return events

    def seed_recent(self, adapter, run):
        adapter._lens.begin(run.conversation_id, run)
        asyncio.run(adapter._lens.finish(run.conversation_id, status=run.status))

    # ── happy path ───────────────────────────────────────────────────────

    def test_owner_retry_redispatches_from_recent(self):
        adapter = self.make_adapter()
        self.assertTrue(adapter._lens.enabled)
        self.seed_recent(adapter, retryable_lens())

        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "please retry")
        # A fresh lens run began for the retry, tagged with the original id.
        new_run = adapter._lens.get("~alice")
        self.assertEqual(new_run.trigger, "retry")
        self.assertEqual(new_run.retry_of, "LX")
        # No steward scry involved — lens retry lookups are gateway-local.
        self.assertFalse([p for p in adapter._sse.scries if "/steward/" in p])

    def test_retry_bypasses_authorization_for_unauthorized_sender(self):
        # ~alice is not the owner and not on any allowlist, so a *fresh* DM from
        # ~alice would be denied; the owner-requested retry runs anyway.
        adapter = self.make_adapter()
        self.assertFalse(adapter._user_authorized("~alice", is_dm=True))
        self.seed_recent(adapter, retryable_lens())

        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(len(events), 1)

    def test_retry_falls_back_to_store_after_restart(self):
        # Finalize a run (persisting it to the durable store), then simulate a
        # restart with a fresh adapter on the same store path: the in-memory
        # recent cache is empty, so the retry must resolve from disk. With a
        # remote owner the bot ship's steward stores nothing, so this local
        # store is the only durable retry source.
        first = self.make_adapter()
        self.seed_recent(first, retryable_lens())
        adapter = self.make_adapter()
        self.assertIsNone(adapter._lens.get("~alice"))

        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "please retry")
        self.assertFalse([p for p in adapter._sse.scries if "/steward/" in p])

    def test_retry_honors_lens_owner_distinct_from_owner_ship(self):
        # Steward keys runs (and %retry-requested) to the lens owner, which can
        # be TLON_CONTEXT_LENS_OWNER != the adapter owner_ship. The lens owner's
        # retry is honored; the plain adapter owner's is refused.
        adapter = self.make_adapter(extra={"context_lens_owner": "~zod"})
        self.assertEqual(adapter._lens.owner, "~zod")
        self.seed_recent(adapter, retryable_lens())

        ignored = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(ignored, [])

        honored = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~zod"}}
        )
        self.assertEqual(len(honored), 1)

    def test_reply_parent_id_overrides_delivery_parent(self):
        # A seed carrying replyParentId (delivery-only override in TS) drives the
        # reconstructed reply target: deliverParentId = replyParentId ?? parentId.
        adapter = self.make_adapter()
        run = retryable_lens(
            seed={
                "messageText": "please retry",
                "parentId": "P1",
                "isThreadReply": True,
                "replyParentId": "RP1",
            }
        )
        self.seed_recent(adapter, run)

        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].reply_to_message_id, "RP1")

    # ── refusals ─────────────────────────────────────────────────────────

    def test_non_owner_requester_ignored(self):
        adapter = self.make_adapter()
        self.seed_recent(adapter, retryable_lens())
        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~ten"}}
        )
        self.assertEqual(events, [])

    def test_entry_echo_ignored(self):
        adapter = self.make_adapter()
        self.seed_recent(adapter, retryable_lens())
        events = self.handle(adapter, {"entry": {"id": "LX", "payload": {}}})
        self.assertEqual(events, [])

    def test_completed_run_not_retried(self):
        adapter = self.make_adapter()
        self.seed_recent(adapter, retryable_lens(status="completed"))
        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(events, [])

    def test_unknown_run_refused(self):
        adapter = self.make_adapter()  # nothing seeded in memory or on disk
        events = self.handle(
            adapter, {"retry-requested": {"id": "MISSING", "requester": "~mug"}}
        )
        self.assertEqual(events, [])

    def test_blocked_sender_refused(self):
        adapter = self.make_adapter(payloads={"/chat/blocked": ["~alice"]})
        self.seed_recent(adapter, retryable_lens())
        events = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(events, [])

    # ── dedup ────────────────────────────────────────────────────────────

    def test_duplicate_retry_within_window_is_noop(self):
        adapter = self.make_adapter()
        self.seed_recent(adapter, retryable_lens())
        fact = {"retry-requested": {"id": "LX", "requester": "~mug"}}

        first = self.handle(adapter, fact)
        second = self.handle(adapter, fact)
        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])

    def test_refused_retry_releases_dedup_slot(self):
        # A refused retry (unknown run) must not poison the dedup map: once the
        # run becomes available, a later request for the same id can proceed.
        adapter = self.make_adapter()
        first = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(first, [])
        self.seed_recent(adapter, retryable_lens())
        second = self.handle(
            adapter, {"retry-requested": {"id": "LX", "requester": "~mug"}}
        )
        self.assertEqual(len(second), 1)


if __name__ == "__main__":
    unittest.main()
