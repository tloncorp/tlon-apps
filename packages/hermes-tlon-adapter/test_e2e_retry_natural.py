"""E2E retry test with naturally-retryable failure modes.

Validates that the retry path works correctly for failures that produce
status="error" without any manual patching.

Two failure modes under test:
  1. Warm-retry: a network/exception failure (ProcessingOutcome.FAILURE,
     no delivery) → status="error" → retry resolves from in-memory cache.
  2. Cold-retry: same failure, then adapter restart → retry resolves from
     durable JSONL store.

Auth errors (bad API key) land as status="completed" today: the Hermes
gateway catches the credential failure and delivers "⚠️ Provider
authentication failed…" as a normal message (delivery succeeded → outcome
SUCCESS → completed → not retryable). The adapter's _lens_final_status()
mapping is correct for the signals it receives; the classification fix
belongs gateway-side (mark the run failed instead of delivered), tracked
as NousResearch/hermes-agent#57899.
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_e2e_retry_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


# ── Minimal gateway stubs ────────────────────────────────────────────────────

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
        self, *, success, message_id=None, error=None, raw_response=None, retryable=False,
        continuation_message_ids=()
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


class ProcessingOutcome:
    """Mirrors gateway.platforms.base.ProcessingOutcome (enum values as strings)."""
    SUCCESS = types.SimpleNamespace(value="success")
    FAILURE = types.SimpleNamespace(value="failure")
    CANCELLED = types.SimpleNamespace(value="cancelled")


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
gateway_base.ProcessingOutcome = ProcessingOutcome
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
lens_mod = load_module("lens")
adapter_mod = load_module("adapter")


# ── Helpers ──────────────────────────────────────────────────────────────────

class FakeSSE:
    def __init__(self, payloads=None):
        self.payloads = payloads or {}
        self.scries = []

    async def scry(self, path):
        self.scries.append(path)
        if path in self.payloads:
            return self.payloads[path]
        raise ConnectionError(f"no payload for {path}")


def make_adapter(store_path, extra=None, payloads=None):
    from unittest.mock import patch
    base = {
        "node_url": "https://pen.tlon.network",
        "node_id": "~pen",
        "access_code": "code",
        "channels": ["chat/~pen/general"],
        "owner_ship": "~mug",
        "context_lens_enabled": True,
        "context_lens_store_path": store_path,
    }
    base.update(extra or {})
    with patch.dict("os.environ", {}, clear=True):
        adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
    adapter._sse = FakeSSE(payloads=payloads)
    adapter._settings_loaded = True
    # Simulate a started lens sync that verified %steward at startup, so the
    # begin/stamp path is active (see TlonLensSync.start()).
    adapter._lens_sync._ready = True
    return adapter


def make_message_event(adapter, *, text="hello bot", ship="~alice", chat_id="~alice"):
    source = adapter.build_source(
        chat_id=chat_id,
        chat_name=chat_id,
        chat_type="dm",
        user_id=ship,
        user_name=ship,
        thread_id=None,
        message_id="m1",
    )
    return MessageEvent(
        text=text,
        message_type=MessageType.TEXT,
        source=source,
        raw_message={},
        message_id="m1",
        reply_to_message_id=None,
        timestamp=None,
    )


def simulate_failed_run(adapter, *, conversation_id="~alice", text="hello bot"):
    """
    Simulate the gateway lifecycle for a run that fails with a network error:

      on_processing_start → (handler raises) → on_processing_complete(FAILURE)

    No delivery happens (the exception escapes before send), so delivered=False.
    _lens_final_status("failure", delivered=False) → "error"

    This mirrors what base.py does at line 4399:
        except Exception as e:
            await self._run_processing_hook(
                "on_processing_complete", event, ProcessingOutcome.FAILURE
            )
    """
    event = make_message_event(adapter, chat_id=conversation_id)

    async def run():
        # on_processing_start triggers _begin_lens_run via the adapter hook;
        # we replicate what the adapter does: begin the lens run first.
        msg = tlon_api.TlonIncomingMessage(
            message_id="m1",
            chat_id=conversation_id,
            chat_type="dm",
            chat_name=conversation_id,
            user_id="~alice",
            user_name="~alice",
            text=text,
            sent_at=None,
            reply_to_message_id=None,
            raw={},
        )
        await adapter._begin_lens_run(msg, is_dm=True, dispatch_reason="dm")

        # Simulate the exception-path in _process_message_background (base.py:4399)
        # No delivery → on_processing_complete(FAILURE)
        await adapter.on_processing_complete(event, ProcessingOutcome.FAILURE)

    asyncio.run(run())


def handle_retry(adapter, lens_id):
    """Send a retry-requested fact and collect dispatched events."""
    events = []

    async def record(event):
        events.append(event)

    adapter.handle_message = record
    asyncio.run(adapter._handle_steward_event(
        {"retry-requested": {"id": lens_id, "requester": "~mug"}}
    ))
    return events


# ── Tests ────────────────────────────────────────────────────────────────────

class NaturalRetryableFailureTests(unittest.TestCase):
    """Verify the retry path for failures that naturally produce status='error'."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.store_path = str(Path(tmp.name) / "context-lens-runs.jsonl")

    # ── Status classification ─────────────────────────────────────────────

    def test_network_failure_produces_error_status(self):
        """A ProcessingOutcome.FAILURE with no delivery → status='error'."""
        adapter = make_adapter(self.store_path)
        simulate_failed_run(adapter, conversation_id="~alice")

        # The run is finalized (moved to recent) — find it by conversation
        # by checking the JSONL store (it was saved there).
        store = adapter._lens._store
        self.assertIsNotNone(store, "lens store must be configured")

        # Find the run in the store
        stored_runs = list(store._runs.values())
        self.assertEqual(len(stored_runs), 1, "exactly one run should be stored")
        run = stored_runs[0]
        self.assertEqual(
            run["status"],
            "error",
            f"network failure should produce status='error', got '{run['status']}'"
        )

    def test_delivered_message_produces_completed_status(self):
        """A run that delivers a reply → status='completed' (not retryable).

        This also covers the auth-error case: Hermes delivers '⚠️ Provider
        authentication failed…' as a normal message, so delivery_succeeded=True
        and the run is classified as completed. Auth errors are only retryable
        if the gateway is patched to NOT deliver them as user-visible messages.
        """
        adapter = make_adapter(self.store_path)
        event = make_message_event(adapter, chat_id="~alice")

        async def run():
            msg = tlon_api.TlonIncomingMessage(
                message_id="m1",
                chat_id="~alice",
                chat_type="dm",
                chat_name="~alice",
                user_id="~alice",
                user_name="~alice",
                text="hello",
                sent_at=None,
                reply_to_message_id=None,
                raw={},
            )
            await adapter._begin_lens_run(msg, is_dm=True, dispatch_reason="dm")

            # Simulate a delivered output (e.g. auth error message was sent)
            run_obj = adapter._lens.get("~alice")
            self.assertIsNotNone(run_obj)
            run_obj.record_output(lens_mod.LensOutput(
                message_id="reply1",
                conversation_id="~alice",
                kind="dm",
                sent_at=0,
                preview="⚠️ Provider authentication failed",
            ))
            run_obj.delivered_message_count += 1

            await adapter.on_processing_complete(event, ProcessingOutcome.SUCCESS)

        asyncio.run(run())

        store = adapter._lens._store
        stored_runs = list(store._runs.values())
        self.assertEqual(len(stored_runs), 1)
        self.assertEqual(
            stored_runs[0]["status"],
            "completed",
            "delivered run (including auth-error message) must be 'completed'"
        )

    # ── Warm-retry (in-memory cache) ──────────────────────────────────────

    def test_warm_retry_resolves_from_memory(self):
        """Retry from in-memory recent cache after a natural network failure."""
        adapter = make_adapter(self.store_path)
        simulate_failed_run(
            adapter,
            conversation_id="~alice",
            text="retry this after network error",
        )

        # Verify the run is in the recent cache (not just on disk)
        recent = adapter._lens._recent
        self.assertTrue(len(recent) > 0, "recent cache should have at least one run")
        lens_ids = list(recent.keys())
        lens_id = lens_ids[0]
        cached_run = recent[lens_id]
        self.assertEqual(cached_run["status"], "error")

        # Now trigger a retry
        events = handle_retry(adapter, lens_id)

        self.assertEqual(len(events), 1, "retry should produce exactly one dispatched event")
        # The reaction envelope (default level=minimal) rides the retried
        # dispatch as a deterministic suffix; assert the exact dispatched text.
        self.assertEqual(
            events[0].text,
            "retry this after network error\n\n[message id: m1]",
            "retry event should carry the original message text",
        )

        # The new run should be a retry (trigger="retry", retry_of=original_id)
        new_run = adapter._lens.get("~alice")
        self.assertIsNotNone(new_run)
        self.assertEqual(new_run.trigger, "retry")
        self.assertEqual(new_run.retry_of, lens_id)

        # Warm retry must NOT touch steward (gateway-local lookup only)
        self.assertFalse(
            [p for p in adapter._sse.scries if "/steward/" in p],
            "warm retry must resolve from memory, not steward scry"
        )

    def test_warm_retry_error_status_is_retryable(self):
        """Confirm that 'error' status (not 'completed') allows retry."""
        adapter = make_adapter(self.store_path)
        simulate_failed_run(adapter, conversation_id="~alice")

        lens_id = list(adapter._lens._recent.keys())[0]
        events = handle_retry(adapter, lens_id)
        self.assertEqual(len(events), 1, "error status must be retryable")

    def test_warm_retry_completed_status_is_blocked(self):
        """Confirm that 'completed' status (delivered run) blocks retry."""
        from unittest.mock import patch
        adapter = make_adapter(self.store_path)

        # Seed a completed run directly
        run = lens_mod.LensRun(
            lens_id="LX-completed",
            message_id="m1",
            chat_type="dm",
            trigger="dm",
            conversation_kind="dm",
            conversation_id="~alice",
            author_ship="~alice",
            retry_seed={"messageText": "should not retry"},
        )
        run.set_status("completed")
        adapter._lens.begin("~alice", run)
        asyncio.run(adapter._lens.finish("~alice", status="completed"))

        events = handle_retry(adapter, "LX-completed")
        self.assertEqual(events, [], "completed run must NOT be retried")

    # ── Cold-retry (durable store after restart) ──────────────────────────

    def test_cold_retry_resolves_from_disk(self):
        """Retry after adapter restart — in-memory cache empty, disk store used."""
        # First adapter: receive message, fail with network error, finalize run.
        first_adapter = make_adapter(self.store_path)
        simulate_failed_run(
            first_adapter,
            conversation_id="~alice",
            text="retry this from disk",
        )

        # Confirm run was persisted to disk
        lens_id = list(first_adapter._lens._recent.keys())[0]
        self.assertTrue(Path(self.store_path).exists(), "JSONL store should exist on disk")

        # Second adapter: simulates process restart (empty memory, same store path).
        second_adapter = make_adapter(self.store_path)
        self.assertIsNone(
            second_adapter._lens.get("~alice"),
            "fresh adapter should have no in-memory run"
        )
        self.assertEqual(
            len(second_adapter._lens._recent),
            0,
            "fresh adapter should have empty recent cache"
        )

        # Retry must succeed via disk lookup
        events = handle_retry(second_adapter, lens_id)

        self.assertEqual(len(events), 1, "cold retry should produce one dispatched event")
        # The reaction envelope (default level=minimal) rides the retried
        # dispatch as a deterministic suffix; assert the exact dispatched text.
        self.assertEqual(events[0].text, "retry this from disk\n\n[message id: m1]")

        # Cold retry must NOT touch steward either
        self.assertFalse(
            [p for p in second_adapter._sse.scries if "/steward/" in p],
            "cold retry must resolve from disk store, not steward scry"
        )

    def test_cold_retry_unknown_id_refuses(self):
        """Cold retry for an unknown lens_id is safely refused."""
        adapter = make_adapter(self.store_path)
        events = handle_retry(adapter, "NO-SUCH-ID")
        self.assertEqual(events, [], "unknown lens id must be refused")

    def test_cold_retry_preserves_original_message_text(self):
        """The retried event carries the exact original text, not a truncated preview."""
        long_text = "A" * 500 + " — retry me exactly"

        first_adapter = make_adapter(self.store_path)
        simulate_failed_run(
            first_adapter,
            conversation_id="~alice",
            text=long_text,
        )
        lens_id = list(first_adapter._lens._recent.keys())[0]

        second_adapter = make_adapter(self.store_path)
        events = handle_retry(second_adapter, lens_id)

        self.assertEqual(len(events), 1)
        # The full original text must survive retry untruncated; the reaction
        # envelope (default level=minimal) rides after it as a deterministic suffix.
        self.assertEqual(events[0].text, long_text + "\n\n[message id: m1]")

    # ── Auth error classification (documented limitation) ─────────────────

    def test_auth_error_via_delivered_message_is_completed(self):
        """
        Documents the current auth-error classification behavior:

        When Hermes delivers '⚠️ Provider authentication failed…' as a normal
        message (the common path for bad API keys), the run is classified as
        'completed' — NOT retryable.

        This is CORRECT ADAPTER BEHAVIOR given the signals the adapter receives
        today. The fix to make auth errors retryable belongs in the Hermes
        gateway (run.py ~line 17407): instead of returning the error as
        final_response (which delivers it → completed), return a sentinel that
        causes ProcessingOutcome.FAILURE to be passed to on_processing_complete
        without any delivery.

        See the module docstring for the bug location.
        """
        adapter = make_adapter(self.store_path)
        event = make_message_event(adapter, chat_id="~alice")

        async def run():
            msg = tlon_api.TlonIncomingMessage(
                message_id="m1",
                chat_id="~alice",
                chat_type="dm",
                chat_name="~alice",
                user_id="~alice",
                user_name="~alice",
                text="hello",
                sent_at=None,
                reply_to_message_id=None,
                raw={},
            )
            await adapter._begin_lens_run(msg, is_dm=True, dispatch_reason="dm")
            run_obj = adapter._lens.get("~alice")
            # Auth error message was delivered
            run_obj.record_output(lens_mod.LensOutput(
                message_id="err-reply",
                conversation_id="~alice",
                kind="dm",
                sent_at=0,
                preview="⚠️ Provider authentication failed. Check the configured credentials.",
            ))
            run_obj.delivered_message_count += 1
            # Gateway calls on_processing_complete(SUCCESS) because delivery succeeded
            await adapter.on_processing_complete(event, ProcessingOutcome.SUCCESS)

        asyncio.run(run())

        store = adapter._lens._store
        stored_runs = list(store._runs.values())
        lens_id = stored_runs[0]["lensId"]

        # Auth-error run is completed → retry is refused
        events = handle_retry(adapter, lens_id)
        self.assertEqual(
            events,
            [],
            "auth error delivered as message produces status='completed' (not retryable) "
            "— this is the documented limitation; fix belongs in the gateway, not adapter"
        )

    def test_auth_error_with_no_delivery_would_be_retryable(self):
        """
        If the gateway were fixed to NOT deliver auth errors as user messages
        (i.e., raise an exception → ProcessingOutcome.FAILURE), the run would
        correctly land in status='error' and become retryable.

        This test validates the DESIRED end state after the gateway fix.
        """
        adapter = make_adapter(self.store_path)
        # Simulate: auth exception raised, escapes handler, no delivery
        simulate_failed_run(
            adapter,
            conversation_id="~alice",
            text="hello with bad key",
        )

        store = adapter._lens._store
        stored_runs = list(store._runs.values())
        self.assertEqual(stored_runs[0]["status"], "error")

        lens_id = stored_runs[0]["lensId"]
        events = handle_retry(adapter, lens_id)
        self.assertEqual(
            len(events),
            1,
            "if auth failure propagates as exception (no delivery), run is retryable"
        )


if __name__ == "__main__":
    unittest.main()
