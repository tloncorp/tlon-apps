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
from datetime import datetime, timezone
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
        self.commands = []
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

    async def run_command(self, args):
        self.commands.append(tuple(args))
        return cli_result()


class FakeSSE:
    def __init__(self, *, poke_error=None):
        self.pokes = []
        self.poke_error = poke_error

    async def poke(self, app, mark, payload):
        if self.poke_error is not None:
            raise self.poke_error
        self.pokes.append((app, mark, payload))
        return 1

    async def close(self, *, graceful=True):
        del graceful
        return None


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


def incoming(chat_id, sender, message_id, *, text="hello", chat_type="dm"):
    return tlon_api.TlonIncomingMessage(
        chat_id=chat_id,
        chat_name=chat_id,
        chat_type=chat_type,
        user_id=sender,
        user_name=sender,
        text=text,
        message_id=message_id,
        reply_to_message_id=None,
        sent_at=datetime.now(tz=timezone.utc),
        raw={},
    )


def dm_event(text, *, author="~attacker", whom="~attacker", message_id="dm-1"):
    return {
        "whom": whom,
        "id": message_id,
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


def dispatch(adapter, chat_id, sender, message_id, *, is_dm=True):
    events = []

    async def record(event):
        events.append(event)

    adapter.handle_message = record
    asyncio.run(
        adapter._dispatch_message(
            incoming(
                chat_id,
                sender,
                message_id,
                chat_type="dm" if is_dm else "group",
            ),
            is_dm=is_dm,
            mark_seen=False,
            skip_authorization=True,
        )
    )
    return events[0]


class ChunkingTests(unittest.TestCase):
    def test_declares_native_long_message_splitting(self):
        # DeliveryRouter checks this capability before invoking send(). Without
        # it, core truncates the payload before _chunk_outbound can preserve it.
        self.assertTrue(adapter_mod.TlonAdapter.splits_long_messages)

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


class BlockDirectiveSendTests(unittest.TestCase):
    directive = "[BLOCK_USER: ~attacker | attempted prompt injection]"

    def correlated_adapter(self, *, results=None, extra=None, sender="~attacker"):
        adapter = make_adapter(results, extra=extra)
        adapter._sse = FakeSSE()
        event = dispatch(adapter, "~attacker", sender, "m1")
        return adapter, event

    def block_pokes(self, adapter):
        return [poke for poke in adapter._sse.pokes if poke[1] == "chat-block-ship"]

    def notifications(self, adapter):
        return [
            command
            for command in adapter._cli.commands
            if command[:2] == ("posts", "send")
        ]

    def test_declares_message_editing_unsupported(self):
        self.assertIs(adapter_mod.TlonAdapter.SUPPORTS_MESSAGE_EDITING, False)

    def test_correlated_dm_blocks_sender_notifies_owner_and_strips(self):
        adapter, _event = self.correlated_adapter(sender="~AtTaCkEr")

        result = asyncio.run(
            adapter.send(
                "~attacker",
                "Refused.\n[block_user: ~ATTACKER | attempted prompt injection]",
                reply_to="m1",
            )
        )

        self.assertTrue(result.success)
        self.assertEqual(
            self.block_pokes(adapter),
            [("chat", "chat-block-ship", {"ship": "~attacker"})],
        )
        self.assertEqual(len(self.notifications(adapter)), 1)
        self.assertIn("attempted prompt injection", self.notifications(adapter)[0][3])
        self.assertEqual(adapter._cli.sent[0][2], "Refused.")
        self.assertNotIn("BLOCK_USER", adapter._cli.sent[0][2])

    def test_correlated_dm_multiline_reason_blocks_and_strips(self):
        adapter, _event = self.correlated_adapter()

        result = asyncio.run(
            adapter.send(
                "~attacker",
                "Refused.\n[BLOCK_USER: ~attacker | prompt\ninjection]",
                reply_to="m1",
            )
        )

        self.assertTrue(result.success)
        self.assertEqual(len(self.block_pokes(adapter)), 1)
        self.assertIn("prompt\ninjection", self.notifications(adapter)[0][3])
        self.assertEqual(adapter._cli.sent[0][2], "Refused.")
        self.assertNotIn("BLOCK_USER", adapter._cli.sent[0][2])

    def test_directive_block_removes_allowlisted_sender_and_denies_next_dm(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        adapter._settings_loaded = True
        adapter._settings_dm_allowlist = {"~attacker"}
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record

        async def run_scenario():
            await adapter._handle_dm_event(dm_event("first", message_id="m1"))
            result = await adapter.send(
                "~attacker", "Blocked. " + self.directive, reply_to="m1"
            )
            await adapter._handle_dm_event(dm_event("second", message_id="m2"))
            return result

        result = asyncio.run(run_scenario())

        self.assertTrue(result.success)
        self.assertNotIn("~attacker", adapter._settings_dm_allowlist)
        self.assertEqual(len(events), 1)
        self.assertTrue(events[0].text.startswith("first"))

    def test_owner_and_third_party_targets_are_content_safe_rejections(self):
        adapter, _event = self.correlated_adapter(extra={"owner_ship": "~MuG"})
        raw_secret = "DO NOT LOG THIS REASON"
        content = (
            f"safe [BLOCK_USER: ~mUg | {raw_secret}] "
            f"[BLOCK_USER: ~third-party | {raw_secret}]"
        )

        with self.assertLogs(adapter_mod.logger, level="WARNING") as captured:
            result = asyncio.run(adapter.send("~attacker", content, reply_to="m1"))

        self.assertTrue(result.success)
        self.assertEqual(self.block_pokes(adapter), [])
        self.assertEqual(self.notifications(adapter), [])
        logs = "\n".join(captured.output)
        self.assertIn("configured owner", logs)
        self.assertIn("not correlated sender", logs)
        self.assertNotIn(raw_secret, logs)
        self.assertNotIn("BLOCK_USER", logs)
        self.assertNotIn("third-party", logs)
        self.assertNotIn("mUg", logs)
        self.assertEqual(adapter._cli.sent[0][2], "safe")

    def test_uncorrelated_and_non_dm_sends_are_strip_only(self):
        cases = (
            ("no-reply", "~attacker", None),
            ("unknown", "~attacker", "unknown"),
            ("cross-chat", "~other", "m1"),
            ("channel", "chat/~pen/general", "channel-id"),
            ("club", "0v3.club", "club-id"),
        )
        for label, chat_id, reply_to in cases:
            with self.subTest(label=label):
                adapter, _event = self.correlated_adapter()
                if label == "channel":
                    dispatch(
                        adapter,
                        chat_id,
                        "~attacker",
                        "channel-id",
                        is_dm=False,
                    )
                elif label == "club":
                    dispatch(
                        adapter,
                        chat_id,
                        "~attacker",
                        "club-id",
                        is_dm=False,
                    )
                with self.assertLogs(adapter_mod.logger, level="WARNING") as captured:
                    result = asyncio.run(
                        adapter.send(chat_id, "visible " + self.directive, reply_to=reply_to)
                    )
                self.assertTrue(result.success)
                self.assertEqual(self.block_pokes(adapter), [])
                self.assertEqual(self.notifications(adapter), [])
                self.assertEqual(adapter._cli.sent[-1][2], "visible")
                logs = "\n".join(captured.output)
                self.assertNotIn("attempted prompt injection", logs)
                self.assertNotIn("BLOCK_USER", logs)

    def test_directive_only_skips_post_and_clears_only_correlated_addendum(self):
        adapter, _event = self.correlated_adapter()
        adapter._pending_bot_cap_addendum["~attacker"] = ("~bot", "m1")

        result = asyncio.run(
            adapter.send("~attacker", self.directive, reply_to="m1")
        )

        self.assertTrue(result.success)
        self.assertEqual(adapter._cli.sent, [])
        self.assertNotIn("~attacker", adapter._pending_bot_cap_addendum)

        for reply_to in (None, "other"):
            with self.subTest(reply_to=reply_to):
                adapter, _event = self.correlated_adapter()
                marker = ("~bot", "m1")
                adapter._pending_bot_cap_addendum["~attacker"] = marker
                result = asyncio.run(
                    adapter.send("~attacker", self.directive, reply_to=reply_to)
                )
                self.assertTrue(result.success)
                self.assertEqual(adapter._cli.sent, [])
                self.assertEqual(
                    adapter._pending_bot_cap_addendum["~attacker"], marker
                )

    def test_directive_only_with_caller_blob_keeps_content_error(self):
        adapter, _event = self.correlated_adapter()
        blob = json.dumps([{"type": "a2ui", "version": 1}])

        result = asyncio.run(
            adapter.send(
                "~attacker",
                self.directive,
                reply_to="m1",
                metadata={"blob": blob},
            )
        )

        self.assertFalse(result.success)
        self.assertIn("requires non-empty content", result.error)
        self.assertEqual(adapter._cli.sent, [])

    def test_multiple_directives_are_all_evaluated_and_stripped(self):
        adapter, _event = self.correlated_adapter()
        content = (
            "visible [BLOCK_USER: ~third | no] "
            "[BLOCK_USER: ~attacker | yes] "
            "[BLOCK_USER: ~attacker | duplicate]"
        )

        result = asyncio.run(adapter.send("~attacker", content, reply_to="m1"))

        self.assertTrue(result.success)
        self.assertEqual(len(self.block_pokes(adapter)), 1)
        self.assertEqual(len(self.notifications(adapter)), 1)
        self.assertNotIn("BLOCK_USER", adapter._cli.sent[0][2])

    def test_directive_only_block_failure_notifies_without_post_or_execution(self):
        adapter, _event = self.correlated_adapter()
        adapter._sse = FakeSSE(poke_error=RuntimeError("poke failed"))

        result = asyncio.run(
            adapter.send("~attacker", self.directive, reply_to="m1")
        )

        self.assertTrue(result.success)
        self.assertEqual(adapter._cli.sent, [])
        self.assertEqual(len(self.notifications(adapter)), 1)
        self.assertIn("block failed", self.notifications(adapter)[0][3])
        self.assertEqual(adapter._executed_block_directives, {})

    def test_block_failure_notifies_and_does_not_abort_visible_delivery(self):
        adapter, _event = self.correlated_adapter()
        adapter._sse = FakeSSE(poke_error=RuntimeError("poke failed"))
        telemetry_errors = []
        adapter._telemetry.error = lambda *args, **kwargs: telemetry_errors.append(
            (args, kwargs)
        )

        result = asyncio.run(
            adapter.send("~attacker", "still visible " + self.directive, reply_to="m1")
        )

        self.assertTrue(result.success)
        self.assertEqual(adapter._cli.sent[0][2], "still visible")
        self.assertEqual(len(self.notifications(adapter)), 1)
        self.assertIn("block failed", self.notifications(adapter)[0][3])
        self.assertEqual(adapter._executed_block_directives, {})
        self.assertTrue(
            any(
                args and args[0] == "moderation" and kwargs.get("operation") == "block"
                for args, kwargs in telemetry_errors
            )
        )

    def test_concurrent_delivery_retry_reserves_block_before_poke(self):
        adapter, _event = self.correlated_adapter()

        async def yielding_poke(app, mark, payload):
            await asyncio.sleep(0)
            adapter._sse.pokes.append((app, mark, payload))
            return 1

        adapter._sse.poke = yielding_poke

        async def send_concurrently():
            return await asyncio.gather(
                adapter.send(
                    "~attacker", "first " + self.directive, reply_to="m1"
                ),
                adapter.send(
                    "~attacker", "second " + self.directive, reply_to="m1"
                ),
            )

        results = asyncio.run(send_concurrently())

        self.assertTrue(all(result.success for result in results))
        self.assertEqual(len(self.block_pokes(adapter)), 1)
        self.assertEqual(len(self.notifications(adapter)), 1)

    def test_disconnect_during_block_poke_does_not_restore_dispatch_state(self):
        adapter, _event = self.correlated_adapter()
        poke_started = asyncio.Event()
        resume_poke = asyncio.Event()

        async def paused_poke(_app, _mark, _payload):
            poke_started.set()
            await resume_poke.wait()
            return 1

        adapter._sse.poke = paused_poke

        async def send_around_disconnect():
            send_task = asyncio.create_task(
                adapter.send(
                    "~attacker", "visible " + self.directive, reply_to="m1"
                )
            )
            await poke_started.wait()
            await adapter.disconnect()
            resume_poke.set()
            return await send_task

        result = asyncio.run(send_around_disconnect())

        self.assertTrue(result.success)
        self.assertEqual(adapter._inflight_senders, {})
        self.assertEqual(adapter._executed_block_directives, {})

    def test_delivery_retry_is_idempotent_but_fresh_redispatch_resets(self):
        transient = cli_result(
            success=False,
            error="fetch failed",
            stderr="network",
            returncode=1,
            message_id=None,
        )
        adapter, _event = self.correlated_adapter(
            results=[transient, cli_result(message_id="landed")]
        )

        first = asyncio.run(
            adapter.send("~attacker", "visible " + self.directive, reply_to="m1")
        )
        second = asyncio.run(
            adapter.send("~attacker", "visible " + self.directive, reply_to="m1")
        )

        self.assertFalse(first.success)
        self.assertTrue(first.retryable)
        self.assertTrue(second.success)
        self.assertEqual(len(self.block_pokes(adapter)), 1)
        self.assertEqual(len(self.notifications(adapter)), 1)

        dispatch(adapter, "~attacker", "~attacker", "m1")
        third = asyncio.run(
            adapter.send("~attacker", "new reply " + self.directive, reply_to="m1")
        )
        self.assertTrue(third.success)
        self.assertEqual(len(self.block_pokes(adapter)), 2)
        self.assertEqual(len(self.notifications(adapter)), 2)

    def test_completion_and_dispatch_exception_fail_closed(self):
        adapter, event = self.correlated_adapter()
        asyncio.run(adapter.on_processing_complete(event, None))

        result = asyncio.run(
            adapter.send("~attacker", "visible " + self.directive, reply_to="m1")
        )
        self.assertTrue(result.success)
        self.assertEqual(self.block_pokes(adapter), [])

        async def explode(_event):
            raise RuntimeError("dispatch failed")

        adapter.handle_message = explode
        with self.assertRaises(RuntimeError):
            asyncio.run(
                adapter._dispatch_message(
                    incoming("~attacker", "~attacker", "m2"),
                    is_dm=True,
                    mark_seen=False,
                    skip_authorization=True,
                )
            )
        result = asyncio.run(
            adapter.send("~attacker", "visible " + self.directive, reply_to="m2")
        )
        self.assertTrue(result.success)
        self.assertEqual(self.block_pokes(adapter), [])

    def test_disconnect_clears_both_dispatch_state_maps(self):
        adapter, _event = self.correlated_adapter()
        asyncio.run(
            adapter.send("~attacker", "visible " + self.directive, reply_to="m1")
        )
        self.assertTrue(adapter._inflight_senders)
        self.assertTrue(adapter._executed_block_directives)

        asyncio.run(adapter.disconnect())

        self.assertEqual(adapter._inflight_senders, {})
        self.assertEqual(adapter._executed_block_directives, {})

    def test_capacity_eviction_is_generation_atomic_and_reuse_is_fresh(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        adapter._DISPATCH_STATE_CAPACITY = 2
        dispatch(adapter, "~attacker", "~attacker", "m1")
        dispatch(adapter, "~attacker", "~attacker", "m2")
        asyncio.run(
            adapter.send("~attacker", "two " + self.directive, reply_to="m2")
        )
        asyncio.run(
            adapter.send("~attacker", "one " + self.directive, reply_to="m1")
        )

        dispatch(adapter, "~attacker", "~attacker", "m3")

        self.assertNotIn(("~attacker", "m1"), adapter._inflight_senders)
        self.assertNotIn(
            ("~attacker", "m1", "~attacker"),
            adapter._executed_block_directives,
        )
        self.assertIn(("~attacker", "m2"), adapter._inflight_senders)
        self.assertIn(
            ("~attacker", "m2", "~attacker"),
            adapter._executed_block_directives,
        )
        asyncio.run(
            adapter.send("~attacker", "retry " + self.directive, reply_to="m2")
        )
        self.assertEqual(len(self.block_pokes(adapter)), 2)

        dispatch(adapter, "~attacker", "~attacker", "m2")
        self.assertNotIn(
            ("~attacker", "m2", "~attacker"),
            adapter._executed_block_directives,
        )
        asyncio.run(
            adapter.send("~attacker", "fresh " + self.directive, reply_to="m2")
        )
        self.assertEqual(len(self.block_pokes(adapter)), 3)

    def test_executed_capacity_overflow_evicts_the_whole_oldest_generation(self):
        adapter = make_adapter()
        adapter._DISPATCH_STATE_CAPACITY = 2
        adapter._inflight_senders[("~one", "m1")] = "~one"
        adapter._inflight_senders[("~two", "m2")] = "~two"
        adapter._remember_executed_block(("~one", "m1", "~one"))
        adapter._remember_executed_block(("~two", "m2", "~two"))

        adapter._remember_executed_block(("~two", "m2", "~alternate-marker"))

        self.assertNotIn(("~one", "m1"), adapter._inflight_senders)
        self.assertFalse(
            any(
                key[:2] == ("~one", "m1")
                for key in adapter._executed_block_directives
            )
        )
        self.assertIn(("~two", "m2"), adapter._inflight_senders)
        self.assertEqual(
            [
                key
                for key in adapter._executed_block_directives
                if key[:2] == ("~two", "m2")
            ],
            [
                ("~two", "m2", "~two"),
                ("~two", "m2", "~alternate-marker"),
            ],
        )

    def test_shared_channel_reverse_delivery_is_always_strip_only(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        channel = "chat/~pen/general"
        dispatch(adapter, channel, "~alice", "a1", is_dm=False)
        dispatch(adapter, channel, "~bob", "b1", is_dm=False)

        for reply_to, target in (("b1", "~bob"), ("a1", "~alice")):
            result = asyncio.run(
                adapter.send(
                    channel,
                    f"visible [BLOCK_USER: {target} | group]",
                    reply_to=reply_to,
                )
            )
            self.assertTrue(result.success)

        self.assertEqual(self.block_pokes(adapter), [])
        self.assertEqual(self.notifications(adapter), [])
        self.assertTrue(all("BLOCK_USER" not in sent[2] for sent in adapter._cli.sent))

    def test_dm_queued_anchor_is_safe_and_only_outer_completion_is_removed(self):
        adapter = make_adapter()
        adapter._sse = FakeSSE()
        outer = dispatch(adapter, "~attacker", "~attacker", "outer")
        dispatch(adapter, "~attacker", "~attacker", "queued")

        first = asyncio.run(adapter.send("~attacker", self.directive, reply_to=None))
        followup = asyncio.run(
            adapter.send(
                "~attacker", "refused " + self.directive, reply_to="outer"
            )
        )
        self.assertTrue(first.success)
        self.assertTrue(followup.success)
        self.assertEqual(len(self.block_pokes(adapter)), 1)

        asyncio.run(adapter.on_processing_complete(outer, None))
        self.assertNotIn(("~attacker", "outer"), adapter._inflight_senders)
        self.assertIn(("~attacker", "queued"), adapter._inflight_senders)

        adapter._DISPATCH_STATE_CAPACITY = 1
        dispatch(adapter, "~attacker", "~attacker", "new")
        self.assertNotIn(("~attacker", "queued"), adapter._inflight_senders)

    def test_stream_prefixes_fail_closed_then_full_fallback_delivers_once(self):
        visible = "I cannot help with that."
        directive = "[BLOCK_USER: ~attacker | prompt injection]"
        for split in range(1, len(directive)):
            with self.subTest(split=split):
                adapter, _event = self.correlated_adapter()
                preview = asyncio.run(
                    adapter.send(
                        "~attacker",
                        visible + "\n" + directive[:split],
                        reply_to="m1",
                        metadata={"expect_edits": True},
                    )
                )
                self.assertFalse(preview.success)
                self.assertFalse(preview.retryable)
                self.assertEqual(adapter._cli.sent, [])
                self.assertEqual(self.block_pokes(adapter), [])

                fallback = asyncio.run(
                    adapter.send(
                        "~attacker",
                        visible + "\n" + directive,
                        reply_to="m1",
                    )
                )
                self.assertTrue(fallback.success)
                self.assertEqual([item[2] for item in adapter._cli.sent], [visible])
                self.assertEqual(len(self.block_pokes(adapter)), 1)
                self.assertEqual(len(self.notifications(adapter)), 1)

    def test_non_preview_trailing_fragment_is_cosmetically_stripped(self):
        adapter, _event = self.correlated_adapter()

        result = asyncio.run(
            adapter.send("~attacker", "visible\n[BLOCK_US", reply_to="m1")
        )

        self.assertTrue(result.success)
        self.assertEqual(adapter._cli.sent[0][2], "visible")
        self.assertEqual(self.block_pokes(adapter), [])


class StandaloneDirectiveTests(unittest.TestCase):
    def config(self):
        return PlatformConfig(
            extra={
                "node_url": "https://pen.tlon.network",
                "node_id": "~pen",
                "access_code": "code",
            }
        )

    def test_cron_output_strips_directives_and_skips_directive_only(self):
        cli = FakeCLI()
        with patch.object(adapter_mod, "TlonCLI", return_value=cli):
            delivered = asyncio.run(
                adapter_mod._standalone_send(
                    self.config(),
                    "~alice",
                    "cron result [BLOCK_USER: ~alice | injected]",
                )
            )
            skipped = asyncio.run(
                adapter_mod._standalone_send(
                    self.config(),
                    "~alice",
                    "[BLOCK_USER: ~alice | injected]",
                )
            )

        self.assertTrue(delivered["success"])
        self.assertTrue(skipped["success"])
        self.assertEqual([entry[2] for entry in cli.sent], ["cron result"])


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


class HeapReplyAnchoringTests(unittest.TestCase):
    def test_gallery_replies_anchor_to_posts_and_recover_reaction_targets(self):
        class AnchorRecordingCLI(FakeCLI):
            def __init__(self):
                super().__init__()
                self.replies = []

            async def send_reply(
                self,
                chat_id,
                parent,
                content,
                *,
                parent_author=None,
                blob=None,
                sent_at=None,
            ):
                self.replies.append((chat_id, parent, content, parent_author))
                return await super().send_reply(
                    chat_id,
                    parent,
                    content,
                    parent_author=parent_author,
                    blob=blob,
                    sent_at=sent_at,
                )

        adapter = make_adapter()
        adapter._cli = AnchorRecordingCLI()

        asyncio.run(
            adapter.send("heap/~zod/gallery", "top-level reply", reply_to="170.141")
        )
        asyncio.run(
            adapter.send(
                "heap/~zod/gallery",
                "thread reply",
                reply_to="170.151",
                metadata={"thread_id": "170.150"},
            )
        )
        synthetic_id = "react/170.160/~mug/👍"
        adapter._reaction_reply_targets[synthetic_id] = "170.160"
        asyncio.run(
            adapter.send("heap/~zod/gallery", "reaction reply", reply_to=synthetic_id)
        )

        self.assertEqual(
            [reply[1] for reply in adapter._cli.replies],
            ["170.141", "170.150", "170.160"],
        )
        self.assertEqual([sent[0] for sent in adapter._cli.sent], ["reply"] * 3)


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
