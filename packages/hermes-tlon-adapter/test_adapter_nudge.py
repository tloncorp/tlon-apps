import asyncio
import importlib.util
import json
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_nudge_adapter_testpkg"
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


class MessageEvent:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class SendResult:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


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

    async def handle_message(self, _event):
        return None


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
sys.modules.update(
    {
        "gateway": gateway,
        "gateway.config": gateway_config,
        "gateway.platforms": gateway_platforms,
        "gateway.platforms.base": gateway_base,
    }
)


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
adapter_mod = load_module("adapter")
nudge = sys.modules[f"{PACKAGE_NAME}.nudge"]


class RecordingSSE:
    def __init__(self):
        self.pokes = []

    async def poke(self, app, mark, payload):
        self.pokes.append((app, mark, payload))


class HeldScrySSE(RecordingSSE):
    def __init__(self, payload):
        super().__init__()
        self.payload = payload
        self.scry_started = asyncio.Event()
        self.release_scry = asyncio.Event()

    async def scry(self, _path):
        self.scry_started.set()
        await self.release_scry.wait()
        return self.payload


class FailThenHeldScrySSE(HeldScrySSE):
    def __init__(self, payload):
        super().__init__(payload)
        self.scry_calls = 0

    async def scry(self, path):
        self.scry_calls += 1
        if self.scry_calls == 1:
            raise ConnectionError("boot scry failed")
        return await super().scry(path)


class SlowAuthenticateSSE:
    instances = []

    def __init__(self, _config):
        self.authenticate_started = asyncio.Event()
        self.release_authenticate = asyncio.Event()
        self.ready = False
        self.poke_attempts = 0
        self.pokes = []
        self.closed = False
        type(self).instances.append(self)

    async def authenticate(self):
        self.authenticate_started.set()
        await self.release_authenticate.wait()
        self.ready = True

    async def open(self):
        assert self.ready

    async def subscribe(self, _app, _path):
        assert self.ready

    async def poke(self, app, mark, payload):
        self.poke_attempts += 1
        if not self.ready:
            raise tlon_api.TlonTerminalActionError("HTTP 403 settings rejected")
        self.pokes.append((app, mark, payload))

    async def close(self, *, graceful=True):
        self.closed = True


class RecordingCLI:
    def __init__(self):
        self.sends = []

    async def send_message(self, chat_id, text, *, blob=None, sent_at=None):
        self.sends.append((chat_id, text, sent_at))
        return tlon_api.TlonSendResult(True, ("tlon", "posts", "send"))


def make_adapter(*, reengagement_enabled=True):
    adapter = adapter_mod.TlonAdapter(
        PlatformConfig(
            {
                "node_url": "https://zod.tlon.network",
                "node_id": "~zod",
                "access_code": "code",
                "owner_ship": "~ten",
                "reengagement_enabled": reengagement_enabled,
                "nudge_tick_interval_ms": 60_000,
            }
        )
    )
    adapter._sse = RecordingSSE()
    adapter._cli = RecordingCLI()
    adapter._nudge_settings_ready = True
    return adapter


class AdapterNudgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_tick_persists_stage_before_send_and_pending_after(self):
        adapter = make_adapter()
        now = 8 * 86_400_000
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=0,
            active_hours_start="00:00",
            active_hours_end="24:00",
            active_hours_timezone="UTC",
        )
        adapter._nudge_scheduler._now_ms = lambda: now
        await adapter._nudge_scheduler.tick_now()
        await adapter._pending_nudge_persistence.flush()

        self.assertEqual(
            adapter._sse.pokes[0][2]["put-entry"]["entry-key"], "lastNudgeStage"
        )
        self.assertEqual(adapter._cli.sends[0][2], now)
        self.assertEqual(
            adapter._sse.pokes[-1][2]["put-entry"]["entry-key"], "pendingNudge"
        )
        self.assertEqual(adapter._nudge_stage_shadow, 1)

    async def test_owner_reply_clears_stage_after_activity_and_injects_context(self):
        adapter = make_adapter()
        sent_at = 1_700_000_000_000
        adapter._nudge_stage_shadow = 1
        adapter._pending_nudge_rehydrated = True
        adapter._pending_nudge = nudge.PendingNudge(
            sent_at, 1, "~ten", "openclaw", "nudge body"
        )
        message = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am back",
            message_id="reply-1",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp((sent_at + 1_000) / 1000, timezone.utc),
            raw={},
        )
        hook = adapter._observe_nudge_owner_message(message, is_dm=True)
        await adapter._nudge_activity_persistence.flush()
        await adapter._pending_nudge_persistence.flush()

        keys = [
            next(iter(payload.values()))["entry-key"]
            for _, _, payload in adapter._sse.pokes
        ]
        self.assertLess(
            keys.index("lastOwnerMessageAt"), keys.index("lastNudgeStage")
        )
        self.assertLess(
            keys.index("lastOwnerMessageDate"), keys.index("lastNudgeStage")
        )
        self.assertIn("pendingNudge", keys)
        self.assertTrue(hook.inject_context)
        self.assertIsNone(adapter._pending_nudge)

    async def test_owner_activity_persists_while_reengagement_is_disabled(self):
        adapter = make_adapter(reengagement_enabled=False)
        adapter._pending_nudge_rehydrated = True
        message = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am active even with sends disabled",
            message_id="disabled-reply",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_700_000_000, timezone.utc),
            raw={},
        )

        adapter._observe_nudge_owner_message(message, is_dm=True)
        await adapter._nudge_activity_persistence.flush()

        self.assertEqual(adapter._nudge_owner_activity[0], 1_700_000_000_000)
        self.assertEqual(
            {
                next(iter(payload.values()))["entry-key"]
                for _, _, payload in adapter._sse.pokes
            },
            {"lastOwnerMessageAt", "lastOwnerMessageDate"},
        )
        self.assertFalse(adapter._nudge_scheduler.enabled)

    async def test_reconnect_load_does_not_resurrect_local_pending_clear(self):
        pending = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        adapter = make_adapter()
        adapter._pending_nudge_rehydrated = True
        adapter._pending_nudge = None
        adapter._nudge_load_seeded = True
        sse = HeldScrySSE(
            {
                "all": {
                    "moltbot": {"tlon": {"pendingNudge": pending.to_settings_value()}}
                }
            }
        )
        sse.release_scry.set()
        adapter._sse = sse

        self.assertTrue(await adapter._load_nudge_settings_only())
        self.assertIsNone(adapter._pending_nudge)

    async def test_boot_load_rejects_unrepresentable_pending_nudge_sent_at(self):
        for sent_at in (1e20, 10**400):
            with self.subTest(sent_at=repr(sent_at)):
                adapter = make_adapter()
                sse = HeldScrySSE(
                    {
                        "all": {
                            "moltbot": {
                                "tlon": {
                                    "pendingNudge": json.dumps(
                                        {
                                            "sentAt": sent_at,
                                            "stage": 1,
                                            "ownerShip": "~ten",
                                            "accountId": "hermes",
                                        }
                                    )
                                }
                            }
                        }
                    }
                )
                sse.release_scry.set()
                adapter._sse = sse

                self.assertTrue(await adapter._load_nudge_settings_only())
                self.assertTrue(adapter._pending_nudge_rehydrated)
                self.assertIsNone(adapter._pending_nudge)

    async def test_boot_load_rejects_oversized_last_nudge_stage(self):
        for seeded, existing_stage, expected_stage in (
            (False, 0, 0),
            (True, 2, 2),
        ):
            with self.subTest(seeded=seeded):
                adapter = make_adapter()
                adapter._nudge_load_seeded = seeded
                adapter._nudge_stage_shadow = existing_stage
                sse = HeldScrySSE(
                    {
                        "all": {
                            "moltbot": {"tlon": {"lastNudgeStage": 10**400}}
                        }
                    }
                )
                sse.release_scry.set()
                adapter._sse = sse

                self.assertTrue(await adapter._load_nudge_settings_only())
                self.assertEqual(adapter._nudge_stage_shadow, expected_stage)

    async def test_poisoned_pending_nudge_does_not_drop_owner_reply(self):
        adapter = make_adapter()
        adapter._nudge_stage_shadow = 1
        adapter._pending_nudge_rehydrated = True
        adapter._pending_nudge = nudge.PendingNudge(1e20, 1, "~ten", "hermes")
        dispatched = []

        async def record(event):
            dispatched.append(event)

        adapter.handle_message = record
        message = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am back",
            message_id="poisoned-pending-reply",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_700_000_000, timezone.utc),
            raw={},
        )

        hook = adapter._observe_nudge_owner_message(message, is_dm=True)
        self.assertFalse(hook.inject_context)
        await adapter._handle_dm_event({}, message=message, nudge_hook=hook)
        await adapter._nudge_activity_persistence.flush()
        await adapter._pending_nudge_persistence.flush()

        self.assertEqual(len(dispatched), 1)
        self.assertEqual(
            dispatched[0].text, "I am back\n\n[message id: poisoned-pending-reply]"
        )

    async def test_bot_authored_dm_echo_is_not_owner_activity(self):
        # DM parses set user_id to the conversation partner, so with
        # include_self=True the bot's own outbound echo (including the nudge
        # DM itself) arrives with user_id=owner but author_id=bot. It must
        # not clear stage/pending, record activity, or consume dedup space.
        adapter = make_adapter()
        adapter._nudge_load_seeded = True
        adapter._nudge_stage_shadow = 1
        adapter._pending_nudge_rehydrated = True
        pending = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        adapter._pending_nudge = pending

        echo = tlon_api.TlonIncomingMessage(
            chat_id="~ten",
            chat_name="~ten",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="Hey! Quick ideas for your week...",
            message_id="self-echo-1",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_700_000_100, timezone.utc),
            raw={},
            author_id="~zod",
        )

        hook = adapter._observe_nudge_owner_message(echo, is_dm=True)
        await adapter._nudge_activity_persistence.flush()
        await adapter._pending_nudge_persistence.flush()

        self.assertIsNone(hook.pending)
        self.assertFalse(hook.inject_context)
        self.assertEqual(adapter._nudge_stage_shadow, 1)
        self.assertIs(adapter._pending_nudge, pending)
        self.assertNotIn("dm:~ten:self-echo-1", adapter._nudge_seen_ids)
        activity_keys = {
            poke[2].get("put-entry", {}).get("entry-key")
            for poke in adapter._sse.pokes
            if isinstance(poke[2], dict)
        }
        self.assertNotIn("lastOwnerMessageAt", activity_keys)

    async def test_stale_timestamped_owner_edit_does_not_backdate_activity(self):
        # Post edits re-deliver `r-post.set` with the original creation
        # `sent`. After a restart the dedup ring is empty, so without the
        # advance-only guard an owner editing a month-old post would backdate
        # the activity shadow, persist the stale instant, and look 30 days
        # idle to the scheduler.
        adapter = make_adapter()
        adapter._nudge_load_seeded = True
        adapter._nudge_stage_shadow = 1
        adapter._pending_nudge_rehydrated = True
        pending = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        adapter._pending_nudge = pending
        adapter._nudge_owner_activity = (1_700_000_000_000, "2023-11-14")

        month_old_edit = tlon_api.TlonIncomingMessage(
            chat_id="chat/~zod/general",
            chat_name="general",
            chat_type="group",
            user_id="~ten",
            user_name="~ten",
            text="edited an ancient post",
            message_id="ancient-post-1",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_697_000_000, timezone.utc),
            raw={},
            author_id="~ten",
        )

        hook = adapter._observe_nudge_owner_message(month_old_edit, is_dm=False)
        await adapter._nudge_activity_persistence.flush()
        await adapter._pending_nudge_persistence.flush()

        self.assertIsNone(hook.pending)
        self.assertFalse(hook.inject_context)
        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_000, "2023-11-14"))
        self.assertEqual(adapter._nudge_stage_shadow, 1)
        self.assertIs(adapter._pending_nudge, pending)
        activity_keys = {
            poke[2].get("put-entry", {}).get("entry-key")
            for poke in adapter._sse.pokes
            if isinstance(poke[2], dict)
        }
        self.assertNotIn("lastOwnerMessageAt", activity_keys)

    async def test_same_instant_owner_message_still_processes(self):
        adapter = make_adapter()
        adapter._nudge_load_seeded = True
        adapter._nudge_stage_shadow = 1
        adapter._pending_nudge_rehydrated = True
        adapter._nudge_owner_activity = (1_700_000_000_000, "2023-11-14")

        same_instant = tlon_api.TlonIncomingMessage(
            chat_id="~ten",
            chat_name="~ten",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="same millisecond",
            message_id="same-instant-1",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_700_000_000, timezone.utc),
            raw={},
            author_id="~ten",
        )

        adapter._observe_nudge_owner_message(same_instant, is_dm=True)
        self.assertEqual(adapter._nudge_stage_shadow, 0)

    async def test_unrehydrated_owner_reply_takes_authority_in_one_activity_batch(self):
        adapter = make_adapter()
        message = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am back",
            message_id="unrehydrated-owner-reply",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(1_700_000_000, timezone.utc),
            raw={},
        )

        adapter._observe_nudge_owner_message(message, is_dm=True)
        await adapter._nudge_activity_persistence.flush()
        await adapter._pending_nudge_persistence.flush()

        keys = [
            next(iter(payload.values()))["entry-key"]
            for _, _, payload in adapter._sse.pokes
        ]
        self.assertEqual(keys.count("lastOwnerMessageAt"), 1)
        self.assertEqual(keys.count("lastOwnerMessageDate"), 1)
        self.assertEqual(keys.count("lastNudgeStage"), 1)
        self.assertIn("pendingNudge", keys)
        self.assertTrue(adapter._pending_nudge_rehydrated)
        self.assertIsNone(adapter._pending_nudge)

    def test_nudge_reply_context_matches_openclaw_bytes(self):
        without_content = nudge.PendingNudge(
            1_700_000_000_123, 1, "~ten", "hermes"
        )
        self.assertEqual(
            adapter_mod._nudge_reply_context(without_content, "reply"),
            "[Context: You recently sent ~ten a stage-1 re-engagement nudge at "
            "2023-11-14T22:13:20.123Z. The owner's reply below may be responding "
            "to that nudge.]\n\nreply",
        )
        with_content = nudge.PendingNudge(
            1_700_000_000_123, 1, "~ten", "hermes", "nudge body"
        )
        self.assertEqual(
            adapter_mod._nudge_reply_context(with_content, "reply"),
            "[Context: You recently sent ~ten a stage-1 re-engagement nudge at "
            "2023-11-14T22:13:20.123Z. Message content:\n\nnudge body\n\n"
            "The owner's reply below may be responding to that nudge.]\n\nreply",
        )

    async def test_stale_scry_does_not_backdate_activity_or_lower_stage(self):
        stale_bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 0,
                        "lastOwnerMessageDate": "1970-01-01",
                        "lastNudgeStage": 1,
                    }
                }
            }
        }
        adapter = make_adapter()
        held_scry = HeldScrySSE(stale_bucket)
        adapter._sse = held_scry
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=0,
            last_owner_message_date="1970-01-01",
            last_nudge_stage=1,
        )
        adapter._nudge_owner_activity = (1_700_000_000_123, "2023-11-14")
        adapter._nudge_stage_shadow = 2
        adapter._nudge_load_seeded = True
        adapter._pending_nudge_rehydrated = True

        load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        held_scry.release_scry.set()
        self.assertTrue(await load)

        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_123, "2023-11-14"))
        self.assertEqual(adapter._nudge_stage_shadow, 2)

    async def test_load_with_newer_activity_adopts_cleared_stage(self):
        bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 1_700_000_000_123,
                        "lastOwnerMessageDate": "2023-11-14",
                    }
                }
            }
        }
        adapter = make_adapter()
        held_scry = HeldScrySSE(bucket)
        adapter._sse = held_scry
        held_scry.release_scry.set()
        adapter._nudge_owner_activity = (1_700_000_000_000, "2023-11-14")
        adapter._nudge_stage_shadow = 3
        adapter._nudge_load_seeded = True
        adapter._pending_nudge_rehydrated = True

        self.assertTrue(await adapter._load_nudge_settings_only())

        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_123, "2023-11-14"))
        self.assertEqual(adapter._nudge_stage_shadow, 0)

    async def test_load_with_equal_activity_does_not_lower_stage(self):
        bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 1_700_000_000_123,
                        "lastOwnerMessageDate": "2023-11-14",
                        "lastNudgeStage": 1,
                    }
                }
            }
        }
        adapter = make_adapter()
        held_scry = HeldScrySSE(bucket)
        adapter._sse = held_scry
        held_scry.release_scry.set()
        adapter._nudge_owner_activity = (1_700_000_000_123, "2023-11-14")
        adapter._nudge_stage_shadow = 3
        adapter._nudge_load_seeded = True
        adapter._pending_nudge_rehydrated = True

        self.assertTrue(await adapter._load_nudge_settings_only())

        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_123, "2023-11-14"))
        self.assertEqual(adapter._nudge_stage_shadow, 3)

    async def test_boot_scry_failure_owner_reply_discards_stale_retry_load(self):
        now = 8 * 86_400_000
        stale_bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 0,
                        "lastOwnerMessageDate": "1970-01-01",
                        "lastNudgeStage": 0,
                    }
                }
            }
        }
        adapter = make_adapter()
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            active_hours_start="00:00",
            active_hours_end="24:00",
            active_hours_timezone="UTC",
        )
        adapter._nudge_settings_ready = False
        adapter._nudge_scheduler._now_ms = lambda: now
        held_scry = FailThenHeldScrySSE(stale_bucket)
        adapter._sse = held_scry

        self.assertFalse(await adapter._load_settings_state())
        self.assertFalse(adapter._nudge_load_seeded)

        retry_load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        owner_reply = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am back",
            message_id="reply-during-boot-retry",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp(now / 1000, timezone.utc),
            raw={},
        )
        adapter._observe_nudge_owner_message(owner_reply, is_dm=True)
        activity_after_reply = adapter._nudge_owner_activity
        self.assertTrue(adapter._nudge_load_seeded)

        held_scry.release_scry.set()
        self.assertFalse(await retry_load)
        self.assertEqual(adapter._nudge_owner_activity, activity_after_reply)

        # A later successful retry would reopen this gate.  The stale response
        # above must not have backdated the shadow that the tick reads.
        adapter._nudge_settings_ready = True
        await adapter._nudge_scheduler.tick_now()
        self.assertEqual(adapter._cli.sends, [])

    async def test_live_backdate_and_stage_lower_discard_inflight_load(self):
        incoming_bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 1_800_000_000_000,
                        "lastOwnerMessageDate": "2027-01-15",
                        "lastNudgeStage": 3,
                    }
                }
            }
        }
        adapter = make_adapter()
        held_scry = HeldScrySSE(incoming_bucket)
        adapter._sse = held_scry
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=1_700_000_000_000,
            last_owner_message_date="2023-11-14",
            last_nudge_stage=3,
        )
        adapter._nudge_owner_activity = (1_700_000_000_000, "2023-11-14")
        adapter._nudge_stage_shadow = 3

        load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageAt", value=1_600_000_000_000)
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageDate", value="2020-09-13")
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastNudgeStage", value=1)
        )

        held_scry.release_scry.set()
        self.assertFalse(await load)
        self.assertEqual(
            adapter._nudge_owner_activity, (1_600_000_000_000, "2020-09-13")
        )
        self.assertEqual(adapter._nudge_stage_shadow, 1)

    async def test_live_active_hours_update_discards_unseeded_inflight_load(self):
        adapter = make_adapter()
        held_scry = HeldScrySSE(
            {
                "all": {
                    "moltbot": {
                        "tlon": {
                            "nudgeActiveHoursStart": "09:00",
                            "nudgeActiveHoursEnd": "17:00",
                            "nudgeActiveHoursTimezone": "UTC",
                        }
                    }
                }
            }
        )
        adapter._sse = held_scry

        load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        self.assertFalse(adapter._nudge_load_seeded)
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="nudgeActiveHoursStart", value="00:00")
        )
        self.assertTrue(adapter._nudge_load_seeded)

        held_scry.release_scry.set()
        self.assertFalse(await load)
        self.assertEqual(adapter._nudge_snapshot.active_hours_start, "00:00")

    async def test_live_pending_delete_discards_unseeded_inflight_load(self):
        pending = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        adapter = make_adapter()
        held_scry = HeldScrySSE(
            {
                "all": {
                    "moltbot": {
                        "tlon": {"pendingNudge": pending.to_settings_value()}
                    }
                }
            }
        )
        adapter._sse = held_scry

        load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        self.assertFalse(adapter._nudge_load_seeded)
        self.assertFalse(adapter._pending_nudge_rehydrated)
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="pendingNudge", value=None)
        )
        self.assertTrue(adapter._nudge_load_seeded)

        held_scry.release_scry.set()
        self.assertFalse(await load)
        self.assertIsNone(adapter._pending_nudge)
        self.assertFalse(adapter._pending_nudge_rehydrated)

    async def test_load_adopts_newer_external_activity_and_higher_stage(self):
        bucket = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "lastOwnerMessageAt": 1_700_000_000_123,
                        "lastOwnerMessageDate": "2023-11-14",
                        "lastNudgeStage": 3,
                    }
                }
            }
        }
        adapter = make_adapter()
        held_scry = HeldScrySSE(bucket)
        adapter._sse = held_scry
        held_scry.release_scry.set()
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=0,
            last_nudge_stage=1,
        )
        adapter._nudge_owner_activity = (0, "1970-01-01")
        adapter._nudge_stage_shadow = 1
        adapter._nudge_load_seeded = True

        self.assertTrue(await adapter._load_nudge_settings_only())

        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_123, "2023-11-14"))
        self.assertEqual(adapter._nudge_stage_shadow, 3)

    def test_live_subscription_clear_and_backdate_lower_shadows(self):
        adapter = make_adapter()
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=1_700_000_000_123,
            last_owner_message_date="2023-11-14",
            last_nudge_stage=3,
        )
        adapter._nudge_owner_activity = (1_700_000_000_123, "2023-11-14")
        adapter._nudge_stage_shadow = 3

        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageAt", value=1_600_000_000_000)
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageDate", value="2020-09-13")
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastNudgeStage", value=1)
        )
        self.assertEqual(adapter._nudge_owner_activity, (1_600_000_000_000, "2020-09-13"))
        self.assertEqual(adapter._nudge_stage_shadow, 1)

        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageAt", value=None)
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastOwnerMessageDate", value=None)
        )
        adapter._apply_nudge_settings_event(
            SimpleNamespace(key="lastNudgeStage", value=None)
        )
        self.assertIsNone(adapter._nudge_owner_activity)
        self.assertEqual(adapter._nudge_stage_shadow, 0)

    async def test_transport_unavailable_retains_and_replays_queue_head(self):
        adapter = make_adapter()
        adapter._sse = None
        retries = 0
        reconnected = RecordingSSE()

        async def retry_sleep(_seconds):
            nonlocal retries
            retries += 1
            if retries == 3:
                adapter._sse = reconnected
            await asyncio.sleep(0)

        adapter._pending_nudge_persistence._sleep = retry_sleep
        pending = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        adapter._pending_nudge_rehydrated = True
        adapter._pending_nudge_persistence.enqueue(pending)
        await asyncio.wait_for(adapter._pending_nudge_persistence.flush(), timeout=1)

        self.assertEqual(retries, 3)
        self.assertEqual(len(reconnected.pokes), 1)

    async def test_retained_queue_head_waits_for_fully_authenticated_sse(self):
        adapter = make_adapter()
        adapter._sse = None
        retry_started = asyncio.Event()
        release_retry = asyncio.Event()

        async def held_backoff(_seconds):
            retry_started.set()
            await release_retry.wait()

        adapter._pending_nudge_persistence._sleep = held_backoff
        SlowAuthenticateSSE.instances.clear()
        with patch.object(adapter_mod, "TlonSSEClient", SlowAuthenticateSSE):
            connect = asyncio.create_task(adapter._connect_sse())
            await asyncio.sleep(0)
            client = SlowAuthenticateSSE.instances[0]
            await client.authenticate_started.wait()

            adapter._pending_nudge_persistence.enqueue(None)
            await asyncio.wait_for(retry_started.wait(), timeout=1)
            self.assertIsNone(adapter._sse)
            self.assertEqual(client.poke_attempts, 0)

            client.release_authenticate.set()
            await connect
            self.assertIs(adapter._sse, client)
            self.assertEqual(client.poke_attempts, 0)

            release_retry.set()
            await asyncio.wait_for(adapter._pending_nudge_persistence.flush(), timeout=1)

        self.assertEqual(client.poke_attempts, 1)
        self.assertEqual(len(client.pokes), 1)

    async def test_retryable_http_errors_retain_and_replay_queue_head(self):
        for status in (404, 410, 429, 503):
            adapter = make_adapter()

            class RetryThenSuccessSSE:
                def __init__(self):
                    self.calls = 0

                async def poke(self, _app, _mark, _payload):
                    self.calls += 1
                    if self.calls == 1:
                        raise ConnectionError(f"HTTP {status}")

            sse = RetryThenSuccessSSE()
            adapter._sse = sse
            adapter._pending_nudge_persistence._sleep = lambda _seconds: asyncio.sleep(0)
            adapter._pending_nudge_persistence.enqueue(None)
            await asyncio.wait_for(adapter._pending_nudge_persistence.flush(), timeout=1)
            self.assertEqual(sse.calls, 2)

    async def test_nonretryable_403_is_dropped_and_queue_advances(self):
        adapter = make_adapter()

        class TerminalThenSuccessSSE:
            def __init__(self):
                self.calls = 0

            async def poke(self, _app, _mark, _payload):
                self.calls += 1
                if self.calls == 1:
                    raise tlon_api.TlonTerminalActionError("HTTP 403 settings rejected")

        terminal_sse = TerminalThenSuccessSSE()
        adapter._sse = terminal_sse
        first = nudge.PendingNudge(1_700_000_000_000, 1, "~ten", "hermes")
        second = nudge.PendingNudge(1_700_000_000_001, 2, "~ten", "hermes")
        adapter._pending_nudge_persistence.enqueue(first)
        adapter._pending_nudge_persistence.enqueue(second)
        await asyncio.wait_for(adapter._pending_nudge_persistence.flush(), timeout=1)

        self.assertEqual(terminal_sse.calls, 2)

    async def test_pre_send_race_enqueues_only_standalone_stage_clear(self):
        adapter = make_adapter()
        now = 8 * 86_400_000
        reply = tlon_api.TlonIncomingMessage(
            chat_id="~zod",
            chat_name="~zod",
            chat_type="dm",
            user_id="~ten",
            user_name="~ten",
            text="I am back",
            message_id="reply-during-stage-poke",
            reply_to_message_id=None,
            sent_at=datetime.fromtimestamp((now + 1) / 1000, timezone.utc),
            raw={},
        )

        class RaceSSE(RecordingSSE):
            async def poke(self, app, mark, payload):
                if next(iter(payload.values()))["entry-key"] == "lastNudgeStage":
                    adapter._observe_nudge_owner_message(reply, is_dm=True)
                await super().poke(app, mark, payload)

        adapter._sse = RaceSSE()
        adapter._pending_nudge_rehydrated = True
        adapter._nudge_snapshot = nudge.NudgeSettingsSnapshot(
            last_owner_message_at=0,
            active_hours_start="00:00",
            active_hours_end="24:00",
            active_hours_timezone="UTC",
        )
        adapter._nudge_scheduler._now_ms = lambda: now

        await adapter._nudge_scheduler.tick_now()
        await adapter._nudge_activity_persistence.flush()

        keys = [
            next(iter(payload.values()))["entry-key"]
            for _, _, payload in adapter._sse.pokes
        ]
        self.assertEqual(keys.count("lastOwnerMessageAt"), 1)
        self.assertEqual(keys.count("lastOwnerMessageDate"), 1)
        self.assertEqual(keys.count("lastNudgeStage"), 2)
        self.assertEqual(adapter._cli.sends, [])

    async def test_retry_load_commits_only_nudge_keys(self):
        adapter = make_adapter()
        adapter._owner_listen.enabled = False
        sse = HeldScrySSE(
            {
                "all": {
                    "moltbot": {
                        "tlon": {
                            "ownerListenEnabled": True,
                            "lastOwnerMessageAt": 1_700_000_000_123,
                        }
                    }
                }
            }
        )
        sse.release_scry.set()
        adapter._sse = sse

        self.assertTrue(await adapter._load_nudge_settings_only())
        self.assertFalse(adapter._owner_listen.enabled)
        self.assertEqual(adapter._nudge_owner_activity, (1_700_000_000_123, "2023-11-14"))

    async def test_old_generation_nudge_load_is_discarded(self):
        adapter = make_adapter()
        held_scry = HeldScrySSE(
            {"all": {"moltbot": {"tlon": {"lastNudgeStage": 3}}}}
        )
        adapter._sse = held_scry
        adapter._nudge_stage_shadow = 1
        adapter._nudge_load_seeded = True

        load = asyncio.create_task(adapter._load_nudge_settings_only())
        await held_scry.scry_started.wait()
        adapter._nudge_load_generation += 1
        held_scry.release_scry.set()

        self.assertFalse(await load)
        self.assertEqual(adapter._nudge_stage_shadow, 1)

    async def test_reconnect_full_load_waits_for_ordered_worker_backlog(self):
        adapter = make_adapter()
        started = asyncio.Event()
        release = asyncio.Event()
        loaded = asyncio.Event()

        async def blocked_item(_item):
            started.set()
            await release.wait()

        class ReconnectedSSE:
            async def events(self, *, on_open=None):
                if on_open is not None:
                    on_open()
                await asyncio.Future()
                if False:
                    yield None

            async def close(self, *, graceful=True):
                return None

        async def connect_sse():
            adapter._sse = ReconnectedSSE()

        async def record_load():
            loaded.set()
            await asyncio.Future()
            return True

        adapter._process_stream_item = blocked_item
        adapter._connect_sse = connect_sse
        adapter._load_settings_state = record_load
        adapter._start_event_worker()
        assert adapter._event_queue is not None
        adapter._event_queue.put_nowait(adapter_mod._StreamWorkItem("settings", {}))
        await started.wait()
        adapter._sse = None
        stream = asyncio.create_task(adapter._run_stream())
        try:
            await asyncio.sleep(0)
            self.assertFalse(loaded.is_set())
            release.set()
            await asyncio.wait_for(loaded.wait(), timeout=1)
        finally:
            stream.cancel()
            try:
                await stream
            except asyncio.CancelledError:
                pass
            await adapter._stop_event_worker()

    async def test_malformed_fast_taps_do_not_reconnect_the_sse_stream(self):
        adapter = make_adapter()
        handled = []

        async def record(event):
            handled.append(event)

        class MalformedEventSSE(RecordingSSE):
            def __init__(self):
                super().__init__()
                self.events_yielded = asyncio.Event()
                self.closed = False

            async def events(self, *, on_open=None):
                if on_open is not None:
                    on_open()
                yield SimpleNamespace(
                    app="channels",
                    json={
                        "nest": "chat/~zod/general",
                        "response": {
                            "post": {
                                "id": "bad-channel",
                                "r-post": {
                                    "set": {
                                        "essay": {
                                            "author": "~ten",
                                            "sent": 10**400,
                                            "content": [{"inline": ["bad"]}],
                                        }
                                    }
                                },
                            }
                        },
                    },
                )
                yield SimpleNamespace(
                    app="chat",
                    json={
                        "whom": "~ten",
                        "id": "bad-dm",
                        "response": {
                            "add": {
                                "essay": {
                                    "author": "~ten",
                                    "sent": 10**400,
                                    "content": [{"inline": ["bad"]}],
                                }
                            }
                        },
                    },
                )
                self.events_yielded.set()
                await asyncio.Future()

            async def close(self, *, graceful=True):
                self.closed = True

        sse = MalformedEventSSE()
        adapter._sse = sse
        adapter.handle_message = record
        reconnects = 0

        async def unexpected_connect():
            nonlocal reconnects
            reconnects += 1
            raise AssertionError("malformed event triggered an SSE reconnect")

        adapter._connect_sse = unexpected_connect
        adapter._start_event_worker()
        stream = asyncio.create_task(adapter._run_stream())
        try:
            await asyncio.wait_for(sse.events_yielded.wait(), timeout=1)
            assert adapter._event_queue is not None
            await asyncio.wait_for(adapter._event_queue.join(), timeout=1)
            self.assertEqual(handled, [])
            self.assertEqual(reconnects, 0)
            self.assertFalse(sse.closed)
        finally:
            stream.cancel()
            await stream
            await adapter._stop_event_worker()

    async def test_out_of_range_nudge_settings_event_is_ignored_atomically(self):
        poisoned = nudge.NudgeSettingsSnapshot(last_owner_message_at=-1e20)
        self.assertIsNone(nudge.owner_activity_from_snapshot(poisoned))
        self.assertIsNone(nudge.resolve_last_owner_instant(None, poisoned))
        self.assertIsNone(
            nudge.owner_activity_from_snapshot(
                nudge.NudgeSettingsSnapshot(last_owner_message_date="not-a-date")
            )
        )

        adapter = make_adapter()
        before_snapshot = nudge.NudgeSettingsSnapshot(
            last_nudge_stage=2,
            active_hours_start="00:00",
            active_hours_end="24:00",
            active_hours_timezone="UTC",
        )
        adapter._nudge_snapshot = before_snapshot
        adapter._nudge_stage_shadow = 2
        adapter._nudge_load_generation = 41
        adapter._nudge_scheduler._now_ms = lambda: 31 * 86_400_000

        await adapter._route_stream_event(
            SimpleNamespace(
                app="settings",
                json={
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "lastOwnerMessageAt",
                        "value": -1e20,
                    }
                },
            )
        )

        self.assertIs(adapter._nudge_snapshot, before_snapshot)
        self.assertEqual(adapter._nudge_snapshot, before_snapshot)
        self.assertIsNone(adapter._nudge_owner_activity)
        self.assertEqual(adapter._nudge_stage_shadow, 2)
        self.assertEqual(adapter._nudge_load_generation, 41)
        self.assertFalse(adapter._nudge_load_seeded)

        await adapter._nudge_scheduler.tick_now()
        self.assertEqual(adapter._sse.pokes, [])
        self.assertEqual(adapter._cli.sends, [])

    async def test_full_event_queue_backpressures_after_nudge_fast_tap(self):
        adapter = make_adapter()
        adapter._pending_nudge_rehydrated = True

        class ObservingQueue(asyncio.Queue):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.put_started = asyncio.Event()
                self.put_finished = asyncio.Event()

            async def put(self, item):
                self.put_started.set()
                await super().put(item)
                self.put_finished.set()

        queue = ObservingQueue(maxsize=1)
        queue.put_nowait(adapter_mod._StreamWorkItem("contacts", {}))
        adapter._event_queue = queue
        producer = asyncio.create_task(
            adapter._route_stream_event(
                SimpleNamespace(
                    app="chat",
                    json={
                        "whom": "~ten",
                        "id": "owner-reply",
                        "response": {
                            "add": {
                                "essay": {
                                    "author": "~ten",
                                    "sent": 1_000,
                                    "content": [{"inline": ["I am back"]}],
                                }
                            }
                        },
                    },
                )
            )
        )
        try:
            await asyncio.wait_for(queue.put_started.wait(), timeout=1)
            self.assertFalse(producer.done())
            self.assertFalse(queue.put_finished.is_set())
            self.assertEqual(adapter._nudge_owner_activity, (1_000, "1970-01-01"))

            queue.get_nowait()
            queue.task_done()
            await asyncio.wait_for(producer, timeout=1)

            queued = queue.get_nowait()
            queue.task_done()
            self.assertEqual(queued.app, "chat")
            self.assertIsNotNone(queued.message)
        finally:
            if not producer.done():
                producer.cancel()
                try:
                    await producer
                except asyncio.CancelledError:
                    pass
            adapter._event_queue = None
            await adapter._nudge_activity_persistence.flush()
