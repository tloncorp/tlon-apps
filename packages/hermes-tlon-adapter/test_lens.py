import asyncio
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_lens_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(module_name, PACKAGE_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


tlon_api = load_module("tlon_api")
lens = load_module("lens")

TlonConfig = tlon_api.TlonConfig


def make_config(**overrides):
    env = {
        "TLON_NODE_URL": "https://bot.tlon.network",
        "TLON_NODE_ID": "~bot",
        "TLON_ACCESS_CODE": "code",
    }
    env.update(overrides)
    return TlonConfig.from_env(env=env)


class FakeClient:
    """Stands in for TlonSSEClient; records pokes instead of hitting a ship."""

    instances = []

    def __init__(self, config):
        self.config = config
        self.pokes = []
        self.authenticated = False
        self.opened = False
        self.closed = False
        self.fail_on_mark = None
        self.scries = []
        self.steward_missing = False
        FakeClient.instances.append(self)

    async def authenticate(self):
        self.authenticated = True

    async def open(self):
        self.opened = True

    async def close(self):
        self.closed = True

    async def poke(self, app, mark, payload):
        if self.fail_on_mark == mark:
            raise RuntimeError(f"poke {mark} failed")
        self.pokes.append((app, mark, payload))

    async def scry(self, path):
        self.scries.append(path)
        if self.steward_missing:
            raise ConnectionError(f"scry {path} failed: no such agent")
        return {"recent": []}

    def marks(self):
        return [mark for _app, mark, _payload in self.pokes]

    def entries(self):
        return [p for _a, m, p in self.pokes if m == lens._LENS_MARK]


def run(coro):
    return asyncio.run(coro)


def make_run(**overrides):
    kwargs = dict(
        lens_id="L1",
        message_id="m1",
        chat_type="dm",
        trigger="dm",
        conversation_kind="dm",
        conversation_id="~alice",
    )
    kwargs.update(overrides)
    return lens.LensRun(**kwargs)


class PayloadMappingTests(unittest.TestCase):
    def test_context_lens_shape_and_camel_case(self):
        r = make_run(model="hermes-3", provider="nous", author_ship="~alice")
        r.start_tool("search", tool_call_id="t1", argument_detail='{"q":"hi"}')
        r.complete_tool("search", tool_call_id="t1", result_summary="ok", duration_ms=12)
        r.record_output(
            lens.LensOutput(
                message_id="o1", conversation_id="~alice", kind="dm", sent_at=5
            )
        )
        r.set_status("completed")

        doc = r.to_context_lens()
        self.assertEqual(doc["lensId"], "L1")
        self.assertEqual(doc["chatType"], "dm")
        self.assertEqual(doc["model"], "hermes-3")
        self.assertEqual(doc["triggerDetails"]["conversationKind"], "dm")
        self.assertEqual(doc["triggerDetails"]["authorShip"], "~alice")
        self.assertEqual(doc["tools"]["callCount"], 1)
        self.assertEqual(doc["tools"]["runs"][0]["status"], "completed")
        self.assertEqual(doc["tools"]["runs"][0]["resultSummary"], "ok")
        self.assertEqual(doc["tools"]["called"], ["search"])
        self.assertEqual(len(doc["outputs"]), 1)
        self.assertTrue(doc["persistence"]["postsReply"])
        self.assertEqual(doc["status"], "completed")
        self.assertIsNotNone(doc["lifecycle"]["completedAt"])
        self.assertGreater(doc["expiresAt"], doc["createdAt"])

    def test_terminal_status_sets_duration_and_timeout(self):
        r = make_run()
        r.set_status("timed_out")
        doc = r.to_context_lens()
        self.assertTrue(doc["lifecycle"]["timedOut"])
        self.assertIsNotNone(doc["lifecycle"]["durationMs"])

    def test_retry_of_included_only_when_set(self):
        self.assertNotIn("retryOf", make_run().to_context_lens())
        self.assertEqual(make_run(retry_of="L0").to_context_lens()["retryOf"], "L0")


class ToolMatchingTests(unittest.TestCase):
    def test_complete_matches_open_by_tool_call_id(self):
        r = make_run()
        r.start_tool("a", tool_call_id="1")
        r.start_tool("b", tool_call_id="2")
        r.complete_tool("b", tool_call_id="2", result_summary="rb")
        r.complete_tool("a", tool_call_id="1", result_summary="ra")
        by_id = {run.tool_call_id: run for run in r.tool_runs}
        self.assertEqual(by_id["1"].result_summary, "ra")
        self.assertEqual(by_id["2"].result_summary, "rb")
        self.assertEqual(len(r.tool_runs), 2)

    def test_complete_without_start_synthesizes_run(self):
        r = make_run()
        r.complete_tool("orphan", result_summary="x", status="completed")
        self.assertEqual(len(r.tool_runs), 1)
        self.assertEqual(r.tool_runs[0].result_summary, "x")

    def test_error_status_and_close_open_tools(self):
        r = make_run()
        r.start_tool("boom", tool_call_id="9")
        r.complete_tool("boom", tool_call_id="9", error="kaboom")
        self.assertEqual(r.tool_runs[0].status, "error")
        r.start_tool("dangling", tool_call_id="10")
        r.close_open_tools()
        # Dangling tools close as 'error' (a valid ContextLensToolRun status),
        # not the run-level 'aborted'.
        self.assertEqual(r.tool_runs[1].status, "error")

    def test_call_index_is_one_based(self):
        r = make_run()
        r.start_tool("a", tool_call_id="1")
        r.start_tool("b", tool_call_id="2")
        self.assertEqual([run.call_index for run in r.tool_runs], [1, 2])
        self.assertEqual(r.to_context_lens()["tools"]["callCount"], 2)

    def test_tool_run_statuses_are_contract_valid(self):
        valid = {"running", "completed", "error", "blocked"}
        r = make_run()
        r.start_tool("open", tool_call_id="1")
        r.start_tool("done", tool_call_id="2")
        r.complete_tool("done", tool_call_id="2")
        r.start_tool("failed", tool_call_id="3")
        r.complete_tool("failed", tool_call_id="3", error="x")
        r.close_open_tools()
        for run in r.to_context_lens()["tools"]["runs"]:
            self.assertIn(run["status"], valid)


class TruncationTests(unittest.TestCase):
    def test_summary_truncation(self):
        big = "x" * (lens.MAX_SUMMARY_CHARS + 500)
        r = make_run()
        r.start_tool("t", tool_call_id="1", argument_detail=big)
        r.complete_tool("t", tool_call_id="1", result_summary=big)
        detail = r.to_context_lens()["tools"]["runs"][0]["argumentDetail"]
        self.assertLess(len(detail), len(big))
        self.assertTrue(detail.endswith("[truncated]"))

    def test_payload_cap_drops_arrays(self):
        r = make_run()
        # Force oversize by stuffing many tool runs with large results.
        for i in range(400):
            r.start_tool(f"t{i}", tool_call_id=str(i))
            r.complete_tool(f"t{i}", tool_call_id=str(i), result_summary="y" * 500)
        r.set_status("completed")
        payload = lens.build_lens_payload(r.to_context_lens())
        self.assertTrue(payload.get("truncated"))
        self.assertEqual(payload["lens"]["tools"]["runs"], [])
        self.assertEqual(payload["lens"]["outputs"], [])
        # Identity + status survive the drop.
        self.assertEqual(payload["lens"]["lensId"], "L1")
        self.assertEqual(payload["lens"]["status"], "completed")
        self.assertLessEqual(
            len(json.dumps(payload, separators=(",", ":"))), lens.MAX_PAYLOAD_CHARS
        )

    def test_reference_blob_shape(self):
        # Mirrors serializeContextLensReferenceBlob (openclaw/urbit/blob.ts):
        # a JSON array with a single tlon-context-lens entry.
        blob = json.loads(lens.context_lens_reference_blob("L9", "~bot"))
        self.assertEqual(
            blob,
            [{"type": "tlon-context-lens", "version": 1, "lensId": "L9", "botShip": "~bot"}],
        )

    def test_reference_blob_omits_bot_ship_when_absent(self):
        blob = json.loads(lens.context_lens_reference_blob("L9"))
        self.assertNotIn("botShip", blob[0])
        self.assertEqual(blob[0]["lensId"], "L9")

    def test_small_payload_not_truncated(self):
        payload = lens.build_lens_payload(make_run().to_context_lens())
        self.assertNotIn("truncated", payload)
        self.assertEqual(payload["schemaVersion"], lens.PAYLOAD_SCHEMA_VERSION)


class SyncSequencingTests(unittest.TestCase):
    def setUp(self):
        FakeClient.instances.clear()

    def test_start_probes_steward_and_activates(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)

        async def scenario():
            self.assertTrue(await sync.start())
            self.assertTrue(sync.active)

        run(scenario())
        client = FakeClient.instances[-1]
        self.assertEqual(client.scries, ["/steward/v1/lens/recent"])

    def test_start_returns_false_when_steward_missing(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")

        def factory(config):
            client = FakeClient(config)
            client.steward_missing = True
            return client

        sync = lens.TlonLensSync(cfg, client_factory=factory)
        rec = lens.TlonLensRecorder(sync)

        async def scenario():
            self.assertFalse(await sync.start())
            self.assertFalse(sync.active)
            # Inactive sync: begin stores nothing and a push is a no-op.
            rec.begin("~alice", make_run())
            await rec.push("~alice")

        run(scenario())
        client = FakeClient.instances[-1]
        self.assertEqual(client.scries, ["/steward/v1/lens/recent"])
        self.assertTrue(client.closed)
        self.assertEqual(client.entries(), [])

    def test_configure_precedes_entry_and_final_last(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)
        rec = lens.TlonLensRecorder(sync)

        async def scenario():
            self.assertTrue(await sync.start())
            r = make_run()
            r.set_status("dispatching")
            rec.begin("~alice", r)
            await rec.push("~alice")
            rec.record_output(
                "~alice",
                lens.LensOutput(
                    message_id="o1", conversation_id="~alice", kind="dm", sent_at=1
                ),
            )
            await rec.finish("~alice", status="completed")
            await sync.stop()

        run(scenario())
        client = FakeClient.instances[0]
        self.assertEqual(
            client.marks(),
            [lens._CONFIGURE_MARK, lens._LENS_MARK, lens._LENS_MARK],
        )
        finals = [e["entry"]["final"] for e in client.entries()]
        self.assertEqual(finals, [False, True])
        self.assertEqual(client.entries()[-1]["entry"]["payload"]["lens"]["status"], "completed")
        self.assertTrue(client.closed)

    def test_delivery_failure_flags_run(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        rec = lens.TlonLensRecorder(lens.TlonLensSync(cfg, client_factory=FakeClient))
        rec.begin("~alice", make_run())
        rec.record_delivery_failure("~alice", error="boom")
        r = rec.get("~alice")
        self.assertTrue(r.delivery_failed)
        self.assertEqual(r.delivered_message_count, 0)
        self.assertEqual(r.error, "boom")

    def test_finish_as_error_pushes_final_once(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)
        rec = lens.TlonLensRecorder(sync)

        async def scenario():
            await sync.start()
            rec.begin("~alice", make_run())
            await rec.finish("~alice", status="error")
            # A second finish (e.g. dispatch raised after a normal finish) is a
            # no-op — the run was already popped.
            await rec.finish("~alice", status="error")

        run(scenario())
        entries = FakeClient.instances[0].entries()
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["entry"]["payload"]["lens"]["status"], "error")
        self.assertTrue(entries[0]["entry"]["final"])

    def test_configure_poked_once(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)

        async def scenario():
            await sync.start()
            await sync.push(make_run(lens_id="a"), final=True)
            await sync.push(make_run(lens_id="b"), final=True)

        run(scenario())
        client = FakeClient.instances[0]
        self.assertEqual(client.marks().count(lens._CONFIGURE_MARK), 1)

    def test_configure_retried_after_failure(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        errors = []
        sync = lens.TlonLensSync(
            cfg,
            client_factory=FakeClient,
            on_error=lambda op, exc: errors.append((op, str(exc))),
        )

        async def scenario():
            await sync.start()
            sync._client.fail_on_mark = lens._CONFIGURE_MARK
            await sync.push(make_run(), final=True)  # configure fails
            sync._client.fail_on_mark = None
            await sync.push(make_run(), final=True)  # should re-configure + entry

        run(scenario())
        client = FakeClient.instances[0]
        self.assertTrue(errors)
        # First attempt only got the (failed, unrecorded) configure; the retry
        # re-runs configure and lands the entry.
        self.assertEqual(client.marks(), [lens._CONFIGURE_MARK, lens._LENS_MARK])

    def test_internal_visibility_not_pushed(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)

        async def scenario():
            await sync.start()
            await sync.push(make_run(visibility="internal"), final=True)

        run(scenario())
        client = FakeClient.instances[0]
        self.assertEqual(client.entries(), [])


class GatingTests(unittest.TestCase):
    def setUp(self):
        FakeClient.instances.clear()

    def test_disabled_when_flag_off(self):
        cfg = make_config(TLON_OWNER_SHIP="~zod")  # flag not set
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)
        self.assertFalse(sync.enabled)

        async def scenario():
            self.assertFalse(await sync.start())
            await sync.push(make_run(), final=True)

        run(scenario())
        self.assertEqual(FakeClient.instances, [])

    def test_disabled_when_no_owner(self):
        cfg = make_config(TLON_CONTEXT_LENS="true")  # no owner anywhere
        sync = lens.TlonLensSync(cfg, client_factory=FakeClient)
        self.assertFalse(sync.enabled)

        async def scenario():
            self.assertFalse(await sync.start())

        run(scenario())

    def test_context_lens_owner_overrides_owner_ship(self):
        cfg = make_config(
            TLON_CONTEXT_LENS="true",
            TLON_OWNER_SHIP="~zod",
            TLON_CONTEXT_LENS_OWNER="~nec",
        )
        self.assertEqual(cfg.context_lens_owner_ship(), "~nec")

    def test_owner_falls_back_to_owner_ship(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        self.assertEqual(cfg.context_lens_owner_ship(), "~zod")

    def test_recorder_begin_noop_when_disabled(self):
        cfg = make_config(TLON_OWNER_SHIP="~zod")
        rec = lens.TlonLensRecorder(lens.TlonLensSync(cfg, client_factory=FakeClient))
        rec.begin("~alice", make_run())
        self.assertIsNone(rec.get("~alice"))


class HookTests(unittest.TestCase):
    def setUp(self):
        FakeClient.instances.clear()
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        self.sync = lens.TlonLensSync(cfg, client_factory=FakeClient)
        self.rec = lens.TlonLensRecorder(self.sync)
        lens.set_active_recorder(self.rec)
        self.addCleanup(lambda: lens.clear_active_recorder(self.rec))
        env = patch.dict(
            os.environ,
            {"HERMES_SESSION_PLATFORM": "tlon", "HERMES_SESSION_CHAT_ID": "~alice"},
        )
        env.start()
        self.addCleanup(env.stop)
        self.rec.begin("~alice", make_run())

    def _kwargs(self, **extra):
        base = {"platform": "tlon"}
        base.update(extra)
        return base

    def test_pre_tool_call_captures_args(self):
        lens.handle_pre_tool_call_lens(
            **self._kwargs(tool_name="search", args={"q": "hi"}, tool_call_id="t1")
        )
        r = self.rec.get("~alice")
        self.assertEqual(r.tool_runs[0].argument_detail, '{"q":"hi"}')
        self.assertEqual(r.tool_runs[0].argument_summary, "search(q)")

    def test_post_tool_call_captures_result_and_error(self):
        lens.handle_pre_tool_call_lens(
            **self._kwargs(tool_name="t", args={}, tool_call_id="x")
        )
        lens.handle_post_tool_call_lens(
            **self._kwargs(
                tool_name="t", tool_call_id="x", result={"n": 1}, status="ok", duration_ms=7
            )
        )
        r = self.rec.get("~alice")
        self.assertEqual(r.tool_runs[0].status, "completed")
        self.assertEqual(r.tool_runs[0].result_summary, '{"n":1}')
        self.assertEqual(r.tool_runs[0].duration_ms, 7)

    def test_post_tool_call_error_status(self):
        lens.handle_post_tool_call_lens(
            **self._kwargs(tool_name="t", tool_call_id="x", status="error", error_type="Boom")
        )
        self.assertEqual(self.rec.get("~alice").tool_runs[0].status, "error")

    def test_post_tool_call_failure_without_error_type_is_error(self):
        # A non-ok status must record as 'error' even when Hermes omits an
        # error_type, not fall through to 'completed'.
        lens.handle_post_tool_call_lens(
            **self._kwargs(tool_name="t", tool_call_id="x", status="error")
        )
        self.assertEqual(self.rec.get("~alice").tool_runs[0].status, "error")

    def test_post_api_request_captures_model(self):
        lens.handle_post_api_request_lens(
            **self._kwargs(model="hermes-3", provider="nous")
        )
        r = self.rec.get("~alice")
        self.assertEqual(r.model, "hermes-3")
        self.assertEqual(r.provider, "nous")

    def test_hooks_ignore_non_tlon_platform(self):
        lens.handle_pre_tool_call_lens(platform="discord", tool_name="x", args={})
        self.assertEqual(self.rec.get("~alice").tool_runs, [])


class RetrySeedTests(unittest.TestCase):
    def test_seed_emitted_and_text_capped(self):
        big = "x" * (lens.MAX_RETRY_SEED_TEXT_CHARS + 100)
        seed = make_run(retry_seed={"messageText": big}).to_context_lens()["retrySeed"]
        self.assertEqual(len(seed["messageText"]), lens.MAX_RETRY_SEED_TEXT_CHARS)

    def test_oversized_blob_dropped(self):
        big = "b" * (lens.MAX_RETRY_SEED_BLOB_CHARS + 1)
        seed = make_run(
            retry_seed={"messageText": "hi", "blobField": big}
        ).to_context_lens()["retrySeed"]
        self.assertNotIn("blobField", seed)

    def test_small_blob_kept(self):
        seed = make_run(
            retry_seed={"messageText": "hi", "blobField": "b" * 10}
        ).to_context_lens()["retrySeed"]
        self.assertEqual(seed["blobField"], "b" * 10)

    def test_no_seed_no_key(self):
        self.assertNotIn("retrySeed", make_run().to_context_lens())

    def test_seed_survives_skeletonization(self):
        r = make_run(retry_seed={"messageText": "keepme"})
        for i in range(400):
            r.start_tool(f"t{i}", tool_call_id=str(i))
            r.complete_tool(f"t{i}", tool_call_id=str(i), result_summary="y" * 500)
        r.set_status("error")
        payload = lens.build_lens_payload(r.to_context_lens())
        self.assertTrue(payload.get("truncated"))
        self.assertEqual(payload["lens"]["retrySeed"]["messageText"], "keepme")


class BuildRetryDispatchTests(unittest.TestCase):
    def _lens(
        self,
        *,
        status="error",
        conversation_kind="dm",
        author="~alice",
        conversation_id="~alice",
        run_kind="conversation",
        preview=None,
        seed=None,
    ):
        r = make_run(
            conversation_kind=conversation_kind,
            chat_type=conversation_kind,
            author_ship=author,
            conversation_id=conversation_id,
            run_kind=run_kind,
            preview=preview,
            retry_seed=seed,
        )
        r.set_status(status)
        return r.to_context_lens()

    def test_completed_not_retryable(self):
        res = lens.build_retry_dispatch(self._lens(status="completed"))
        self.assertFalse(res.ok)

    def test_error_status_dispatches(self):
        res = lens.build_retry_dispatch(self._lens(seed={"messageText": "hi"}))
        self.assertTrue(res.ok)
        self.assertEqual(res.dispatch.message_text, "hi")
        self.assertFalse(res.dispatch.degraded)
        self.assertFalse(res.dispatch.is_group)

    def test_internal_rejected(self):
        res = lens.build_retry_dispatch(
            self._lens(conversation_kind="internal", seed={"messageText": "hi"})
        )
        self.assertFalse(res.ok)

    def test_internal_run_kind_rejected(self):
        res = lens.build_retry_dispatch(
            self._lens(run_kind="internal", seed={"messageText": "hi"})
        )
        self.assertFalse(res.ok)

    def test_no_author_rejected(self):
        res = lens.build_retry_dispatch(
            self._lens(author=None, seed={"messageText": "hi"})
        )
        self.assertFalse(res.ok)

    def test_channel_without_conversation_id_rejected(self):
        res = lens.build_retry_dispatch(
            self._lens(
                conversation_kind="channel",
                conversation_id=None,
                seed={"messageText": "hi"},
            )
        )
        self.assertFalse(res.ok)

    def test_channel_sets_nest(self):
        res = lens.build_retry_dispatch(
            self._lens(
                conversation_kind="channel",
                conversation_id="chat/~pen/general",
                seed={"messageText": "hi"},
            )
        )
        self.assertTrue(res.ok)
        self.assertTrue(res.dispatch.is_group)
        self.assertEqual(res.dispatch.channel_nest, "chat/~pen/general")

    def test_no_text_blob_or_content_rejected(self):
        res = lens.build_retry_dispatch(self._lens(seed={"messageText": "   "}))
        self.assertFalse(res.ok)

    def test_blob_only_dispatchable(self):
        res = lens.build_retry_dispatch(
            self._lens(seed={"messageText": "", "blobField": "BLOB"})
        )
        self.assertTrue(res.ok)
        self.assertEqual(res.dispatch.blob_field, "BLOB")

    def test_degraded_falls_back_to_preview(self):
        res = lens.build_retry_dispatch(self._lens(preview="orig text"))
        self.assertTrue(res.ok)
        self.assertTrue(res.dispatch.degraded)
        self.assertEqual(res.dispatch.message_text, "orig text")

    def test_nullish_empty_seed_text_wins_over_preview(self):
        # An explicit empty seed text with a blob must NOT fall back to preview
        # (nullish, not truthy, semantics — mirrors context-lens.ts ??).
        res = lens.build_retry_dispatch(
            self._lens(preview="PREVIEW", seed={"messageText": "", "blobField": "B"})
        )
        self.assertTrue(res.ok)
        self.assertEqual(res.dispatch.message_text, "")
        self.assertFalse(res.dispatch.degraded)

    def test_seed_thread_fields_carried(self):
        res = lens.build_retry_dispatch(
            self._lens(
                seed={
                    "messageText": "hi",
                    "parentId": "170.141",
                    "isThreadReply": True,
                    "cachesHistory": False,
                }
            )
        )
        self.assertEqual(res.dispatch.parent_id, "170.141")
        self.assertTrue(res.dispatch.is_thread_reply)
        self.assertFalse(res.dispatch.caches_history)


class RecorderRecentTests(unittest.TestCase):
    def setUp(self):
        FakeClient.instances.clear()

    def test_find_recent_after_finish(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        rec = lens.TlonLensRecorder(lens.TlonLensSync(cfg, client_factory=FakeClient))

        async def scenario():
            await rec._sync.start()
            rec.begin("~alice", make_run(lens_id="LX"))
            await rec.finish("~alice", status="error")

        run(scenario())
        found = rec.find_recent_lens("LX")
        self.assertIsNotNone(found)
        self.assertEqual(found["status"], "error")
        self.assertIsNone(rec.find_recent_lens("missing"))


class LensRunStoreTests(unittest.TestCase):
    def setUp(self):
        FakeClient.instances.clear()
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        # Nested dir proves the store creates its parent directories.
        self.path = str(Path(tmp.name) / "tlon" / "context-lens-runs.jsonl")

    def make_lens(self, lens_id="L1", finalized_at=None, **extra):
        now = lens._now_ms()
        record = {
            "lensId": lens_id,
            "status": "error",
            "createdAt": now,
            "updatedAt": now,
            "lifecycle": {"completedAt": finalized_at if finalized_at is not None else now},
        }
        record.update(extra)
        return record

    def test_save_get_and_restart_reload(self):
        store = lens.LensRunStore(self.path)
        store.save(self.make_lens("L1"))
        self.assertEqual(store.get("L1")["lensId"], "L1")
        reloaded = lens.LensRunStore(self.path)
        self.assertEqual(reloaded.get("L1")["lensId"], "L1")
        self.assertIsNone(reloaded.get("L2"))

    def test_last_write_wins_per_lens_id(self):
        store = lens.LensRunStore(self.path)
        store.save(self.make_lens("L1", status="error"))
        store.save(self.make_lens("L1", status="timed_out"))
        reloaded = lens.LensRunStore(self.path)
        self.assertEqual(reloaded.size(), 1)
        self.assertEqual(reloaded.get("L1")["status"], "timed_out")

    def test_malformed_lines_skipped_and_compacted(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as fh:
            fh.write("not json\n")
            fh.write(json.dumps(self.make_lens("L1")) + "\n")
            fh.write(json.dumps({"no": "lensId"}) + "\n")
        store = lens.LensRunStore(self.path)
        self.assertEqual(store.size(), 1)
        self.assertIsNotNone(store.get("L1"))
        with open(self.path, encoding="utf-8") as fh:
            lines = [line for line in fh.read().split("\n") if line.strip()]
        self.assertEqual(len(lines), 1)

    def test_retention_drops_expired_runs(self):
        store = lens.LensRunStore(self.path, retain_days=30)
        expired = lens._now_ms() - 31 * lens._DAY_MS
        store.save(self.make_lens("OLD", finalized_at=expired))
        self.assertIsNone(store.get("OLD"))
        self.assertEqual(store.size(), 0)

    def test_max_stored_evicts_oldest(self):
        store = lens.LensRunStore(self.path, max_stored=2)
        store.save(self.make_lens("A"))
        store.save(self.make_lens("B"))
        store.save(self.make_lens("C"))
        self.assertIsNone(store.get("A"))
        self.assertIsNotNone(store.get("B"))
        self.assertIsNotNone(store.get("C"))
        reloaded = lens.LensRunStore(self.path, max_stored=2)
        self.assertEqual(reloaded.size(), 2)

    def test_recorder_persists_finish_and_reads_store_after_restart(self):
        cfg = make_config(TLON_CONTEXT_LENS="true", TLON_OWNER_SHIP="~zod")
        store = lens.LensRunStore(self.path)
        rec = lens.TlonLensRecorder(
            lens.TlonLensSync(cfg, client_factory=FakeClient), store=store
        )

        async def scenario():
            await rec._sync.start()
            rec.begin("~alice", make_run(lens_id="LX"))
            await rec.finish("~alice", status="error")

        run(scenario())
        self.assertIsNotNone(store.get("LX"))
        # Fresh recorder + fresh store on the same path = adapter restart; the
        # recent cache is gone, so the lookup must come from disk.
        rec2 = lens.TlonLensRecorder(
            lens.TlonLensSync(cfg, client_factory=FakeClient),
            store=lens.LensRunStore(self.path),
        )
        found = rec2.find_recent_lens("LX")
        self.assertIsNotNone(found)
        self.assertEqual(found["status"], "error")


if __name__ == "__main__":
    unittest.main()
