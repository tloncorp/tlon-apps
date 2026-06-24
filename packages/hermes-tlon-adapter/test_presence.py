import asyncio
import importlib.util
import json
import os
import sys
import time
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_presence_testpkg"

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
presence = load_module("presence")


class FakePresenceClient:
    def __init__(self):
        self.authenticated = False
        self.opened = False
        self.closed = False
        self.pokes = []

    async def authenticate(self):
        self.authenticated = True
        return "urbauth=fake"

    async def open(self):
        self.opened = True

    async def poke(self, app, mark, json_payload):
        self.pokes.append((app, mark, json_payload))
        return len(self.pokes)

    async def close(self):
        self.closed = True


class RecordingReporter:
    def __init__(self):
        self.published = []
        self.closed = False

    async def publish(self, *, conversation_id, thinking, tool_names):
        self.published.append(
            {
                "conversation_id": conversation_id,
                "thinking": thinking,
                "tool_names": list(tool_names),
            }
        )

    async def close(self):
        self.closed = True


class ComputingStatusTests(unittest.TestCase):
    def test_computing_status_matches_tlon_api_shape(self):
        status = presence.create_computing_status(
            thinking=True,
            tool_names=["web_fetch", "exec", "web_fetch", ""],
        )

        self.assertEqual(
            status,
            {
                "protocol": presence.COMPUTING_STATUS_PROTOCOL,
                "thinking": True,
                "toolCalls": [
                    {"toolName": "web_fetch", "label": "Checking the web"},
                    {"toolName": "exec", "label": "Running a command"},
                ],
            },
        )
        self.assertEqual(presence.get_computing_status_text(status), "Using tools...")

    def test_tool_labels_match_openclaw_style_and_hermes_tools(self):
        self.assertEqual(presence.format_computing_tool_call_label("exec"), "Running a command")
        self.assertEqual(presence.format_computing_tool_call_label("read"), "Reading files")
        self.assertEqual(presence.format_computing_tool_call_label("web_fetch"), "Checking the web")
        self.assertEqual(presence.format_computing_tool_call_label("web_extract"), "Checking the web")
        self.assertEqual(presence.format_computing_tool_call_label("web_search"), "Searching the web")
        self.assertEqual(presence.format_computing_tool_call_label("image_search"), "Searching images")
        self.assertEqual(presence.format_computing_tool_call_label("tlon"), "Using Tlon")
        self.assertEqual(presence.format_computing_tool_call_label("custom_tool"), "Using custom tool")
        self.assertEqual(presence.format_computing_tool_call_label(), "Using a tool")

    def test_computing_status_preserves_explicit_tool_labels(self):
        status = presence.create_computing_status(
            thinking=True,
            tool_names=[
                {"toolName": "exec", "label": "Shelling out"},
                {"tool_name": "image_search", "label": ""},
                {"toolName": "exec", "label": "ignored duplicate"},
            ],
        )

        self.assertEqual(
            status["toolCalls"],
            [
                {"toolName": "exec", "label": "Shelling out"},
                {"toolName": "image_search", "label": "Searching images"},
            ],
        )

    def test_context_conversion_supports_dm_and_channel(self):
        self.assertEqual(
            presence.conversation_id_to_presence_context("~mug"),
            "/dm/~mug",
        )
        self.assertEqual(
            presence.conversation_id_to_presence_context("chat/~pen/general"),
            "/channel/chat/~pen/general",
        )


class PresenceReporterTests(unittest.TestCase):
    def test_reporter_publishes_presence_set_payload(self):
        fake = FakePresenceClient()
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )

        async def run():
            reporter = presence.TlonComputingPresenceReporter(
                cfg,
                client_factory=lambda _cfg: fake,
            )
            await reporter.publish(
                conversation_id="~mug",
                thinking=True,
                tool_names=["exec"],
            )
            await reporter.close()

        asyncio.run(run())

        self.assertTrue(fake.authenticated)
        self.assertTrue(fake.opened)
        self.assertTrue(fake.closed)
        self.assertEqual(fake.pokes[0][0], "presence")
        self.assertEqual(fake.pokes[0][1], "presence-action-1")

        payload = fake.pokes[0][2]
        self.assertEqual(payload["set"]["disclose"], [])
        self.assertEqual(
            payload["set"]["key"],
            {"context": "/dm/~mug", "ship": "~zod", "topic": "computing"},
        )
        self.assertEqual(payload["set"]["timeout"], presence.ACTIVE_PRESENCE_TIMEOUT)
        self.assertEqual(payload["set"]["display"]["icon"], None)
        self.assertEqual(payload["set"]["display"]["text"], "Running a command")
        self.assertEqual(
            json.loads(payload["set"]["display"]["blob"]),
            {
                "protocol": presence.COMPUTING_STATUS_PROTOCOL,
                "thinking": True,
                "toolCalls": [
                    {"toolName": "exec", "label": "Running a command"},
                ],
            },
        )

    def test_reporter_clears_presence_when_idle(self):
        fake = FakePresenceClient()
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )

        async def run():
            reporter = presence.TlonComputingPresenceReporter(
                cfg,
                client_factory=lambda _cfg: fake,
            )
            await reporter.publish(
                conversation_id="~mug",
                thinking=False,
                tool_names=[],
            )
            await reporter.close()

        asyncio.run(run())

        self.assertEqual(
            fake.pokes[0],
            (
                "presence",
                "presence-action-1",
                {
                    "clear": {
                        "context": "/dm/~mug",
                        "ship": "~zod",
                        "topic": "computing",
                    }
                },
            ),
        )


class PresenceTrackerTests(unittest.TestCase):
    def test_tracker_publishes_start_tool_updates_and_stop(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                keepalive_interval_ms=0,
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            await tracker.add_tool_call(
                conversation_id="~mug",
                run_id="run-1",
                tool_name="web_fetch",
            )
            await tracker.add_tool_call(
                conversation_id="~mug",
                run_id="run-1",
                tool_name="web_fetch",
            )
            await tracker.clear_tool_calls(conversation_id="~mug", run_id="run-1")
            await tracker.stop_run(conversation_id="~mug", run_id="run-1")

        asyncio.run(run())

        self.assertEqual(
            reporter.published,
            [
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
                {"conversation_id": "~mug", "thinking": True, "tool_names": ["web_fetch"]},
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
                {"conversation_id": "~mug", "thinking": False, "tool_names": []},
            ],
        )

    def test_tracker_unions_active_runs(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                keepalive_interval_ms=0,
            )
            await tracker.refresh_run(conversation_id="chat/~pen/general", run_id="run-1")
            await tracker.add_tool_call(
                conversation_id="chat/~pen/general",
                run_id="run-1",
                tool_name="tlon",
            )
            await tracker.refresh_run(conversation_id="chat/~pen/general", run_id="run-2")
            await tracker.add_tool_call(
                conversation_id="chat/~pen/general",
                run_id="run-2",
                tool_name="terminal",
            )
            await tracker.stop_run(conversation_id="chat/~pen/general", run_id="run-1")

        asyncio.run(run())

        self.assertEqual(
            reporter.published[-1],
            {
                "conversation_id": "chat/~pen/general",
                "thinking": True,
                "tool_names": ["terminal"],
            },
        )

    def test_tracker_republishes_unchanged_active_state_after_max_age(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                max_publish_age_ms=0,
                keepalive_interval_ms=0,
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")

        asyncio.run(run())

        self.assertEqual(
            reporter.published,
            [
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
            ],
        )

    def test_tracker_keepalive_republishes_active_state(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                max_publish_age_ms=0,
                keepalive_interval_ms=5,
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            deadline = time.monotonic() + 0.5
            while len(reporter.published) < 2 and time.monotonic() < deadline:
                await asyncio.sleep(0.001)
            await tracker.stop_run(conversation_id="~mug", run_id="run-1")
            await tracker.close()

        asyncio.run(run())

        active_publishes = [
            item for item in reporter.published if item["thinking"] is True
        ]
        self.assertGreaterEqual(len(active_publishes), 2)

    def test_keepalive_refresh_does_not_resurrect_stopped_run(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                keepalive_interval_ms=0,
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            await tracker.stop_run(conversation_id="~mug", run_id="run-1")
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")

        asyncio.run(run())

        self.assertEqual(
            reporter.published,
            [
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
                {"conversation_id": "~mug", "thinking": False, "tool_names": []},
            ],
        )

    def test_tool_call_resumes_stopped_run(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                keepalive_interval_ms=0,
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            await tracker.stop_run(conversation_id="~mug", run_id="run-1")
            await tracker.add_tool_call(
                conversation_id="~mug",
                run_id="run-1",
                tool_name="exec",
            )
            await tracker.refresh_run(conversation_id="~mug", run_id="run-1")
            await tracker.stop_run(conversation_id="~mug", run_id="run-1")
            return dict(tracker._last_published_state)

        last_published_state = asyncio.run(run())

        self.assertEqual(
            reporter.published[-2:],
            [
                {"conversation_id": "~mug", "thinking": True, "tool_names": ["exec"]},
                {"conversation_id": "~mug", "thinking": False, "tool_names": []},
            ],
        )
        self.assertEqual(last_published_state, {})

    def test_hook_bridge_updates_active_tracker_from_session_env(self):
        reporter = RecordingReporter()

        async def run():
            tracker = presence.TlonComputingPresenceTracker(
                reporter=reporter,
                min_update_interval_ms=0,
                keepalive_interval_ms=0,
            )
            tracker.bind_loop(asyncio.get_running_loop())
            presence.set_active_computing_presence_tracker(tracker)
            try:
                await tracker.refresh_run(conversation_id="~mug", run_id="170.141")
                with patch.dict(
                    os.environ,
                    {
                        "HERMES_SESSION_PLATFORM": "tlon",
                        "HERMES_SESSION_CHAT_ID": "~mug",
                        "HERMES_SESSION_MESSAGE_ID": "170.141",
                    },
                    clear=False,
                ):
                    presence.handle_pre_tool_call(tool_name="tlon")
                    await asyncio.sleep(0)
                    presence.handle_post_api_request(assistant_content_chars=12)
                    await asyncio.sleep(0)
            finally:
                presence.clear_active_computing_presence_tracker(tracker)

        asyncio.run(run())

        self.assertEqual(
            reporter.published,
            [
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
                {"conversation_id": "~mug", "thinking": True, "tool_names": ["tlon"]},
                {"conversation_id": "~mug", "thinking": True, "tool_names": []},
            ],
        )


if __name__ == "__main__":
    unittest.main()
