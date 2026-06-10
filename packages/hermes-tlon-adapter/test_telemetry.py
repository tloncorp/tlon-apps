import asyncio
import importlib.util
import logging
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_telemetry_testpkg"

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
load_module("tlon_tool")
telemetry = load_module("telemetry")
presence = load_module("presence")


class FakeClient:
    def __init__(self):
        self.captures = []
        self.identifies = []
        self.flushes = 0
        self.shutdowns = 0

    def capture(self, *, distinct_id, event, properties):
        self.captures.append((distinct_id, event, properties))

    def identify(self, *, distinct_id, properties):
        self.identifies.append((distinct_id, properties))

    def flush(self):
        self.flushes += 1

    def shutdown(self):
        self.shutdowns += 1

    def events(self, name):
        return [props for _, event, props in self.captures if event == name]


def make_config(**env_overrides):
    env = {
        "TLON_NODE_URL": "https://pen.tlon.network",
        "TLON_NODE_ID": "~pen",
        "TLON_ACCESS_CODE": "code",
        "TLON_OWNER_SHIP": "~mug",
        "TLON_TELEMETRY": "true",
        "TLON_TELEMETRY_API_KEY": "phc_test",
    }
    env.update(env_overrides)
    return tlon_api.TlonConfig.from_env(env={k: v for k, v in env.items() if v})


def make_telemetry(**env_overrides):
    fake = FakeClient()
    tel = telemetry.TlonTelemetry(
        make_config(**env_overrides), client_factory=lambda key, host: fake
    )
    return tel, fake


class EnablementTests(unittest.TestCase):
    def test_disabled_by_default(self):
        factory_calls = []
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY=""),
            client_factory=lambda key, host: factory_calls.append(key),
        )
        self.assertFalse(tel.enabled)
        self.assertEqual(factory_calls, [])
        tel.capture("TlonBot Error", {})  # no-op, no raise

    def test_requires_api_key(self):
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY_API_KEY=""),
            client_factory=lambda key, host: FakeClient(),
        )
        self.assertFalse(tel.enabled)

    def test_factory_failure_disables(self):
        def boom(key, host):
            raise ImportError("no posthog")

        tel = telemetry.TlonTelemetry(make_config(), client_factory=boom)
        self.assertFalse(tel.enabled)

    def test_common_props_and_owner_distinct_id(self):
        tel, fake = make_telemetry()
        tel.set_common({"adapterVersion": "0.1.0", "adapterFingerprint": "fp1:abc"})
        tel.capture("TlonBot Error", {"component": "settings"})

        distinct_id, event, props = fake.captures[0]
        self.assertEqual(distinct_id, "~mug")
        self.assertEqual(event, "TlonBot Error")
        self.assertEqual(props["harness"], "hermes")
        self.assertEqual(props["botShip"], "~pen")
        self.assertEqual(props["ownerShip"], "~mug")
        self.assertEqual(props["adapterVersion"], "0.1.0")
        self.assertEqual(props["component"], "settings")

    def test_identifies_owner_once_with_bot_attributes(self):
        tel, fake = make_telemetry()
        tel.capture("TlonBot Error", {})
        tel.capture("TlonBot Error", {})

        self.assertEqual(len(fake.identifies), 1)
        distinct_id, props = fake.identifies[0]
        self.assertEqual(distinct_id, "~mug")
        self.assertEqual(props["tlonOwnerShip"], "~mug")
        self.assertEqual(props["tlonBotShip"], "~pen")
        self.assertEqual(props["harness"], "hermes")

    def test_identify_falls_back_to_set_on_posthog_7(self):
        # posthog-python >= 7 removed identify(); set() is the replacement.
        class SetOnlyClient:
            def __init__(self):
                self.captures = []
                self.sets = []

            def capture(self, *, distinct_id, event, properties):
                self.captures.append((distinct_id, event, properties))

            def set(self, *, distinct_id, properties):
                self.sets.append((distinct_id, properties))

            def flush(self):
                pass

        fake = SetOnlyClient()
        tel = telemetry.TlonTelemetry(make_config(), client_factory=lambda key, host: fake)
        tel.capture("TlonBot Error", {})

        self.assertEqual(len(fake.sets), 1)
        distinct_id, props = fake.sets[0]
        self.assertEqual(distinct_id, "~mug")
        self.assertEqual(props["tlonBotShip"], "~pen")
        self.assertEqual(tel._identified_as, "~mug")

    def test_identify_unavailable_is_reported_in_status(self):
        class CaptureOnlyClient:
            def capture(self, *, distinct_id, event, properties):
                pass

        tel = telemetry.TlonTelemetry(
            make_config(), client_factory=lambda key, host: CaptureOnlyClient()
        )
        tel.capture("TlonBot Error", {})

        self.assertEqual(tel._identified_as, "")
        self.assertIn(
            "Identify: attempted but failed or unavailable", tel.status_report()
        )

    def test_no_owner_skips_events_entirely(self):
        tel, fake = make_telemetry(TLON_OWNER_SHIP="")
        self.assertTrue(tel.enabled)
        tel.capture("TlonBot Error", {"component": "settings"})
        self.assertEqual(fake.captures, [])
        self.assertEqual(fake.identifies, [])

    def test_flush_keeps_client_close_shuts_down(self):
        tel, fake = make_telemetry()
        tel.flush()
        self.assertTrue(tel.enabled)
        self.assertEqual(fake.flushes, 1)
        tel.close()
        self.assertFalse(tel.enabled)
        self.assertEqual(fake.shutdowns, 1)


class ScrubTests(unittest.TestCase):
    def test_scrub_masks_ships_and_truncates(self):
        detail = telemetry.scrub_detail(
            "poke failed for ~sampel-palnet in chat/~zod/general\nsecond line"
        )
        self.assertNotIn("sampel", detail)
        self.assertNotIn("~zod", detail)
        self.assertNotIn("second line", detail)
        self.assertIn("chat/~…/general", detail)

        long = telemetry.scrub_detail("x" * 500)
        self.assertLessEqual(len(long), telemetry.ERROR_DETAIL_MAX_CHARS)


class CliLabelTests(unittest.TestCase):
    def test_command_labels_drop_arguments(self):
        self.assertEqual(
            telemetry.cli_command_label(["posts", "send", "chat/~pen/general", "hi"]),
            "posts send",
        )
        self.assertEqual(telemetry.cli_command_label(["dms", "accept", "~ten"]), "dms accept")
        self.assertEqual(
            telemetry.cli_command_label(["upload", "https://example.com/x.png"]),
            "upload",
        )
        self.assertEqual(telemetry.cli_command_label(["--version"]), "--version")
        self.assertEqual(
            telemetry.cli_command_label(["--url", "https://x", "groups", "list"]),
            "groups list",
        )
        self.assertEqual(telemetry.cli_command_label([]), "unknown")

    def test_command_parts_segment_root_action_and_flags(self):
        parts = telemetry.cli_command_parts(
            [
                "groups",
                "create-owned",
                "Project Space",
                "--owner",
                "~ten",
                "--description",
                "secret plans",
            ]
        )
        self.assertEqual(parts["command"], "groups create-owned")
        self.assertEqual(parts["commandRoot"], "groups")
        self.assertEqual(parts["commandAction"], "create-owned")
        self.assertEqual(parts["commandFlags"], ["--description", "--owner"])
        self.assertNotIn("~ten", str(parts))
        self.assertNotIn("secret", str(parts))

    def test_command_parts_flag_values_and_equals_form(self):
        parts = telemetry.cli_command_parts(
            ["contacts", "update-profile", "--nickname=Mr Arvo", "--avatar", "https://x"]
        )
        self.assertEqual(parts["commandRoot"], "contacts")
        self.assertEqual(parts["commandAction"], "update-profile")
        self.assertEqual(parts["commandFlags"], ["--avatar", "--nickname"])
        self.assertNotIn("Arvo", str(parts))

    def test_command_parts_global_flag(self):
        parts = telemetry.cli_command_parts(["--version"])
        self.assertEqual(parts["commandRoot"], "--version")
        self.assertIsNone(parts["commandAction"])
        self.assertEqual(parts["commandFlags"], [])


class ReplyTraceTests(unittest.TestCase):
    def test_full_reply_flow(self):
        tel, fake = make_telemetry()
        tel.start_reply(
            "~ten",
            chat_type="dm",
            is_thread=False,
            sender_role="user",
            dispatch_reason="dm",
        )
        tel.record_tool_call("~ten", tool_name="web_search", duration_ms=120, error=None)
        tel.record_tool_call("~ten", tool_name="tlon", duration_ms=80, error="timeout")
        tel.record_api_request("~ten", model="hermes-4", provider="openrouter")
        with telemetry.cli_context("model_tool", conversation="~ten"):
            tel.observe_cli(
                ["groups", "list"],
                42,
                tlon_api.TlonSendResult(success=True, command=("tlon", "groups", "list")),
            )
        tel.record_delivery("~ten", content="hello there friend", success=True)
        tel.finish_reply("~ten")

        replies = fake.events("TlonBot Reply Handled")
        self.assertEqual(len(replies), 1)
        props = replies[0]
        self.assertEqual(props["outcome"], "responded")
        self.assertEqual(props["chatType"], "dm")
        self.assertEqual(props["dispatchReason"], "dm")
        self.assertEqual(props["deliveredMessageCount"], 1)
        self.assertEqual(props["replyWordCount"], 3)
        self.assertEqual(props["model"], "hermes-4")
        self.assertEqual(props["provider"], "openrouter")
        self.assertEqual(props["toolUsage"]["names"], ["web_search", "tlon"])
        self.assertEqual(props["toolUsage"]["errorCount"], 1)
        self.assertEqual(props["toolUsage"]["totalDurationMs"], 200)
        self.assertEqual(props["cliUsage"]["names"], ["groups list"])
        self.assertGreaterEqual(props["dispatchDurationMs"], 0)
        # the CLI call also emitted its own event
        self.assertEqual(len(fake.events("TlonBot CLI Call")), 1)

    def test_outcomes(self):
        tel, fake = make_telemetry()
        tel.start_reply("~a", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm")
        tel.finish_reply("~a")
        tel.start_reply("~b", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm")
        tel.record_delivery("~b", content="x", success=False)
        tel.finish_reply("~b")

        outcomes = [props["outcome"] for props in fake.events("TlonBot Reply Handled")]
        self.assertEqual(outcomes, ["no_reply", "error"])

    def test_processing_outcome_distinguishes_failures_from_silence(self):
        tel, fake = make_telemetry()
        cases = [
            ("~a", "failure", False),
            ("~b", "cancelled", False),
            ("~c", "success", False),
            ("~d", "failure", True),  # delivered before the turn failed
        ]
        for conversation, processing_outcome, delivered in cases:
            tel.start_reply(
                conversation,
                chat_type="dm",
                is_thread=False,
                sender_role="user",
                dispatch_reason="dm",
            )
            if delivered:
                tel.record_delivery(conversation, content="hi", success=True)
            tel.finish_reply(conversation, processing_outcome=processing_outcome)

        replies = fake.events("TlonBot Reply Handled")
        self.assertEqual(
            [props["outcome"] for props in replies],
            ["error", "cancelled", "no_reply", "responded"],
        )
        self.assertEqual(
            [props["processingOutcome"] for props in replies],
            ["failure", "cancelled", "success", "failure"],
        )

    def test_stale_trace_emits_abandoned(self):
        tel, fake = make_telemetry()
        tel.start_reply(
            "~hung", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm"
        )
        tel._traces["~hung"].created_at -= telemetry.REPLY_TRACE_TTL_SECONDS + 1
        # Pruning happens on the next trace start.
        tel.start_reply(
            "~fresh", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm"
        )

        replies = fake.events("TlonBot Reply Handled")
        self.assertEqual(len(replies), 1)
        self.assertEqual(replies[0]["outcome"], "abandoned")
        self.assertNotIn("~hung", tel._traces)

    def test_finish_without_trace_is_silent(self):
        tel, fake = make_telemetry()
        tel.finish_reply("~nobody")
        self.assertEqual(fake.captures, [])

    def test_trace_cap(self):
        tel, _ = make_telemetry()
        for index in range(telemetry.MAX_REPLY_TRACES + 10):
            tel.start_reply(
                f"~ship{index}",
                chat_type="dm",
                is_thread=False,
                sender_role="user",
                dispatch_reason="dm",
            )
        self.assertLessEqual(len(tel._traces), telemetry.MAX_REPLY_TRACES)


class CliObservationTests(unittest.TestCase):
    def test_cli_event_properties(self):
        tel, fake = make_telemetry()
        with telemetry.cli_context("model_tool", conversation="chat/~pen/general"):
            tel.observe_cli(
                ["messages", "channel", "chat/~pen/general", "secret text"],
                150,
                tlon_api.TlonSendResult(
                    success=False, command=("tlon",), returncode=124, error="timed out"
                ),
            )
        props = fake.events("TlonBot CLI Call")[0]
        self.assertEqual(props["command"], "messages channel")
        self.assertEqual(props["commandRoot"], "messages")
        self.assertEqual(props["commandAction"], "channel")
        self.assertEqual(props["origin"], "model_tool")
        self.assertEqual(props["errorKind"], "timeout")
        self.assertFalse(props["success"])
        self.assertNotIn("secret", str(props))

    def test_successful_plumbing_sends_are_suppressed(self):
        tel, fake = make_telemetry()
        tel.start_reply(
            "~ten", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm"
        )
        ok = tlon_api.TlonSendResult(success=True, command=("tlon",))
        for origin in ("delivery", "control_plane", "owner_notification"):
            with telemetry.cli_context(origin, conversation="~ten"):
                tel.observe_cli(["posts", "send", "~ten", "hi"], 20, ok)

        self.assertEqual(fake.events("TlonBot CLI Call"), [])
        # reply rollup stays clean of plumbing too
        tel.record_delivery("~ten", content="hi", success=True)
        tel.finish_reply("~ten")
        reply = fake.events("TlonBot Reply Handled")[0]
        self.assertEqual(reply["cliUsage"]["names"], [])

    def test_failed_plumbing_sends_still_emit(self):
        tel, fake = make_telemetry()
        failed = tlon_api.TlonSendResult(
            success=False, command=("tlon",), returncode=1, error="boom"
        )
        with telemetry.cli_context("delivery", conversation="~ten"):
            tel.observe_cli(["posts", "send", "~ten", "hi"], 20, failed)

        props = fake.events("TlonBot CLI Call")[0]
        self.assertEqual(props["origin"], "delivery")
        self.assertEqual(props["errorKind"], "nonzero")

    def test_observer_through_real_cli(self):
        tel, fake = make_telemetry()

        async def fake_runner(command, env, timeout):
            return tlon_api.TlonProcessResult(returncode=0, stdout="ok")

        cli = tlon_api.TlonCLI(make_config(), runner=fake_runner, observer=tel.observe_cli)
        with telemetry.cli_context("invite_rsvp"):
            asyncio.run(cli.run_command(("dms", "accept", "~ten")))

        props = fake.events("TlonBot CLI Call")[0]
        self.assertEqual(props["command"], "dms accept")
        self.assertEqual(props["origin"], "invite_rsvp")
        self.assertTrue(props["success"])

    def test_default_origin_is_adapter(self):
        tel, fake = make_telemetry()
        tel.observe_cli(["groups", "list"], 5, tlon_api.TlonSendResult(success=True, command=("tlon",)))
        self.assertEqual(fake.events("TlonBot CLI Call")[0]["origin"], "adapter")


class DiscreteEventTests(unittest.TestCase):
    def test_lifecycle_and_admin_events(self):
        tel, fake = make_telemetry()
        tel.gateway_connected({"cliVersion": "0.3.2", "monitoredChannels": 2})
        tel.gateway_disconnected(uptime_seconds=120, reason="shutdown")
        tel.sse_reconnect(attempt=2, delay_seconds=5, error=ConnectionError("ship ~zod away"))
        tel.approval_event("queued", "dm")
        tel.control_command("owner-listen")

        self.assertEqual(
            fake.events("TlonBot Gateway Connected")[0]["cliVersion"], "0.3.2"
        )
        self.assertEqual(
            fake.events("TlonBot Gateway Disconnected")[0]["uptimeSeconds"], 120
        )
        reconnect = fake.events("TlonBot SSE Reconnect")[0]
        self.assertEqual(reconnect["attempt"], 2)
        self.assertEqual(reconnect["errorType"], "ConnectionError")
        self.assertNotIn("~zod", reconnect["detail"])
        self.assertEqual(
            fake.events("TlonBot Approval Event")[0],
            {**fake.events("TlonBot Approval Event")[0], "action": "queued", "requestType": "dm"},
        )
        self.assertEqual(
            fake.events("TlonBot Control Command")[0]["command"], "owner-listen"
        )

    def test_gateway_status_error_callback(self):
        recorded = []
        status = tlon_api.TlonGatewayStatus(
            make_config(), on_error=lambda operation, exc: recorded.append((operation, exc))
        )
        boom = RuntimeError("heartbeat poke failed")
        status._report_error("heartbeat", boom)
        self.assertEqual(recorded, [("heartbeat", boom)])

        raising = tlon_api.TlonGatewayStatus(
            make_config(), on_error=lambda operation, exc: 1 / 0
        )
        raising._report_error("stop", boom)  # reporter failures are swallowed

    def test_presence_error_callback(self):
        recorded = []

        class FailingReporter:
            async def publish(self, **kwargs):
                raise ConnectionError("presence poke failed")

            async def close(self):
                pass

        tracker = presence.TlonComputingPresenceTracker(
            reporter=FailingReporter(),
            on_error=lambda action, exc: recorded.append((action, type(exc).__name__)),
        )
        asyncio.run(tracker.refresh_run(conversation_id="~ten", run_id="r1"))
        self.assertEqual(recorded, [("refresh", "ConnectionError")])

    def test_error_event_for_exception_and_string(self):
        tel, fake = make_telemetry()
        tel.error("settings", ValueError("bad value from ~zod"), operation="persist", key="dmAllowlist")
        tel.error("approval", "notification send failed")

        first, second = fake.events("TlonBot Error")
        self.assertEqual(first["errorType"], "ValueError")
        self.assertEqual(first["key"], "dmAllowlist")
        self.assertNotIn("~zod", first["detail"])
        self.assertEqual(second["errorType"], "error")


class DiagnosticsHelperTests(unittest.TestCase):
    def test_mask_api_key(self):
        self.assertEqual(telemetry.mask_api_key(""), "not set")
        self.assertEqual(telemetry.mask_api_key("  "), "not set")
        self.assertEqual(telemetry.mask_api_key("short"), "set (5 chars)")
        self.assertEqual(
            telemetry.mask_api_key("phc_abcdefghijklmnop"), "phc_…mnop (20 chars)"
        )

    def test_config_source(self):
        self.assertEqual(
            telemetry.config_source("telemetry", env={"TLON_TELEMETRY": "true"}),
            "env TLON_TELEMETRY",
        )
        self.assertEqual(
            telemetry.config_source("telemetry", extra={"telemetry": True}, env={}),
            "config telemetry",
        )
        self.assertEqual(
            telemetry.config_source(
                "owner", extra={"owner_ship": "~mug"}, env={"TLON_OWNER_SHIP": "~mug"}
            ),
            "env TLON_OWNER_SHIP",
        )
        self.assertEqual(telemetry.config_source("api_key", env={}), "unset")
        # Blank values do not count as set, mirroring TlonConfig.from_env.
        self.assertEqual(
            telemetry.config_source(
                "api_key", extra={"telemetry_api_key": " "}, env={"TLON_TELEMETRY_API_KEY": ""}
            ),
            "unset",
        )

    def test_command_detection(self):
        self.assertTrue(telemetry.is_telemetry_command("/tlon-telemetry"))
        self.assertTrue(telemetry.is_telemetry_command("  /Tlon-Telemetry  "))
        self.assertTrue(telemetry.is_telemetry_command("/tlon-telemetry test"))
        self.assertFalse(telemetry.is_telemetry_command("/tlon-telemetrys"))
        self.assertFalse(telemetry.is_telemetry_command("tlon-telemetry"))
        self.assertEqual(
            telemetry.telemetry_command_args("/tlon-telemetry test"), ["test"]
        )
        self.assertEqual(telemetry.telemetry_command_args("/tlon-telemetry"), [])

    def test_telemetry_debug_config_parsing(self):
        self.assertFalse(make_config().telemetry_debug)
        self.assertTrue(make_config(TLON_TELEMETRY_DEBUG="true").telemetry_debug)
        self.assertTrue(
            tlon_api.TlonConfig.from_env({"telemetry_debug": True}, env={}).telemetry_debug
        )

    def test_posthog_sdk_status_reports_version_or_import_error(self):
        status = telemetry.posthog_sdk_status()
        # Either a version string or a "not importable" diagnosis — never empty.
        self.assertTrue(status)


class DisabledReasonTests(unittest.TestCase):
    def test_flag_off(self):
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY=""), client_factory=lambda key, host: FakeClient()
        )
        self.assertIn("TLON_TELEMETRY is not enabled", tel.disabled_reason)

    def test_missing_api_key(self):
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY_API_KEY=""),
            client_factory=lambda key, host: FakeClient(),
        )
        self.assertIn("TLON_TELEMETRY_API_KEY is not set", tel.disabled_reason)

    def test_client_init_failure(self):
        def boom(key, host):
            raise ImportError("No module named 'posthog'")

        tel = telemetry.TlonTelemetry(make_config(), client_factory=boom)
        self.assertIn("PostHog client init failed", tel.disabled_reason)
        self.assertIn("posthog", tel.disabled_reason)

    def test_enabled_has_no_reason(self):
        tel, _ = make_telemetry()
        self.assertIsNone(tel.disabled_reason)

    def test_off_by_default_logs_at_info(self):
        # The gateway console shows WARNING+ only; a simply-off default must
        # not appear there, so it stays INFO.
        with self.assertLogs(telemetry.logger, level="INFO") as cm:
            telemetry.TlonTelemetry(
                make_config(TLON_TELEMETRY=""),
                client_factory=lambda key, host: FakeClient(),
            )
        self.assertTrue(any(r.levelno == logging.INFO for r in cm.records))
        self.assertFalse(any(r.levelno >= logging.WARNING for r in cm.records))

    def test_requested_but_broken_logs_at_warning(self):
        # Requested (TLON_TELEMETRY=true) but no key — a misconfiguration the
        # operator must see on a default (WARNING+) console.
        with self.assertLogs(telemetry.logger, level="INFO") as cm:
            telemetry.TlonTelemetry(
                make_config(TLON_TELEMETRY_API_KEY=""),
                client_factory=lambda key, host: FakeClient(),
            )
        warnings = [r for r in cm.records if r.levelno >= logging.WARNING]
        self.assertTrue(warnings)
        self.assertIn("telemetry disabled", warnings[0].getMessage())


class DiagnosticsCounterTests(unittest.TestCase):
    def test_capture_counts_and_remembers_last_event(self):
        tel, fake = make_telemetry()
        tel.capture("TlonBot Error", {})
        tel.control_command("owner-listen")

        self.assertEqual(tel._events_captured, 2)
        self.assertEqual(tel._last_event, "TlonBot Control Command")
        self.assertEqual(tel._identified_as, "~mug")

    def test_capture_failure_recorded(self):
        tel, fake = make_telemetry()

        def broken_capture(**kwargs):
            raise RuntimeError("queue full on ~zod")

        fake.capture = broken_capture
        tel.capture("TlonBot Error", {})

        self.assertEqual(tel._events_captured, 0)
        self.assertIn("RuntimeError", tel._last_capture_error)
        self.assertNotIn("~zod", tel._last_capture_error)

    def test_delivery_error_recording_scrubs_and_counts(self):
        tel, _ = make_telemetry()
        tel._record_delivery_error(RuntimeError("401 unauthorized for ~zod"), [1, 2, 3])
        tel._record_delivery_error("connection reset", None)

        self.assertEqual(tel._delivery_failures, 2)
        self.assertIn("connection reset", tel._last_delivery_error)
        report = tel.status_report()
        self.assertIn("Delivery: 2 failed batches", report)
        self.assertNotIn("~zod", report)


class StatusReportTests(unittest.TestCase):
    def test_disabled_report_states_reason(self):
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY=""), client_factory=lambda key, host: FakeClient()
        )
        report = tel.status_report()
        self.assertIn("Telemetry: disabled — TLON_TELEMETRY is not enabled", report)
        self.assertIn("Enabled flag: false", report)
        self.assertIn("API key:", report)
        self.assertIn("PostHog SDK:", report)
        self.assertNotIn("Run /tlon-telemetry test", report)

    def test_enabled_report_shows_identity_and_sources(self):
        fake = FakeClient()
        config = tlon_api.TlonConfig.from_env(
            {
                "node_url": "https://pen.tlon.network",
                "node_id": "~pen",
                "access_code": "code",
                "owner_ship": "~mug",
                "telemetry": True,
                "telemetry_api_key": "phc_abcdefghijklmnop",
            },
            env={},
        )
        tel = telemetry.TlonTelemetry(
            config,
            extra={"telemetry": True, "telemetry_api_key": "phc_abcdefghijklmnop", "owner_ship": "~mug"},
            client_factory=lambda key, host: fake,
        )
        tel.capture("TlonBot Error", {})

        with patch.dict(os.environ, {}, clear=True):
            report = tel.status_report()
        self.assertIn("Telemetry: enabled", report)
        self.assertIn("Enabled flag: true (config telemetry)", report)
        self.assertIn("phc_…mnop (20 chars) (config telemetry_api_key)", report)
        self.assertIn(f"Host: default ({telemetry.DEFAULT_POSTHOG_HOST})", report)
        self.assertIn("Distinct id: ~mug (owner ship, config owner_ship)", report)
        self.assertIn("Bot ship: ~pen", report)
        self.assertIn("Identify: enqueued as ~mug", report)
        self.assertIn("Events enqueued: 1", report)
        self.assertIn("last: TlonBot Error", report)
        self.assertIn("Delivery: no failed batches observed", report)
        self.assertIn("Run /tlon-telemetry test", report)

    def test_blocked_when_owner_missing(self):
        tel, _ = make_telemetry(TLON_OWNER_SHIP="")
        report = tel.status_report()
        self.assertIn("enabled but BLOCKED", report)
        self.assertIn("Distinct id: missing — set TLON_OWNER_SHIP", report)
        self.assertNotIn("Run /tlon-telemetry test", report)

    def test_no_events_yet(self):
        tel, _ = make_telemetry()
        self.assertIn("Events enqueued: none since gateway start", tel.status_report())


class DeliveryTestTests(unittest.TestCase):
    def test_disabled_cannot_test(self):
        tel = telemetry.TlonTelemetry(
            make_config(TLON_TELEMETRY=""), client_factory=lambda key, host: FakeClient()
        )
        self.assertIn("Cannot test: telemetry is disabled", tel.delivery_test())

    def test_missing_owner_cannot_test(self):
        tel, _ = make_telemetry(TLON_OWNER_SHIP="")
        self.assertIn("TLON_OWNER_SHIP is not set", tel.delivery_test())

    def test_success_reports_distinct_id(self):
        tel, fake = make_telemetry()
        result = tel.delivery_test()
        self.assertIn("Test event accepted by PostHog", result)
        self.assertIn("~mug", result)
        self.assertEqual(fake.flushes, 1)
        self.assertEqual(
            fake.captures[-1][1], telemetry.EVENT_TELEMETRY_TEST
        )
        # Reply traces survive, unlike TlonTelemetry.flush().
        tel.start_reply(
            "~ten", chat_type="dm", is_thread=False, sender_role="user", dispatch_reason="dm"
        )
        tel.delivery_test()
        self.assertIn("~ten", tel._traces)

    def test_reports_delivery_failure_seen_during_flush(self):
        tel, fake = make_telemetry()

        def failing_flush():
            tel._record_delivery_error(RuntimeError("401 unauthorized for ~zod"), [1])

        fake.flush = failing_flush
        result = tel.delivery_test()
        self.assertIn("FAILED to deliver", result)
        self.assertIn("RuntimeError", result)
        self.assertNotIn("~zod", result)

    def test_flush_exception_reported(self):
        tel, fake = make_telemetry()

        def raising_flush():
            raise ConnectionError("posthog.com unreachable")

        fake.flush = raising_flush
        self.assertIn("Test flush failed", tel.delivery_test())

    def test_capture_failure_reported(self):
        tel, fake = make_telemetry()

        def broken_capture(**kwargs):
            raise RuntimeError("enqueue exploded")

        fake.capture = broken_capture
        result = tel.delivery_test()
        self.assertIn("could not be enqueued", result)
        self.assertIn("RuntimeError", result)


if __name__ == "__main__":
    unittest.main()
