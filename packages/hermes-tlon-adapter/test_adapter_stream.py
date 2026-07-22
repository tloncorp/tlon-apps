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
PACKAGE_NAME = "hermes_tlon_adapter_stream_testpkg"

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
    def __init__(self, *, text, message_type, source, raw_message, message_id,
                 reply_to_message_id, timestamp, media_urls=None, media_types=None):
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
    def __init__(self, *, success, message_id=None, error=None, raw_response=None,
                 retryable=False, continuation_message_ids=()):
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
        self._fatal_error = None

    def _mark_connected(self):
        self._running = True

    def _mark_disconnected(self):
        self._running = False

    def _set_fatal_error(self, code, message, *, retryable):
        self._fatal_error = {"code": code, "message": message, "retryable": retryable}

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
load_module("lens")
adapter_mod = load_module("adapter")


def make_event(app="channels", path="/v2", event_id=1, msg_id="170.1"):
    return types.SimpleNamespace(
        app=app,
        path=path,
        subscription_id=1,
        event_id=event_id,
        json={"nest": path, "response": {"post": {"id": msg_id}}},
        raw={},
    )


async def _instant_sleep(delay):
    pass


class StreamLoopTests(unittest.TestCase):
    def make_adapter(self, extra=None):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "owner_ship": "~mug",
        }
        base.update(extra or {})
        with patch.dict(os.environ, {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=base))
        adapter._settings_loaded = True
        return adapter

    def _patch_catchups(self, adapter, calls):
        async def record_settings():
            calls.append("settings")
            return True

        async def record_invites():
            calls.append("invites")

        async def record_profile():
            calls.append("profile")

        return [
            patch.object(adapter, "_load_settings_state", record_settings),
            patch.object(adapter, "_process_pending_dm_invites", record_invites),
            patch.object(adapter, "_load_bot_profile", record_profile),
        ]

    def test_transport_error_resumes_same_client(self):
        adapter = self.make_adapter()
        call_count = [0]
        telemetry_events = []
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: telemetry_events.append(kw),
            error=lambda *a, **kw: None,
        )
        dispatched = []

        async def fake_route(event):
            dispatched.append(event)
            adapter._running = False

        adapter._route_stream_event = fake_route

        class ResumeSSE:
            def __init__(self):
                self.last_heard_event_id = -1
                self.events_calls = []

            async def events(self, *, on_open=None):
                self.events_calls.append({"on_open": on_open})
                call_count[0] += 1
                if call_count[0] == 1:
                    if on_open:
                        on_open()
                    raise ConnectionError("Tlon SSE stream ended")
                if on_open:
                    on_open()
                yield make_event(event_id=2)

        sse = ResumeSSE()
        adapter._sse = sse
        calls = []
        patches = self._patch_catchups(adapter, calls)

        async def run():
            with patches[0], patches[1], patches[2]:
                await adapter._run_stream()

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(run())

        self.assertEqual(len(sse.events_calls), 2)
        self.assertEqual(calls, [])
        self.assertEqual(len(dispatched), 1)
        resume_events = [e for e in telemetry_events if e.get("mode") == "resume"]
        self.assertEqual(len(resume_events), 1)
        self.assertEqual(resume_events[0]["attempt"], 1)

    def test_resume_does_not_rerun_catchups(self):
        adapter = self.make_adapter()
        call_count = [0]
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )

        async def fake_route(event):
            adapter._running = False

        adapter._route_stream_event = fake_route

        class ResumeSSE:
            def __init__(self):
                self.last_heard_event_id = -1

            async def events(self, *, on_open=None):
                call_count[0] += 1
                if call_count[0] == 1:
                    if on_open:
                        on_open()
                    raise ConnectionError("Tlon SSE stream ended")
                if on_open:
                    on_open()
                yield make_event(event_id=2)

        adapter._sse = ResumeSSE()
        calls = []
        patches = self._patch_catchups(adapter, calls)

        async def run():
            with patches[0], patches[1], patches[2]:
                await adapter._run_stream()

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(run())
        self.assertEqual(calls, [])

    def test_connect_failure_closes_and_rebuilds(self):
        adapter = self.make_adapter()
        connect_count = [0]
        sse_instances = []

        class FailingConnectSSE:
            def __init__(self, config):
                sse_instances.append(self)
                self.subscribe_calls = []
                self.close_calls = []
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                self.subscribe_calls.append((app, path))
                if len(self.subscribe_calls) == 3 and connect_count[0] == 0:
                    connect_count[0] += 1
                    raise ConnectionError("subscribe failed")
                return len(self.subscribe_calls)

            async def close(self, *, graceful=True):
                self.close_calls.append(graceful)

            async def events(self, *, on_open=None):
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        telemetry_events = []
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: telemetry_events.append(kw),
            error=lambda *a, **kw: None,
        )
        calls = []
        patches = self._patch_catchups(adapter, calls)

        with patch.object(adapter_mod, "TlonSSEClient", FailingConnectSSE):
            async def run():
                with patches[0], patches[1], patches[2]:
                    await adapter._run_stream()
            with patch("asyncio.sleep", _instant_sleep):
                asyncio.run(run())

        self.assertEqual(len(sse_instances), 2)
        self.assertEqual(sse_instances[0].close_calls, [False])
        rebuild_events = [e for e in telemetry_events if e.get("mode") == "rebuild"]
        self.assertTrue(len(rebuild_events) >= 1)

    def test_catchup_failure_closes_and_rebuilds(self):
        adapter = self.make_adapter()
        connect_count = [0]
        close_calls = []

        class CatchupSSE:
            def __init__(self, config):
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                return 1

            async def close(self, *, graceful=True):
                close_calls.append(graceful)

            async def events(self, *, on_open=None):
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )

        async def fail_settings():
            if connect_count[0] == 0:
                connect_count[0] += 1
                raise ConnectionError("settings failed")
            return True

        async def ok_invites():
            pass

        async def ok_profile():
            pass

        with patch.object(adapter_mod, "TlonSSEClient", CatchupSSE):
            with patch.object(adapter, "_load_settings_state", fail_settings), \
                 patch.object(adapter, "_process_pending_dm_invites", ok_invites), \
                 patch.object(adapter, "_load_bot_profile", ok_profile), \
                 patch("asyncio.sleep", _instant_sleep):
                asyncio.run(adapter._run_stream())

        self.assertIn(False, close_calls)
        self.assertEqual(connect_count[0], 1)

    def test_catchup_failure_bot_profile_closes_and_rebuilds(self):
        adapter = self.make_adapter()
        connect_count = [0]
        close_calls = []

        class CatchupSSE:
            def __init__(self, config):
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                return 1

            async def close(self, *, graceful=True):
                close_calls.append(graceful)

            async def events(self, *, on_open=None):
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )

        async def ok_settings():
            return True

        async def ok_invites():
            pass

        async def fail_profile():
            if connect_count[0] == 0:
                connect_count[0] += 1
                raise ConnectionError("profile failed")

        with patch.object(adapter_mod, "TlonSSEClient", CatchupSSE):
            with patch.object(adapter, "_load_settings_state", ok_settings), \
                 patch.object(adapter, "_process_pending_dm_invites", ok_invites), \
                 patch.object(adapter, "_load_bot_profile", fail_profile), \
                 patch("asyncio.sleep", _instant_sleep):
                asyncio.run(adapter._run_stream())

        self.assertIn(False, close_calls)
        self.assertEqual(connect_count[0], 1)

    def test_channel_error_rebuilds_with_full_setup(self):
        adapter = self.make_adapter({"context_lens_enabled": True})
        sse_instances = []

        class RebuildSSE:
            def __init__(self, config):
                sse_instances.append(self)
                self.subscribe_calls = []
                self.close_calls = []
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                self.subscribe_calls.append((app, path, optional))
                return len(self.subscribe_calls)

            async def close(self, *, graceful=True):
                self.close_calls.append(graceful)

            async def events(self, *, on_open=None):
                if len(sse_instances) == 1:
                    raise tlon_api.TlonChannelError("Tlon channel reaped", status=404)
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        telemetry_events = []
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: telemetry_events.append(kw),
            error=lambda *a, **kw: None,
        )
        calls = []
        patches = self._patch_catchups(adapter, calls)

        with patch.object(adapter_mod, "TlonSSEClient", RebuildSSE):
            async def run():
                with patches[0], patches[1], patches[2]:
                    await adapter._run_stream()
            with patch("asyncio.sleep", _instant_sleep):
                asyncio.run(run())

        self.assertEqual(len(sse_instances), 2)
        self.assertEqual(sse_instances[0].close_calls, [False])
        rebuild_events = [e for e in telemetry_events if e.get("mode") == "rebuild"]
        self.assertEqual(len(rebuild_events), 1)
        self.assertEqual(calls, ["settings", "invites", "profile", "settings", "invites", "profile"])
        sub_apps = [s[0] for s in sse_instances[1].subscribe_calls]
        self.assertIn("steward", sub_apps)

    def test_idle_resume_resets_backoff(self):
        adapter = self.make_adapter()
        call_count = [0]
        telemetry_events = []
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: telemetry_events.append(kw),
            error=lambda *a, **kw: None,
        )

        async def fake_route(event):
            pass

        adapter._route_stream_event = fake_route

        class IdleSSE:
            def __init__(self):
                self.last_heard_event_id = -1

            async def events(self, *, on_open=None):
                call_count[0] += 1
                if on_open:
                    on_open()
                if call_count[0] >= 3:
                    adapter._running = False
                    return
                    if False:
                        yield None
                raise ConnectionError("Tlon SSE stream ended")

        adapter._sse = IdleSSE()
        calls = []
        patches = self._patch_catchups(adapter, calls)

        async def run():
            with patches[0], patches[1], patches[2]:
                await adapter._run_stream()

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(run())
        self.assertEqual(len(telemetry_events), 2)
        self.assertEqual(telemetry_events[0]["attempt"], 1)
        self.assertEqual(telemetry_events[1]["attempt"], 1)

    def test_401_403_ship_code_rebuilds(self):
        for status in (401, 403):
            with self.subTest(status=status):
                adapter = self.make_adapter()
                sse_instances = []

                class AuthSSE:
                    def __init__(self, config):
                        sse_instances.append(self)
                        self.last_heard_event_id = -1

                    async def authenticate(self):
                        return "cookie"

                    async def open(self):
                        pass

                    async def subscribe(self, app, path, *, optional=False):
                        return 1

                    async def close(self, *, graceful=True):
                        pass

                    async def events(self, *, on_open=None):
                        if len(sse_instances) == 1:
                            raise tlon_api.TlonChannelError(
                                f"Tlon channel unauthorized: HTTP {status}", status=status
                            )
                        if on_open:
                            on_open()
                        adapter._running = False
                        if False:
                            yield None

                adapter._telemetry = types.SimpleNamespace(
                    sse_reconnect=lambda **kw: None,
                    error=lambda *a, **kw: None,
                )
                calls = []
                patches = self._patch_catchups(adapter, calls)

                with patch.object(adapter_mod, "TlonSSEClient", AuthSSE):
                    async def run():
                        with patches[0], patches[1], patches[2]:
                            await adapter._run_stream()
                    with patch("asyncio.sleep", _instant_sleep):
                        asyncio.run(run())

                self.assertEqual(len(sse_instances), 2)
                self.assertIsNone(adapter._fatal_error)

    def test_401_fixed_cookie_is_fatal(self):
        adapter = self.make_adapter({"cookie": "urbauth=abc123"})
        close_calls = []

        class FatalSSE:
            def __init__(self):
                self.last_heard_event_id = -1

            async def events(self, *, on_open=None):
                raise tlon_api.TlonChannelError(
                    "Tlon channel unauthorized: HTTP 401", status=401
                )
                if False:
                    yield None

            async def close(self, *, graceful=True):
                close_calls.append(graceful)

        adapter._sse = FatalSSE()
        telemetry_errors = []
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: telemetry_errors.append((a, kw)),
        )

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(adapter._run_stream())

        self.assertIsNotNone(adapter._fatal_error)
        self.assertEqual(adapter._fatal_error["code"], "auth")
        self.assertFalse(adapter._fatal_error["retryable"])
        self.assertEqual(close_calls, [False])
        self.assertEqual(len(telemetry_errors), 1)
        self.assertEqual(telemetry_errors[0][1]["operation"], "channel")
        self.assertIsNone(adapter._sse)

    def test_404_fixed_cookie_still_rebuilds(self):
        adapter = self.make_adapter({"cookie": "urbauth=abc123"})
        sse_instances = []

        class ReapSSE:
            def __init__(self, config):
                sse_instances.append(self)
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                return 1

            async def close(self, *, graceful=True):
                pass

            async def events(self, *, on_open=None):
                if len(sse_instances) == 1:
                    raise tlon_api.TlonChannelError("Tlon channel reaped", status=404)
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )
        calls = []
        patches = self._patch_catchups(adapter, calls)

        with patch.object(adapter_mod, "TlonSSEClient", ReapSSE):
            async def run():
                with patches[0], patches[1], patches[2]:
                    await adapter._run_stream()
            with patch("asyncio.sleep", _instant_sleep):
                asyncio.run(run())

        self.assertEqual(len(sse_instances), 2)
        self.assertIsNone(adapter._fatal_error)

    def test_auth_error_is_fatal(self):
        adapter = self.make_adapter()

        class AuthErrSSE:
            def __init__(self):
                self.last_heard_event_id = -1

            async def events(self, *, on_open=None):
                raise tlon_api.TlonAuthError("Tlon auth rejected: HTTP 401")
                if False:
                    yield None

            async def close(self, *, graceful=True):
                pass

        adapter._sse = AuthErrSSE()
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(adapter._run_stream())

        self.assertIsNotNone(adapter._fatal_error)
        self.assertEqual(adapter._fatal_error["code"], "auth")
        self.assertFalse(adapter._fatal_error["retryable"])

    def test_rebuild_dedup_same_message_id(self):
        adapter = self.make_adapter({"free_response_channels": ["chat/~pen/general"]})
        dispatched = []
        sse_instances = []

        def make_channel_event(event_id, msg_id):
            return types.SimpleNamespace(
                app="channels",
                path="/v2",
                subscription_id=1,
                event_id=event_id,
                json={
                    "nest": "chat/~pen/general",
                    "response": {
                        "post": {
                            "id": msg_id,
                            "r-post": {
                                "set": {
                                    "essay": {
                                        "author": "~mug",
                                        "sent": 1000,
                                        "content": [{"inline": ["hello"]}],
                                    }
                                }
                            },
                        }
                    },
                },
                raw={},
            )

        class DedupRebuildSSE:
            def __init__(self, config):
                sse_instances.append(self)
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                return 1

            async def close(self, *, graceful=True):
                pass

            async def scry(self, path):
                raise ConnectionError("no scry")

            async def events(self, *, on_open=None):
                if len(sse_instances) == 1:
                    if on_open:
                        on_open()
                    yield make_channel_event(event_id=1, msg_id="170.1")
                    raise tlon_api.TlonChannelError("Tlon channel reaped", status=404)
                if on_open:
                    on_open()
                yield make_channel_event(event_id=5, msg_id="170.1")
                adapter._running = False

        async def record_dispatch(message, **kwargs):
            dispatched.append(message)

        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )
        calls = []
        patches = self._patch_catchups(adapter, calls)

        with patch.object(adapter_mod, "TlonSSEClient", DedupRebuildSSE), \
             patch.object(adapter, "_dispatch_message", record_dispatch):
            async def run():
                with patches[0], patches[1], patches[2]:
                    await adapter._run_stream()
            with patch("asyncio.sleep", _instant_sleep):
                asyncio.run(run())

        self.assertEqual(len(sse_instances), 2)
        self.assertEqual(len(dispatched), 1)
        self.assertEqual(dispatched[0].message_id, "170.1")

    def test_stream_generator_closed_on_exit(self):
        adapter = self.make_adapter()
        gen_closed = [False]

        class GenSSE:
            def __init__(self):
                self.last_heard_event_id = -1

            async def events(self, *, on_open=None):
                if on_open:
                    on_open()
                yield make_event(event_id=1)
                try:
                    yield make_event(event_id=2)
                except GeneratorExit:
                    gen_closed[0] = True
                    raise

        adapter._sse = GenSSE()
        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )

        async def fake_route(event):
            adapter._running = False

        adapter._route_stream_event = fake_route
        calls = []
        patches = self._patch_catchups(adapter, calls)

        async def run():
            with patches[0], patches[1], patches[2]:
                await adapter._run_stream()

        with patch("asyncio.sleep", _instant_sleep):
            asyncio.run(run())
        self.assertTrue(gen_closed[0])


    def test_setup_failure_logs_warning(self):
        adapter = self.make_adapter()
        connect_count = [0]

        class FailingSetupSSE:
            def __init__(self, config):
                self.last_heard_event_id = -1

            async def authenticate(self):
                return "cookie"

            async def open(self):
                pass

            async def subscribe(self, app, path, *, optional=False):
                if connect_count[0] == 0:
                    connect_count[0] += 1
                    raise ConnectionError("ship unreachable")
                return 1

            async def close(self, *, graceful=True):
                pass

            async def events(self, *, on_open=None):
                if on_open:
                    on_open()
                adapter._running = False
                if False:
                    yield None

        adapter._telemetry = types.SimpleNamespace(
            sse_reconnect=lambda **kw: None,
            error=lambda *a, **kw: None,
        )
        calls = []
        patches = self._patch_catchups(adapter, calls)

        with patch.object(adapter_mod, "TlonSSEClient", FailingSetupSSE):
            async def run():
                with patches[0], patches[1], patches[2]:
                    await adapter._run_stream()
            with patch("asyncio.sleep", _instant_sleep):
                with self.assertLogs(adapter_mod.logger.name, level="WARNING") as cm:
                    asyncio.run(run())

        self.assertTrue(
            any("SSE setup failed" in msg for msg in cm.output),
            f"Expected 'SSE setup failed' in log output: {cm.output}",
        )


if __name__ == "__main__":
    unittest.main()
