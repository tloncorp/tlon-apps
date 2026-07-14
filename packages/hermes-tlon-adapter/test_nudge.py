import asyncio
import importlib.util
import json
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_nudge_testpkg"
package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


def load_module(name):
    spec = importlib.util.spec_from_file_location(
        f"{PACKAGE_NAME}.{name}", PACKAGE_DIR / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


tlon_api = load_module("tlon_api")
owner_listen = load_module("owner_listen")
nudge = load_module("nudge")


class NudgeDecisionTests(unittest.TestCase):
    def test_stage_boundaries_and_bad_day_values(self):
        self.assertEqual(
            [nudge.compute_target_stage(days) for days in (6, 7, 13, 14, 29, 30)],
            [None, 1, 1, 2, 2, 3],
        )
        self.assertEqual(nudge.days_between(float("nan"), 1), 0)
        self.assertEqual(nudge.days_between(2, 1), 0)
        self.assertEqual(nudge.days_between(0, 2 * 86_400_000 + 1), 2)

    def test_active_hours_overlay_and_windows(self):
        snapshot = nudge.NudgeSettingsSnapshot(
            active_hours_start="bad",
            active_hours_end="24:00",
            active_hours_timezone="America/Chicago",
        )
        active = nudge.resolve_active_hours(
            snapshot,
            nudge.ActiveHoursBaseline(
                start="08:00", end="bad", timezone="bad", user_timezone="UTC"
            ),
        )
        self.assertEqual(active.start, "08:00")
        self.assertEqual(active.end, "24:00")
        self.assertEqual(active.timezone, "America/Chicago")
        utc_noon = int(datetime(2024, 1, 1, 12, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertFalse(
            nudge.in_active_hours(utc_noon, nudge.ActiveHours("00:00", "00:00", "UTC"))
        )
        utc_midnight = int(
            datetime(2024, 1, 1, 0, tzinfo=timezone.utc).timestamp() * 1000
        )
        self.assertTrue(
            nudge.in_active_hours(
                utc_midnight, nudge.ActiveHours("22:00", "06:00", "UTC")
            )
        )
        self.assertTrue(
            nudge.in_active_hours(utc_noon, nudge.ActiveHours("00:00", "24:00", "UTC"))
        )
        self.assertEqual(
            nudge.resolve_active_hours(
                nudge.NudgeSettingsSnapshot(active_hours_timezone="user"),
                nudge.ActiveHoursBaseline(user_timezone="America/Los_Angeles"),
            ).timezone,
            "America/Los_Angeles",
        )

    def test_date_only_is_utc_and_parsers_are_strict(self):
        snapshot = nudge.NudgeSettingsSnapshot(last_owner_message_date="2024-01-02")
        self.assertEqual(
            nudge.resolve_last_owner_instant(None, snapshot), 1_704_153_600_000
        )
        valid = nudge.parse_pending_nudge(
            '{"sentAt":1,"stage":1,"ownerShip":"~ten","accountId":"hermes","extra":true}'
        )
        self.assertIsNotNone(valid)
        self.assertIsNone(nudge.parse_pending_nudge({"sentAt": True, "stage": 1, "ownerShip": "~ten", "accountId": "hermes"}))
        self.assertIsNone(nudge.parse_pending_nudge({"sentAt": 1, "stage": True, "ownerShip": "~ten", "accountId": "hermes"}))
        self.assertEqual(
            [nudge.parse_last_nudge_stage(value) for value in (1, "1", "1.0", "1e0", True, "0x1")],
            [1, 1, 1, 1, None, None],
        )
        record = nudge.PendingNudge(1, 1, "~ten", "hermes")
        self.assertTrue(nudge.is_nudge_eligible(record, 1 + nudge.DEFAULT_ATTRIBUTION_WINDOW_MS))
        self.assertFalse(nudge.is_nudge_eligible(record, 2 + nudge.DEFAULT_ATTRIBUTION_WINDOW_MS))

    def test_stage_parsers_reject_oversized_integers(self):
        oversized = 10**400
        self.assertEqual(
            [
                nudge.parse_last_nudge_stage(value)
                for value in (
                    1,
                    2,
                    3,
                    1.0,
                    2.0,
                    3.0,
                    "1",
                    "1.0",
                    "1e0",
                    -1,
                    oversized,
                    -oversized,
                )
            ],
            [1, 2, 3, 1, 2, 3, 1, 1, 1, None, None, None],
        )
        self.assertIsNone(
            nudge.parse_pending_nudge(
                json.dumps(
                    {
                        "sentAt": 1,
                        "stage": oversized,
                        "ownerShip": "~ten",
                        "accountId": "hermes",
                    }
                )
            )
        )

    def test_shared_settings_contract(self):
        fixture = json.loads(
            (PACKAGE_DIR / "fixtures/nudge-settings-contract.json").read_text()
        )
        for case in fixture["buckets"]:
            snapshot = nudge.NudgeSettingsSnapshot.from_bucket(case["bucket"])
            pending = nudge.parse_pending_nudge(snapshot.pending_nudge_raw)
            raw_at = snapshot.last_owner_message_at
            normalized = {
                "lastOwnerMessageAt": (
                    raw_at
                    if isinstance(raw_at, (int, float)) and not isinstance(raw_at, bool)
                    else None
                ),
                "lastOwnerMessageDate": (
                    snapshot.last_owner_message_date
                    if isinstance(snapshot.last_owner_message_date, str)
                    else None
                ),
                "pendingNudge": pending.to_wire() if pending else None,
                "lastNudgeStage": nudge.parse_last_nudge_stage(
                    snapshot.last_nudge_stage
                ),
                "nudgeActiveHoursStart": (
                    snapshot.active_hours_start
                    if isinstance(snapshot.active_hours_start, str)
                    else None
                ),
                "nudgeActiveHoursEnd": (
                    snapshot.active_hours_end
                    if isinstance(snapshot.active_hours_end, str)
                    else None
                ),
                "nudgeActiveHoursTimezone": (
                    snapshot.active_hours_timezone
                    if isinstance(snapshot.active_hours_timezone, str)
                    else None
                ),
            }
            self.assertEqual(
                normalized,
                case["expected"],
                case["name"],
            )
        self.assertEqual(
            nudge.PendingNudge(1_700_000_000_123, 3, "~ten", "hermes", "round trip").to_settings_value(),
            fixture["pythonSerializedPendingNudge"],
        )


class NudgeSchedulerTests(unittest.IsolatedAsyncioTestCase):
    async def test_stage_is_persisted_before_send_and_pending_after(self):
        calls = []
        snapshot = nudge.NudgeSettingsSnapshot(last_owner_message_at=0)
        stage = 0
        pending = None

        async def poke(_app, _mark, payload):
            calls.append(payload)

        async def send_dm(_text, sent_at):
            calls.append(("send", sent_at))
            return tlon_api.TlonSendResult(True, ("tlon",))

        activity_queue = nudge.OwnerActivityPersistence(poke=poke)
        pending_queue = nudge.PendingNudgePersistence(poke=poke)
        scheduler = nudge.TlonNudgeScheduler(
            enabled=True,
            owner_ship="~ten",
            bot_ship="~zod",
            get_snapshot=lambda: snapshot,
            settings_ready=lambda: True,
            get_activity=lambda: None,
            set_activity=lambda _value: None,
            get_stage=lambda: stage,
            set_stage=lambda value: globals(),
            get_active_hours_baseline=lambda: nudge.ActiveHoursBaseline(
                start="00:00", end="24:00", timezone="UTC"
            ),
            get_pending=lambda: pending,
            set_pending=lambda value: None,
            send_dm=send_dm,
            activity_persistence=activity_queue,
            pending_persistence=pending_queue,
            poke=poke,
            now_ms=lambda: 8 * 86_400_000,
        )
        await scheduler.tick_now()
        await pending_queue.flush()
        self.assertIn("put-entry", calls[0])
        self.assertEqual(calls[0]["put-entry"]["entry-key"], "lastNudgeStage")
        self.assertEqual(calls[1][0], "send")
        self.assertEqual(calls[2]["put-entry"]["entry-key"], "pendingNudge")
