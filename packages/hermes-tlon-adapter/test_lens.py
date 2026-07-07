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
        self.assertIn(lens._STEWARD_PROBE_PATH, client.scries)

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
        self.assertIn(lens._STEWARD_PROBE_PATH, client.scries)
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


if __name__ == "__main__":
    unittest.main()
