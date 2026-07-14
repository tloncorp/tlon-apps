"""Outbound send() contract tests: chunking, retryable classification, and
fatal-auth handling — the pieces that must track BasePlatformAdapter's
conventions (truncate_message splitting, _send_with_retry semantics,
_set_fatal_error) rather than hand-rolled equivalents.
"""

import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_send_testpkg"

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
        self.fatal_errors = []

    def _mark_connected(self):
        self._running = True

    def _mark_disconnected(self):
        self._running = False

    def _set_fatal_error(self, code, message, *, retryable):
        self._running = False
        self.fatal_errors.append((code, message, retryable))

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


def cli_result(
    *, success=True, message_id="id", error=None, stderr="", returncode=0
):
    return tlon_api.TlonSendResult(
        success=success,
        command=("tlon",),
        stdout="",
        stderr=stderr,
        returncode=returncode,
        message_id=message_id,
        error=error,
    )


class FakeCLI:
    """Records outbound sends; pops queued results (last one repeats)."""

    def __init__(self, results=None):
        self.sent = []
        self.results = list(results or [])

    def _next(self):
        if len(self.results) > 1:
            return self.results.pop(0)
        return self.results[0] if self.results else cli_result()

    async def send_message(self, chat_id, content, *, blob=None, sent_at=None):
        self.sent.append(("message", chat_id, content, blob, sent_at))
        return self._next()

    async def send_reply(
        self, chat_id, parent, content, *, parent_author=None, blob=None, sent_at=None
    ):
        self.sent.append(("reply", chat_id, content, blob, sent_at))
        return self._next()


def make_adapter(results=None, extra=None):
    base = {
        "node_url": "https://pen.tlon.network",
        "node_id": "~pen",
        "access_code": "code",
        "channels": ["chat/~pen/general"],
        "owner_ship": "~mug",
    }
    base.update(extra or {})
    with patch.dict("os.environ", {}, clear=True):
        adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
    adapter._cli = FakeCLI(results=results)
    return adapter


class ChunkingTests(unittest.TestCase):
    def test_short_reply_single_send(self):
        adapter = make_adapter([cli_result(message_id="m1")])
        result = asyncio.run(adapter.send("~alice", "hello"))
        self.assertTrue(result.success)
        self.assertEqual(len(adapter._cli.sent), 1)
        self.assertEqual(result.message_id, "m1")
        self.assertEqual(result.continuation_message_ids, ())

    def test_long_reply_chunks_instead_of_truncating(self):
        adapter = make_adapter(
            [cli_result(message_id=f"m{i}") for i in range(1, 4)]
        )
        adapter.MAX_MESSAGE_LENGTH = 10
        content = "abcdefghijKLMNOPQRSTuvwxy"  # 25 chars -> 3 chunks of <=10
        result = asyncio.run(adapter.send("~alice", content))
        self.assertTrue(result.success)
        sent_chunks = [entry[2] for entry in adapter._cli.sent]
        self.assertEqual(len(sent_chunks), 3)
        # Nothing silently dropped: rejoined chunks reproduce the payload.
        self.assertEqual("".join(sent_chunks), content)
        # Core contract: message_id = LAST chunk, earlier ids ride along.
        self.assertEqual(result.message_id, "m3")
        self.assertEqual(result.continuation_message_ids, ("m1", "m2"))

    def test_multi_chunk_lens_outputs_carry_chunk_index(self):
        # Outputs are recorded only when a chunk is stamped with its lens
        # reference, so run with the lens active and a live run in place.
        adapter = make_adapter(
            [cli_result(message_id=f"m{i}") for i in range(1, 3)],
            extra={"context_lens": True},
        )
        adapter._lens._sync._ready = True  # steward verified at startup
        adapter.MAX_MESSAGE_LENGTH = 10
        run = lens.LensRun(
            lens_id="L1",
            message_id="m1",
            chat_type="dm",
            trigger="dm",
            conversation_kind="dm",
            conversation_id="~alice",
            author_ship="~alice",
        )
        adapter._lens._runs["~alice"] = run
        recorded = []
        adapter._lens.record_output = lambda chat_id, output: recorded.append(output)
        asyncio.run(adapter.send("~alice", "a" * 15))
        self.assertEqual([o.chunk_index for o in recorded], [0, 1])
        # Every chunk is its own post: each carries the run's lens-ref blob
        # and its own --sent-at (the output id derives from it).
        blobs = [entry[3] for entry in adapter._cli.sent]
        sent_ats = [entry[4] for entry in adapter._cli.sent]
        self.assertTrue(all(b and "tlon-context-lens" in b for b in blobs))
        self.assertTrue(all(t is not None for t in sent_ats))
        self.assertEqual([o.sent_at for o in recorded], sent_ats)

    def test_caller_blob_rides_first_chunk_while_lens_rides_every_chunk(self):
        adapter = make_adapter(
            [cli_result(message_id=f"m{i}") for i in range(1, 3)],
            extra={"context_lens": True},
        )
        adapter._lens._sync._ready = True
        adapter.MAX_MESSAGE_LENGTH = 10
        adapter._lens._runs["~alice"] = lens.LensRun(
            lens_id="L1",
            message_id="m1",
            chat_type="dm",
            trigger="dm",
            conversation_kind="dm",
            conversation_id="~alice",
            author_ship="~alice",
        )
        caller_blob = json.dumps(
            [{"type": "a2ui", "version": 1, "messages": []}]
        )

        with patch.object(adapter_mod.time, "time", return_value=1_700_000_000.0):
            result = asyncio.run(
                adapter.send(
                    "~alice",
                    "a" * 15,
                    metadata={"blob": caller_blob},
                )
            )

        self.assertTrue(result.success)
        blob_entries = [json.loads(entry[3]) for entry in adapter._cli.sent]
        self.assertEqual(
            [entry["type"] for entry in blob_entries[0]],
            ["a2ui", "tlon-context-lens"],
        )
        self.assertEqual(
            [entry["type"] for entry in blob_entries[1]],
            ["tlon-context-lens"],
        )
        sent_ats = [entry[4] for entry in adapter._cli.sent]
        self.assertLess(sent_ats[0], sent_ats[1])

    def test_partial_chunk_failure_reports_delivered_prefix(self):
        # Second chunk fails after the first landed: report success so the
        # core does not resend (and duplicate) the whole payload, but surface
        # the dropped tail on the live lens run.
        adapter = make_adapter(
            [
                cli_result(message_id="m1"),
                cli_result(success=False, message_id=None, error="boom", returncode=1),
            ]
        )
        adapter.MAX_MESSAGE_LENGTH = 10
        run = lens.LensRun(
            lens_id="L1",
            message_id="m1",
            chat_type="dm",
            trigger="dm",
            conversation_kind="dm",
            conversation_id="~alice",
            author_ship="~alice",
        )
        adapter._lens._runs["~alice"] = run
        result = asyncio.run(adapter.send("~alice", "a" * 15))
        self.assertTrue(result.success)
        self.assertEqual(result.message_id, "m1")
        self.assertFalse(result.retryable)
        self.assertIn("partial delivery: 1/2", run.error or "")

    def test_send_prefers_core_truncate_message(self):
        # When the real BasePlatformAdapter provides truncate_message, the
        # adapter must use it (code-block-aware splitting) instead of the
        # plain fallback split.
        adapter = make_adapter(
            [cli_result(message_id=f"m{i}") for i in range(1, 3)]
        )
        adapter.MAX_MESSAGE_LENGTH = 10
        seen = {}

        def fake_truncate(content, max_length):
            seen["args"] = (content, max_length)
            return ["first-part", "second-part"]

        adapter.truncate_message = fake_truncate
        result = asyncio.run(adapter.send("~alice", "a" * 15))
        self.assertTrue(result.success)
        self.assertEqual(seen["args"], ("a" * 15, 10))
        self.assertEqual(
            [entry[2] for entry in adapter._cli.sent],
            ["first-part", "second-part"],
        )

    def test_first_chunk_failure_is_plain_failure(self):
        adapter = make_adapter(
            [cli_result(success=False, message_id=None, error="boom", returncode=1)]
        )
        result = asyncio.run(adapter.send("~alice", "hello"))
        self.assertFalse(result.success)
        self.assertEqual(result.error, "boom")


class RetryableClassificationTests(unittest.TestCase):
    def test_cli_timeout_not_retryable(self):
        # rc 124 = the CLI was killed on timeout; the poke may have landed,
        # so core retrying it would risk a duplicate post.
        adapter = make_adapter(
            [
                cli_result(
                    success=False, message_id=None, error="timed out", returncode=124
                )
            ]
        )
        result = asyncio.run(adapter.send("~alice", "hello"))
        self.assertFalse(result.success)
        self.assertFalse(result.retryable)

    def test_transient_network_error_retryable(self):
        adapter = make_adapter(
            [
                cli_result(
                    success=False,
                    message_id=None,
                    error="fetch failed",
                    stderr="Error: connect ECONNREFUSED 127.0.0.1:443",
                    returncode=1,
                )
            ]
        )
        result = asyncio.run(adapter.send("~alice", "hello"))
        self.assertFalse(result.success)
        self.assertTrue(result.retryable)

    def test_permanent_error_not_retryable(self):
        adapter = make_adapter(
            [
                cli_result(
                    success=False,
                    message_id=None,
                    error="unknown channel nest",
                    returncode=1,
                )
            ]
        )
        result = asyncio.run(adapter.send("~alice", "hello"))
        self.assertFalse(result.retryable)


class FatalAuthTests(unittest.TestCase):
    def test_auth_rejection_marks_fatal_and_stops_stream(self):
        adapter = make_adapter()

        async def bad_connect():
            raise tlon_api.TlonAuthError("Tlon auth rejected: HTTP 400")

        adapter._connect_sse = bad_connect
        adapter._sse = None
        asyncio.run(adapter._run_stream())
        self.assertEqual(len(adapter.fatal_errors), 1)
        code, message, retryable = adapter.fatal_errors[0]
        self.assertEqual(code, "auth")
        self.assertIn("HTTP 400", message)
        self.assertFalse(retryable)

    def test_transient_stream_error_does_not_mark_fatal(self):
        adapter = make_adapter()
        calls = {"n": 0}

        async def flaky_connect():
            calls["n"] += 1
            if calls["n"] == 1:
                raise ConnectionError("ship unreachable")
            adapter._running = False
            raise ConnectionError("stop")

        adapter._connect_sse = flaky_connect
        adapter._sse = None

        async def instant_sleep(_delay):
            return None

        with patch.object(adapter_mod.asyncio, "sleep", instant_sleep):
            asyncio.run(adapter._run_stream())
        self.assertEqual(adapter.fatal_errors, [])


if __name__ == "__main__":
    unittest.main()
