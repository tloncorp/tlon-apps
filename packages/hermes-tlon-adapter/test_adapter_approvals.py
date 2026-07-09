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
PACKAGE_NAME = "hermes_tlon_adapter_approvals_adapter_testpkg"

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
        self,
        *,
        success,
        message_id=None,
        error=None,
        raw_response=None,
        retryable=False,
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.raw_response = raw_response or {}
        self.retryable = retryable


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
adapter_mod = load_module("adapter")


def channel_event(
    text,
    *,
    author="~ten",
    nest="chat/~pen/general",
    post_id="170.141",
    blob=None,
    content=None,
):
    story_content = [{"inline": [text]}] if content is None else content
    essay = {
        "author": author,
        "sent": 1000,
        "content": story_content,
    }
    if blob is not None:
        essay["blob"] = blob
    return {
        "nest": nest,
        "response": {
            "post": {
                "id": post_id,
                "r-post": {
                    "set": {
                        "essay": essay
                    }
                },
            }
        },
    }


def dm_event(
    text,
    *,
    author="~ten",
    whom="~ten",
    msg_id="dm-1",
    parent_id=None,
    blob=None,
    content=None,
):
    essay = {
        "author": author,
        "sent": 1000,
        "content": [{"inline": [text]}] if content is None else content,
    }
    if blob is not None:
        essay["blob"] = blob
    if parent_id:
        return {
            "whom": whom,
            "id": parent_id,
            "response": {
                "reply": {
                    "id": msg_id,
                    "delta": {
                        "add": {
                            "essay": essay,
                        }
                    },
                }
            },
        }
    return {"whom": whom, "id": msg_id, "response": {"add": {"essay": essay}}}


def bot_author(ship="~bot"):
    return {"ship": ship, "nickname": "Loop Bot", "avatar": ""}


class FakeSSE:
    def __init__(self, payloads=None):
        self.payloads = payloads or {}
        self.scries = []
        self.pokes = []

    async def scry(self, path):
        self.scries.append(path)
        if path in self.payloads:
            return self.payloads[path]
        raise ConnectionError(f"no payload for {path}")

    async def poke(self, app, mark, json_payload):
        self.pokes.append((app, mark, json_payload))
        return 1

    def pokes_for(self, mark):
        return [poke for poke in self.pokes if poke[1] == mark]

    def settings_writes(self, key):
        """Logical values written for a settings key (JSON strings decoded)."""
        values = []
        for poke in self.pokes:
            if poke[1] != "settings-event":
                continue
            entry = poke[2]["put-entry"]
            if entry["entry-key"] != key:
                continue
            value = entry["value"]
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    pass
            values.append(value)
        return values


class FakeCLI:
    def __init__(self):
        self.messages = []
        self.replies = []
        self.commands = []

    async def run_command(self, args):
        self.commands.append(tuple(args))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", *args), stdout="ok\n"
        )

    async def send_message(self, chat_id, text):
        self.messages.append((chat_id, text))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", "posts", "send"), message_id="post-id"
        )

    async def send_reply(self, chat_id, post_id, text, *, parent_author=None):
        self.replies.append((chat_id, post_id, text, parent_author))
        return tlon_api.TlonSendResult(
            success=True, command=("tlon-test", "posts", "reply"), message_id="reply-id"
        )

    def notifications(self):
        return [cmd for cmd in self.commands if cmd[:2] == ("posts", "send")]


class AdapterApprovalTests(unittest.TestCase):
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
        adapter._sse = FakeSSE()
        adapter._cli = FakeCLI()
        adapter._settings_loaded = True
        return adapter

    def dispatches(self, adapter, raw, *, dm=False):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        handler = adapter._handle_dm_event if dm else adapter._handle_channel_event
        asyncio.run(handler(raw))
        return events

    def apply_settings_event(self, adapter, event):
        asyncio.run(adapter._handle_settings_event(event))

    def reconnect(self, adapter):
        """Simulate the _run_stream reconnect sequence: settings reload then
        the pending-DM-invite catch-up scan."""

        async def run():
            await adapter._load_settings_state()
            await adapter._process_pending_dm_invites()

        asyncio.run(run())

    # ── deny-by-default + queueing ───────────────────────────────────────

    def test_unknown_dm_queues_approval_with_card(self):
        adapter = self.make_adapter()

        events = self.dispatches(adapter, dm_event("hi bot, help me"), dm=True)

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._pending_approvals), 1)
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["type"], "dm")
        self.assertEqual(pending["requestingShip"], "~ten")
        self.assertEqual(pending["originalMessage"]["messageText"], "hi bot, help me")

        notifications = adapter._cli.notifications()
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0][2], "~mug")
        self.assertIn("DM request", notifications[0][3])
        self.assertEqual(notifications[0][4], "--blob")
        self.assertIn('"a2ui"', notifications[0][5])
        self.assertIn(f"/allow {pending['id']}", notifications[0][5])

        writes = adapter._sse.settings_writes("pendingApprovals")
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0][0]["requestingShip"], "~ten")

    def test_unknown_dm_blob_only_queues_and_replays_with_media(self):
        adapter = self.make_adapter()
        blob = json.dumps(
            [
                {
                    "type": "voicememo",
                    "version": 1,
                    "fileUri": "https://storage.example.com/memo.m4a",
                }
            ]
        )

        events = self.dispatches(adapter, dm_event("", blob=blob, content=[]), dm=True)

        self.assertEqual(events, [])
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["originalMessage"]["messageText"], "")
        self.assertEqual(pending["originalMessage"]["blob"], blob)
        self.assertIn("voice memo", pending["messagePreview"])

        async def fake_prepare(content, raw_blob):
            self.assertEqual(content, [])
            self.assertEqual(raw_blob, blob)
            return adapter_mod.PreparedMedia(
                text_prefix="🎙️ [voice memo] (?)",
                media_urls=("/cache/memo.m4a",),
                media_types=("audio/mp4",),
                message_type="voice",
            )

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            replayed = self.dispatches(
                adapter,
                dm_event(
                    f"/allow {pending['id']}",
                    author="~mug",
                    whom="~mug",
                    msg_id="allow-1",
                ),
                dm=True,
            )

        self.assertEqual(len(replayed), 1)
        self.assertEqual(replayed[0].text, "🎙️ [voice memo] (?)")
        self.assertEqual(replayed[0].message_type, MessageType.VOICE)
        self.assertEqual(replayed[0].media_urls, ["/cache/memo.m4a"])

    def test_unknown_club_message_drops_without_queue(self):
        adapter = self.make_adapter()
        events = self.dispatches(
            adapter,
            dm_event("hello", author="~ten", whom="0v4.aaaaa.bbbbb"),
            dm=True,
        )
        self.assertEqual(events, [])
        self.assertEqual(adapter._pending_approvals, [])

    def test_no_owner_means_plain_deny(self):
        adapter = self.make_adapter({"owner_ship": ""})
        events = self.dispatches(adapter, dm_event("hello"), dm=True)
        self.assertEqual(events, [])
        self.assertEqual(adapter._pending_approvals, [])
        self.assertEqual(adapter._cli.notifications(), [])

    def test_unauthorized_channel_mention_queues_channel_approval(self):
        adapter = self.make_adapter()

        events = self.dispatches(adapter, channel_event("~pen are you there?"))

        self.assertEqual(events, [])
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["type"], "channel")
        self.assertEqual(pending["channelNest"], "chat/~pen/general")
        self.assertEqual(pending["originalMessage"]["messageText"], "are you there?")

    def test_unauthorized_channel_mention_preserves_blob_in_approval(self):
        adapter = self.make_adapter()
        blob = json.dumps(
            [
                {
                    "type": "video",
                    "version": 1,
                    "fileUri": "https://storage.example.com/clip.mp4",
                    "name": "clip.mp4",
                }
            ]
        )

        events = self.dispatches(adapter, channel_event("~pen watch", blob=blob))

        self.assertEqual(events, [])
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["originalMessage"]["messageText"], "watch")
        self.assertEqual(pending["originalMessage"]["blob"], blob)
        self.assertIn("clip.mp4", pending["messagePreview"])

    def test_unmentioned_unauthorized_channel_chatter_does_not_queue(self):
        adapter = self.make_adapter()
        events = self.dispatches(adapter, channel_event("just chatting"))
        self.assertEqual(events, [])
        self.assertEqual(adapter._pending_approvals, [])

    # ── defaultAuthorizedShips (TLON-6090) ──────────────────────────────

    def test_default_authorized_ships_grants_channel_access_without_rule(self):
        adapter = self.make_adapter()
        adapter._settings_default_authorized_ships = {"~ten"}

        events = self.dispatches(adapter, channel_event("~pen are you there?"))

        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._pending_approvals, [])

    def test_default_authorized_ships_does_not_grant_dm_access(self):
        adapter = self.make_adapter()
        adapter._settings_default_authorized_ships = {"~ten"}

        events = self.dispatches(adapter, dm_event("hi bot"), dm=True)

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._pending_approvals), 1)

    def test_default_authorized_ships_ignored_when_rule_pins_allowed_ships(self):
        adapter = self.make_adapter()
        adapter._settings_default_authorized_ships = {"~ten"}
        adapter._channel_rules = {"chat/~pen/general": {"allowedShips": ["~bus"]}}

        events = self.dispatches(adapter, channel_event("~pen are you there?"))

        self.assertEqual(events, [])
        self.assertEqual(adapter._pending_approvals[0]["type"], "channel")

    def test_default_authorized_ships_used_when_rule_omits_allowed_ships(self):
        adapter = self.make_adapter()
        adapter._settings_default_authorized_ships = {"~ten"}
        adapter._channel_rules = {"chat/~pen/general": {"mode": "restricted"}}

        events = self.dispatches(adapter, channel_event("~pen are you there?"))

        self.assertEqual(len(events), 1)

    def test_open_channel_still_open_regardless_of_defaults(self):
        adapter = self.make_adapter()
        adapter._settings_default_authorized_ships = set()
        adapter._channel_rules = {"chat/~pen/general": {"mode": "open"}}

        events = self.dispatches(adapter, channel_event("~pen are you there?"))

        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._pending_approvals, [])

    def test_duplicate_dm_updates_without_renotify_within_cooldown(self):
        adapter = self.make_adapter()

        self.dispatches(adapter, dm_event("first message", msg_id="dm-1"), dm=True)
        self.dispatches(adapter, dm_event("second message", msg_id="dm-2"), dm=True)

        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertEqual(
            adapter._pending_approvals[0]["messagePreview"], "second message"
        )
        self.assertEqual(len(adapter._cli.notifications()), 1)

    def test_blocked_ship_requests_are_ignored(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/chat/blocked"] = ["~ten"]

        self.dispatches(adapter, dm_event("hello"), dm=True)

        self.assertEqual(adapter._pending_approvals, [])
        self.assertEqual(adapter._cli.notifications(), [])

    # ── DM invites ───────────────────────────────────────────────────────

    def test_invite_from_unknown_ship_queues_with_sentinel(self):
        adapter = self.make_adapter()

        self.dispatches(adapter, ["~ten", "0v4.club.id"], dm=True)

        self.assertEqual(len(adapter._pending_approvals), 1)
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["messagePreview"], "(DM invite - no message yet)")
        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)

    def test_invite_from_env_allowed_ship_left_pending_when_flag_off(self):
        # OpenClaw parity: only the owner bypasses autoAcceptDmInvites. An
        # env-allowlisted ship's invite is left pending (not accepted, not
        # queued, not marked processed) while the flag is off.
        adapter = self.make_adapter({"allowed_users": ["~ten"]})

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])
        self.assertNotIn("~ten", adapter._processed_dm_invites)

    def test_invite_from_env_allowed_ship_auto_accepted_when_flag_on(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        adapter._auto_accept_dm_invites = True

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])

    def test_connect_scry_catches_missed_invites_once(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]

        asyncio.run(adapter._process_pending_dm_invites())
        asyncio.run(adapter._process_pending_dm_invites())

        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertEqual(len(adapter._cli.notifications()), 1)

    def test_owner_invite_always_accepted_flag_irrelevant(self):
        adapter = self.make_adapter()
        adapter._auto_accept_dm_invites = False

        self.dispatches(adapter, ["~mug"], dm=True)

        self.assertIn(("dms", "accept", "~mug"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])

    def test_unknown_ship_with_owner_queues_and_marks_processed(self):
        adapter = self.make_adapter()

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertIn("~ten", adapter._processed_dm_invites)
        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)

    # ── autoAcceptDmInvites (TLON-6090) ─────────────────────────────────

    def test_flag_off_store_allowlisted_invite_left_pending(self):
        adapter = self.make_adapter()
        adapter._auto_accept_dm_invites = False
        adapter._settings_dm_allowlist = {"~ten"}

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])
        self.assertNotIn("~ten", adapter._processed_dm_invites)

    def test_flag_on_store_allowlisted_invite_auto_accepted(self):
        adapter = self.make_adapter()
        adapter._auto_accept_dm_invites = True
        adapter._settings_dm_allowlist = {"~ten"}

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])
        self.assertIn("~ten", adapter._processed_dm_invites)

    def test_reload_then_accept_via_settings_event(self):
        adapter = self.make_adapter()
        adapter._settings_dm_allowlist = {"~ten"}
        adapter._auto_accept_dm_invites = False

        self.dispatches(adapter, ["~ten"], dm=True)
        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertNotIn("~ten", adapter._processed_dm_invites)

        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]
        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "autoAcceptDmInvites",
                        "value": True,
                    }
                }
            },
        )

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertIn("~ten", adapter._processed_dm_invites)

    def test_reconnect_catchup_invite_missed_while_down_flag_already_true(self):
        adapter = self.make_adapter()
        # "Flag already true" means the persisted store has it true (an
        # in-memory-only override would be clobbered by the settings reload
        # this test exercises).
        adapter._sse.payloads["/settings/all"] = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "dmAllowlist": ["~ten"],
                        "autoAcceptDmInvites": True,
                    }
                }
            }
        }
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]

        self.reconnect(adapter)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertIn("~ten", adapter._processed_dm_invites)

    def test_reconnect_catchup_flag_flipped_while_down(self):
        adapter = self.make_adapter()
        adapter._auto_accept_dm_invites = False
        adapter._sse.payloads["/settings/all"] = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "dmAllowlist": ["~ten"],
                        "autoAcceptDmInvites": True,
                    }
                }
            }
        }
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]

        self.reconnect(adapter)

        self.assertTrue(adapter._auto_accept_dm_invites)
        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertIn("~ten", adapter._processed_dm_invites)

    def test_reconnect_catchup_idempotence(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/settings/all"] = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "dmAllowlist": ["~ten"],
                        "autoAcceptDmInvites": True,
                    }
                }
            }
        }
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]

        self.reconnect(adapter)
        self.reconnect(adapter)

        self.assertEqual(
            adapter._cli.commands.count(("dms", "accept", "~ten")), 1
        )
        self.assertEqual(adapter._pending_approvals, [])

    def test_failed_accept_is_retriable(self):
        class FailingAcceptCLI(FakeCLI):
            async def run_command(self, args):
                self.commands.append(tuple(args))
                if tuple(args[:2]) == ("dms", "accept"):
                    return tlon_api.TlonSendResult(
                        success=False,
                        command=("tlon-test", *args),
                        error="rsvp failed",
                    )
                return tlon_api.TlonSendResult(
                    success=True, command=("tlon-test", *args), stdout="ok\n"
                )

        adapter = self.make_adapter()
        adapter._cli = FailingAcceptCLI()
        adapter._auto_accept_dm_invites = True
        adapter._settings_dm_allowlist = {"~ten"}

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertNotIn("~ten", adapter._processed_dm_invites)

        # A later scan retries the still-unprocessed ship.
        adapter._cli = FakeCLI()
        self.dispatches(adapter, ["~ten"], dm=True)
        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertIn("~ten", adapter._processed_dm_invites)

    def test_narrowed_scope_queued_then_allowlisted_not_retroactively_accepted(self):
        adapter = self.make_adapter()

        # Unknown ship: queues and marks processed.
        self.dispatches(adapter, ["~ten"], dm=True)
        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertIn("~ten", adapter._processed_dm_invites)

        # Owner adds it to dmAllowlist with the flag already on; the ship is
        # still in _processed_dm_invites, so the settings-event branch's
        # re-scan (and any later re-scan) skips it.
        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "autoAcceptDmInvites",
                        "value": True,
                    }
                }
            },
        )
        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "dmAllowlist",
                        "value": ["~ten"],
                    }
                }
            },
        )

        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(len(adapter._pending_approvals), 1)  # no duplicate

        # A later re-scan / repeat invite event still skips it.
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]
        asyncio.run(adapter._process_pending_dm_invites())
        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertNotIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(len(adapter._pending_approvals), 1)

    def test_restart_recovery_accepts_and_clears_stale_approval(self):
        adapter = self.make_adapter()

        # Unknown ship: queues and marks processed.
        self.dispatches(adapter, ["~ten"], dm=True)
        self.assertEqual(len(adapter._pending_approvals), 1)
        queued_id = adapter._pending_approvals[0]["id"]
        self.assertIn("~ten", adapter._processed_dm_invites)

        # Owner adds it to dmAllowlist with the flag on (narrowed-scope
        # limitation: no retroactive accept while still processed).
        adapter._settings_dm_allowlist = {"~ten"}
        adapter._auto_accept_dm_invites = True

        # Simulate the relevant effect of a full disconnect()/connect()
        # restart: the processed set is cleared and a fresh reconnect
        # sequence re-scans, reloading the still-queued approval from the
        # bucket along with the now-allowlisted dmAllowlist/flag.
        adapter._processed_dm_invites.clear()
        adapter._sse.payloads["/settings/all"] = {
            "all": {
                "moltbot": {
                    "tlon": {
                        "dmAllowlist": ["~ten"],
                        "autoAcceptDmInvites": True,
                        "pendingApprovals": json.dumps(adapter._pending_approvals),
                    }
                }
            }
        }
        adapter._sse.payloads["/chat/dm/invited"] = ["~ten"]

        self.reconnect(adapter)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._pending_approvals, [])
        persisted = adapter._sse.settings_writes("pendingApprovals")
        self.assertTrue(persisted)
        self.assertEqual(persisted[-1], [])
        self.assertNotIn(
            queued_id, [a["id"] for a in adapter._pending_approvals]
        )

    def test_accept_clears_only_matching_dm_approval_type_scoped(self):
        adapter = self.make_adapter()
        adapter._pending_approvals = [
            {
                "id": "d1",
                "type": "dm",
                "requestingShip": "~ten",
                "timestamp": 1,
            },
            {
                "id": "c1",
                "type": "channel",
                "requestingShip": "~ten",
                "channelNest": "chat/~pen/general",
                "timestamp": 1,
            },
        ]
        adapter._auto_accept_dm_invites = True
        adapter._settings_dm_allowlist = {"~ten"}

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        remaining = [a["id"] for a in adapter._pending_approvals]
        self.assertEqual(remaining, ["c1"])

    def test_accept_with_no_queued_approval_persists_nothing(self):
        adapter = self.make_adapter()
        adapter._auto_accept_dm_invites = True
        adapter._settings_dm_allowlist = {"~ten"}

        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._sse.settings_writes("pendingApprovals"), [])

    def test_accept_preserves_dm_message_approval_awaiting_replay(self):
        adapter = self.make_adapter()

        # A real DM message from unknown ~ten queues a 'dm' approval carrying
        # originalMessage for post-approval replay.
        self.dispatches(adapter, dm_event("hi bot, help me"), dm=True)
        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertIn("originalMessage", adapter._pending_approvals[0])

        # The ship is later allowlisted via the dashboard and its native
        # invite auto-accepts — the message approval must NOT be swept away,
        # or the queued message would silently never replay.
        adapter._settings_dm_allowlist = {"~ten"}
        adapter._auto_accept_dm_invites = True
        self.dispatches(adapter, ["~ten"], dm=True)

        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertEqual(
            adapter._pending_approvals[0]["messagePreview"], "hi bot, help me"
        )

    # ── group invites ────────────────────────────────────────────────────

    @staticmethod
    def foreigns(flag, from_ship, *, title="Project Space"):
        return {
            flag: {
                "invites": [
                    {
                        "from": from_ship,
                        "valid": True,
                        "time": 1,
                        "preview": {"meta": {"title": title}},
                    }
                ]
            }
        }

    @staticmethod
    def init_with_channels(flag, channels):
        return {"groups": {flag: {"channels": {nest: {} for nest in channels}}}}

    def test_unknown_group_invite_queues_with_card(self):
        adapter = self.make_adapter()

        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))

        self.assertEqual(len(adapter._pending_approvals), 1)
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["type"], "group")
        self.assertEqual(pending["groupFlag"], "~host/projects")
        self.assertEqual(pending["groupTitle"], "Project Space")
        self.assertEqual(pending["requestingShip"], "~ten")
        # did NOT auto-join
        self.assertNotIn(("groups", "accept-invite", "~host/projects"), adapter._cli.commands)
        notif = adapter._cli.notifications()[0]
        self.assertIn("group invite", notif[3])
        self.assertIn('"a2ui"', notif[5])

    def test_owner_group_invite_auto_accepts_and_adopts_channels(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/groups-ui/v7/init"] = self.init_with_channels(
            "~host/projects", ["chat/~host/general", "heap/~host/art"]
        )

        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~mug")))

        self.assertEqual(adapter._pending_approvals, [])
        self.assertIn(("groups", "accept-invite", "~host/projects"), adapter._cli.commands)
        self.assertIn("chat/~host/general", adapter._monitored_channels)
        self.assertIn("heap/~host/art", adapter._monitored_channels)
        self.assertEqual(
            sorted(adapter._sse.settings_writes("groupChannels")[-1]),
            ["chat/~host/general", "heap/~host/art"],
        )

    def test_allowlisted_inviter_auto_accepts(self):
        adapter = self.make_adapter({"group_invite_allowlist": "~ten"})
        adapter._sse.payloads["/groups-ui/v7/init"] = self.init_with_channels(
            "~host/projects", []
        )

        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))

        self.assertEqual(adapter._pending_approvals, [])
        self.assertIn(("groups", "accept-invite", "~host/projects"), adapter._cli.commands)

    def test_group_invite_deduped_by_flag_across_inviters(self):
        adapter = self.make_adapter()
        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))
        # same flag re-emitted (processed set short-circuits re-queue)
        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~bus")))

        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertEqual(len(adapter._cli.notifications()), 1)

    def test_connect_scry_catches_missed_group_invites(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/groups-ui/v7/init"] = {
            "foreigns": self.foreigns("~host/projects", "~ten"),
            "groups": {},
        }

        asyncio.run(adapter._process_pending_group_invites())

        self.assertEqual(len(adapter._pending_approvals), 1)
        self.assertEqual(adapter._pending_approvals[0]["groupFlag"], "~host/projects")

    def test_allow_group_invite_joins_and_adopts_channels(self):
        adapter = self.make_adapter()
        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))
        request_id = adapter._pending_approvals[0]["id"]
        adapter._sse.payloads["/groups-ui/v7/init"] = self.init_with_channels(
            "~host/projects", ["chat/~host/general"]
        )

        self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(adapter._pending_approvals, [])
        self.assertIn(("groups", "accept-invite", "~host/projects"), adapter._cli.commands)
        self.assertIn("chat/~host/general", adapter._monitored_channels)
        confirmation = adapter._cli.messages[-1][1]
        self.assertIn("joining Project Space", confirmation)
        # discoverability hint for non-owned groups
        self.assertIn("/owner-listen on ~host/projects", confirmation)

    def test_owner_hosted_group_allow_skips_owner_listen_hint(self):
        adapter = self.make_adapter()
        # group hosted by the owner, but invite sent by an unapproved admin
        asyncio.run(adapter._handle_foreigns(self.foreigns("~mug/home", "~ten")))
        request_id = adapter._pending_approvals[0]["id"]
        adapter._sse.payloads["/groups-ui/v7/init"] = self.init_with_channels(
            "~mug/home", []
        )

        self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertNotIn("/owner-listen", adapter._cli.messages[-1][1])

    def test_reject_group_invite_does_not_join(self):
        adapter = self.make_adapter()
        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))
        request_id = adapter._pending_approvals[0]["id"]

        self.dispatches(
            adapter, dm_event(f"/reject {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(adapter._pending_approvals, [])
        self.assertNotIn(("groups", "accept-invite", "~host/projects"), adapter._cli.commands)
        self.assertIn("declined invite", adapter._cli.messages[-1][1])

    def test_group_invite_no_owner_is_ignored(self):
        adapter = self.make_adapter({"owner_ship": ""})

        asyncio.run(adapter._handle_foreigns(self.foreigns("~host/projects", "~ten")))

        self.assertEqual(adapter._pending_approvals, [])
        self.assertEqual(adapter._cli.notifications(), [])

    # ── owner actions ────────────────────────────────────────────────────

    def queue_dm_request(self, adapter, text="hi bot"):
        self.dispatches(adapter, dm_event(text), dm=True)
        return adapter._pending_approvals[0]["id"]

    def test_allow_adds_to_allowlist_and_replays(self):
        adapter = self.make_adapter()
        request_id = self.queue_dm_request(adapter, "what is urbit?")

        events = self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(adapter._pending_approvals, [])
        self.assertIn("~ten", adapter._settings_dm_allowlist)
        self.assertEqual(adapter._sse.settings_writes("dmAllowlist")[-1], ["~ten"])
        # replayed original message dispatched to the model
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "what is urbit?")
        self.assertEqual(events[0].source.chat_id, "~ten")
        confirmation = adapter._cli.messages[-1]
        self.assertEqual(confirmation[0], "~mug")
        self.assertIn("can now DM the bot", confirmation[1])

        # subsequent DMs from the approved ship dispatch directly
        more = self.dispatches(adapter, dm_event("thanks!", msg_id="dm-9"), dm=True)
        self.assertEqual(len(more), 1)

    def test_allow_replays_dm_thread_request_in_thread(self):
        adapter = self.make_adapter()
        self.dispatches(
            adapter,
            dm_event("thread question", msg_id="dm-reply", parent_id="dm-root"),
            dm=True,
        )
        request_id = adapter._pending_approvals[0]["id"]
        self.assertEqual(
            adapter._pending_approvals[0]["originalMessage"]["parentId"], "dm-root"
        )

        events = self.dispatches(
            adapter,
            dm_event(f"/allow {request_id}", author="~mug", whom="~mug"),
            dm=True,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "thread question")
        self.assertEqual(events[0].source.chat_id, "~ten")
        self.assertEqual(events[0].source.thread_id, "dm-root")
        self.assertEqual(events[0].reply_to_message_id, "dm-root")

    def test_allow_invite_accepts_dm_first(self):
        adapter = self.make_adapter()
        self.dispatches(adapter, ["~ten"], dm=True)
        request_id = adapter._pending_approvals[0]["id"]

        events = self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(events, [])  # nothing to replay for an invite
        self.assertIn(("dms", "accept", "~ten"), adapter._cli.commands)
        self.assertIn("~ten", adapter._settings_dm_allowlist)
        self.assertEqual(adapter._pending_approvals, [])

    def test_reject_removes_without_side_effects(self):
        adapter = self.make_adapter()
        request_id = self.queue_dm_request(adapter)

        events = self.dispatches(
            adapter, dm_event(f"/reject {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(events, [])
        self.assertEqual(adapter._pending_approvals, [])
        self.assertNotIn("~ten", adapter._settings_dm_allowlist)
        self.assertNotIn(("dms", "decline", "~ten"), adapter._cli.commands)
        self.assertEqual(adapter._sse.pokes_for("chat-block-ship"), [])

    def test_ban_by_id_blocks_natively(self):
        adapter = self.make_adapter()
        request_id = self.queue_dm_request(adapter)

        self.dispatches(
            adapter, dm_event(f"/ban {request_id}", author="~mug", whom="~mug"), dm=True
        )

        blocks = adapter._sse.pokes_for("chat-block-ship")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][2], {"ship": "~ten"})
        self.assertEqual(adapter._pending_approvals, [])

    def test_ban_by_ship_clears_pending_and_unban_reverses(self):
        adapter = self.make_adapter()
        self.queue_dm_request(adapter)

        self.dispatches(
            adapter,
            dm_event("/ban ~ten", author="~mug", whom="~mug", msg_id="cmd-1"),
            dm=True,
        )
        self.assertEqual(adapter._pending_approvals, [])
        self.assertEqual(len(adapter._sse.pokes_for("chat-block-ship")), 1)
        self.assertIn("Removed 1 pending request(s).", adapter._cli.messages[-1][1])

        self.dispatches(
            adapter,
            dm_event("/unban ~ten", author="~mug", whom="~mug", msg_id="cmd-2"),
            dm=True,
        )
        self.assertEqual(len(adapter._sse.pokes_for("chat-unblock-ship")), 1)

    def test_pending_and_banned_lists(self):
        adapter = self.make_adapter()
        adapter._sse.payloads["/chat/blocked"] = ["~bus"]
        request_id = self.queue_dm_request(adapter)

        self.dispatches(
            adapter,
            dm_event("/pending", author="~mug", whom="~mug", msg_id="cmd-1"),
            dm=True,
        )
        self.assertIn(f"#{request_id}", adapter._cli.messages[-1][1])

        self.dispatches(
            adapter,
            dm_event("/banned", author="~mug", whom="~mug", msg_id="cmd-2"),
            dm=True,
        )
        self.assertIn("• ~bus", adapter._cli.messages[-1][1])

    def test_allow_unknown_id_reports_not_found(self):
        adapter = self.make_adapter()
        self.dispatches(adapter, dm_event("/allow zzzzz", author="~mug", whom="~mug"), dm=True)
        self.assertIn("No pending approval found", adapter._cli.messages[-1][1])

    def test_approval_commands_require_owner(self):
        adapter = self.make_adapter({"allowed_users": ["~ten"]})
        events = self.dispatches(adapter, dm_event("/pending", author="~ten", whom="~ten"), dm=True)
        # not intercepted: dispatches to the model as a normal message
        self.assertEqual(len(events), 1)

    # ── channel approvals + /channel-access ─────────────────────────────

    def test_channel_allow_grants_and_replays_with_context(self):
        adapter = self.make_adapter()
        self.dispatches(adapter, channel_event("~pen can you help?"))
        request_id = adapter._pending_approvals[0]["id"]

        events = self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].source.chat_id, "chat/~pen/general")
        self.assertEqual(events[0].text, "can you help?")
        rules_writes = adapter._sse.settings_writes("channelRules")
        self.assertEqual(
            rules_writes[-1]["chat/~pen/general"]["allowedShips"], ["~ten"]
        )

        follow_up = self.dispatches(
            adapter, channel_event("~pen thanks!", post_id="170.150")
        )
        self.assertEqual(len(follow_up), 1)

    def test_channel_bot_approval_replay_counts_loop_safety(self):
        adapter = self.make_adapter({"max_consecutive_bot_responses": 1})

        self.dispatches(
            adapter,
            channel_event("~pen bot a", author=bot_author("~bot-a"), post_id="a1"),
        )
        request_a = adapter._pending_approvals[0]["id"]
        replayed = self.dispatches(
            adapter,
            dm_event(f"/allow {request_a}", author="~mug", whom="~mug", msg_id="allow-a"),
            dm=True,
        )

        self.assertEqual(len(replayed), 1)
        self.assertEqual(replayed[0].text, "bot a")
        self.assertIn("~bot-a", adapter._known_bot_ships)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)
        self.assertEqual(
            adapter._pending_bot_cap_addendum["chat/~pen/general"],
            ("~bot-a", "a1"),
        )

        self.dispatches(
            adapter,
            channel_event("~pen bot b", author=bot_author("~bot-b"), post_id="b1"),
        )
        request_b = adapter._pending_approvals[0]["id"]
        dropped = self.dispatches(
            adapter,
            dm_event(f"/allow {request_b}", author="~mug", whom="~mug", msg_id="allow-b"),
            dm=True,
        )

        self.assertEqual(dropped, [])
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 2)
        self.assertIn("group:chat/~pen/general:b1", adapter._seen_ids)

    def test_repeated_unauthorized_bot_mentions_count_once_at_replay(self):
        adapter = self.make_adapter({"max_consecutive_bot_responses": 3})

        self.dispatches(
            adapter,
            channel_event("~pen first", author=bot_author(), post_id="m1"),
        )
        self.dispatches(
            adapter,
            channel_event("~pen second", author=bot_author(), post_id="m2"),
        )
        self.assertEqual(len(adapter._pending_approvals), 1)
        pending = adapter._pending_approvals[0]
        self.assertEqual(pending["originalMessage"]["messageId"], "m2")

        events = self.dispatches(
            adapter,
            dm_event(f"/allow {pending['id']}", author="~mug", whom="~mug"),
            dm=True,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].text, "second")
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

    def test_unauthorized_human_reset_waits_until_replay(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "require_mention": False,
                "max_consecutive_bot_responses": 1,
            }
        )

        initial = self.dispatches(
            adapter,
            channel_event("bot one", author=bot_author(), post_id="b1"),
        )
        self.assertEqual(len(initial), 1)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

        self.dispatches(
            adapter,
            channel_event("~pen reset please", author="~ten", post_id="h1"),
        )
        self.assertEqual(len(adapter._pending_approvals), 1)

        before_approval = self.dispatches(
            adapter,
            channel_event("bot two", author=bot_author(), post_id="b2"),
        )
        self.assertEqual(before_approval, [])
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 2)

        request_id = adapter._pending_approvals[0]["id"]
        replayed_human = self.dispatches(
            adapter,
            dm_event(f"/allow {request_id}", author="~mug", whom="~mug"),
            dm=True,
        )
        self.assertEqual(len(replayed_human), 1)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 0)
        self.assertNotIn("chat/~pen/general", adapter._pending_bot_cap_addendum)

        after_reset = self.dispatches(
            adapter,
            channel_event("bot three", author=bot_author(), post_id="b3"),
        )
        self.assertEqual(len(after_reset), 1)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

    def test_over_cap_replay_marks_seen_and_skips_media_prep(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "require_mention": False,
                "max_consecutive_bot_responses": 1,
            }
        )
        adapter._known_bot_consecutive_by_channel["chat/~pen/general"] = 1
        approval = {
            "id": "drop1",
            "type": "channel",
            "requestingShip": "~bot",
            "channelNest": "chat/~pen/general",
            "originalMessage": {
                "messageId": "drop-message",
                "messageText": "over cap",
                "timestamp": 1000,
                "authorIsBot": True,
            },
        }
        events = []
        prepare_calls = 0

        async def record(event):
            events.append(event)

        async def fake_prepare(message, text):
            nonlocal prepare_calls
            prepare_calls += 1
            return text, adapter_mod.PreparedMedia()

        adapter.handle_message = record
        with patch.object(adapter, "_prepare_dispatch_payload", fake_prepare):
            asyncio.run(adapter._replay_approved_message(approval))

        self.assertEqual(events, [])
        self.assertEqual(prepare_calls, 0)
        self.assertIn("group:chat/~pen/general:drop-message", adapter._seen_ids)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 2)

        redelivered = self.dispatches(
            adapter,
            channel_event(
                "bot repeats",
                author=bot_author(),
                post_id="drop-message",
            ),
        )
        self.assertEqual(redelivered, [])
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 2)

    def test_already_seen_replay_does_not_redispatch_or_count(self):
        adapter = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "require_mention": False,
                "max_consecutive_bot_responses": 3,
            }
        )

        live = self.dispatches(
            adapter,
            channel_event("live first", author=bot_author(), post_id="live-1"),
        )
        self.assertEqual(len(live), 1)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

        events = []
        prepare_calls = 0

        async def record(event):
            events.append(event)

        async def fake_prepare(message, text):
            nonlocal prepare_calls
            prepare_calls += 1
            return text, adapter_mod.PreparedMedia()

        adapter.handle_message = record
        with patch.object(adapter, "_prepare_dispatch_payload", fake_prepare):
            asyncio.run(
                adapter._replay_approved_message(
                    {
                        "id": "seen1",
                        "type": "channel",
                        "requestingShip": "~bot",
                        "channelNest": "chat/~pen/general",
                        "originalMessage": {
                            "messageId": "live-1",
                            "messageText": "live first",
                            "timestamp": 1000,
                            "authorIsBot": True,
                        },
                    }
                )
            )

        self.assertEqual(events, [])
        self.assertEqual(prepare_calls, 0)
        self.assertEqual(adapter._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

    def test_replay_payload_round_trips_author_is_bot(self):
        adapter = self.make_adapter({"allowed_users": ["~bot"]})
        bot_message = tlon_api.TlonIncomingMessage(
            chat_id="chat/~pen/general",
            chat_name="general",
            chat_type="group",
            user_id="~bot",
            user_name="~bot",
            text="hello",
            message_id="m1",
            reply_to_message_id=None,
            sent_at=tlon_api._datetime_from_ms(1000),
            raw={},
            author_is_bot=True,
        )
        human_message = tlon_api.TlonIncomingMessage(
            chat_id="chat/~pen/general",
            chat_name="general",
            chat_type="group",
            user_id="~ten",
            user_name="~ten",
            text="hello",
            message_id="m2",
            reply_to_message_id=None,
            sent_at=tlon_api._datetime_from_ms(1000),
            raw={},
        )

        bot_payload = adapter._original_message_payload(bot_message)
        human_payload = adapter._original_message_payload(human_message)
        self.assertTrue(bot_payload["authorIsBot"])
        self.assertNotIn("authorIsBot", human_payload)

        fresh = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "max_consecutive_bot_responses": 1,
            }
        )
        events = []

        async def record(event):
            events.append(event)

        fresh.handle_message = record
        asyncio.run(
            fresh._replay_approved_message(
                {
                    "id": "persisted-channel",
                    "type": "channel",
                    "requestingShip": "~bot",
                    "channelNest": "chat/~pen/general",
                    "originalMessage": bot_payload,
                }
            )
        )

        self.assertEqual(len(events), 1)
        self.assertIn("~bot", fresh._known_bot_ships)
        self.assertEqual(fresh._known_bot_consecutive_by_channel["chat/~pen/general"], 1)

        dm_fresh = self.make_adapter(
            {
                "allowed_users": ["~bot"],
                "dm_allowlist": ["~bot"],
            }
        )
        dm_payload = dict(bot_payload)
        dm_payload["messageId"] = "dm-1"
        dm_fresh.handle_message = record
        asyncio.run(
            dm_fresh._replay_approved_message(
                {
                    "id": "persisted-dm",
                    "type": "dm",
                    "requestingShip": "~bot",
                    "originalMessage": dm_payload,
                }
            )
        )
        self.assertEqual(dm_fresh._known_bot_ships, set())
        self.assertEqual(dm_fresh._known_bot_consecutive_by_channel, {})

    def test_channel_access_open_admits_everyone(self):
        adapter = self.make_adapter()
        self.dispatches(
            adapter,
            channel_event("/channel-access open", author="~mug", post_id="1"),
        )
        self.assertEqual(
            adapter._sse.settings_writes("channelRules")[-1],
            {"chat/~pen/general": {"mode": "open"}},
        )
        self.assertIn("open — anyone here", adapter._cli.messages[-1][1])

        events = self.dispatches(
            adapter, channel_event("~pen hello!", author="~bus", post_id="2")
        )
        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._pending_approvals, [])

    def test_channel_access_open_unmonitored_nest_starts_monitoring(self):
        adapter = self.make_adapter()
        self.dispatches(
            adapter,
            dm_event("/channel-access open chat/~ten/lounge", author="~mug", whom="~mug"),
            dm=True,
        )
        self.assertIn("chat/~ten/lounge", adapter._monitored_channels)
        self.assertEqual(
            adapter._sse.settings_writes("groupChannels")[-1], ["chat/~ten/lounge"]
        )
        self.assertIn("Now monitoring this channel.", adapter._cli.messages[-1][1])

    def test_reply_flow_emits_reply_handled_telemetry(self):
        adapter = self.make_adapter({"telemetry": True, "telemetry_api_key": "phc_x"})
        telemetry_mod = sys.modules[f"{PACKAGE_NAME}.telemetry"]

        class FakeTelemetryClient:
            def __init__(self):
                self.captures = []

            def capture(self, *, distinct_id, event, properties):
                self.captures.append((event, properties))

        fake = FakeTelemetryClient()
        adapter._telemetry = telemetry_mod.TlonTelemetry(
            adapter.tlon_config, client_factory=lambda key, host: fake
        )
        self.assertTrue(adapter._telemetry.enabled)

        events = []

        async def record(event):
            await adapter.send(event.source.chat_id, "hello from the bot")
            events.append(event)

        adapter.handle_message = record
        asyncio.run(
            adapter._handle_dm_event(dm_event("hi there", author="~mug", whom="~mug"))
        )
        self.assertEqual(len(events), 1)
        asyncio.run(adapter.on_processing_complete(events[0], None))

        replies = [props for event, props in fake.captures if event == "TlonBot Reply Handled"]
        self.assertEqual(len(replies), 1)
        props = replies[0]
        self.assertEqual(props["harness"], "hermes")
        self.assertEqual(props["outcome"], "responded")
        self.assertEqual(props["chatType"], "dm")
        self.assertEqual(props["dispatchReason"], "dm")
        self.assertEqual(props["senderRole"], "owner")
        self.assertEqual(props["deliveredMessageCount"], 1)
        self.assertEqual(props["replyCharCount"], len("hello from the bot"))

    def make_instrumented_adapter(self, extra=None):
        adapter = self.make_adapter(
            {"telemetry": True, "telemetry_api_key": "phc_x", **(extra or {})}
        )
        telemetry_mod = sys.modules[f"{PACKAGE_NAME}.telemetry"]

        class FakeTelemetryClient:
            def __init__(self):
                self.captures = []

            def capture(self, *, distinct_id, event, properties):
                self.captures.append((event, properties))

            def identify(self, *, distinct_id, properties):
                pass

        fake = FakeTelemetryClient()
        adapter._telemetry = telemetry_mod.TlonTelemetry(
            adapter.tlon_config, client_factory=lambda key, host: fake
        )
        return adapter, fake

    def test_processing_failure_marks_reply_as_error(self):
        adapter, fake = self.make_instrumented_adapter()
        events = []

        async def record(event):
            events.append(event)  # no reply delivered

        adapter.handle_message = record
        asyncio.run(
            adapter._handle_dm_event(dm_event("hi", author="~mug", whom="~mug"))
        )
        outcome = types.SimpleNamespace(value="failure")
        asyncio.run(adapter.on_processing_complete(events[0], outcome))

        replies = [props for event, props in fake.captures if event == "TlonBot Reply Handled"]
        self.assertEqual(replies[0]["outcome"], "error")
        self.assertEqual(replies[0]["processingOutcome"], "failure")

    def test_handler_exception_reports_event_handler_not_stream_error(self):
        adapter, fake = self.make_instrumented_adapter()

        async def explode(raw):
            raise RuntimeError("handler bug for ~ten")

        adapter._handle_dm_event = explode
        event = types.SimpleNamespace(app="chat", json={"whom": "~ten"})
        asyncio.run(adapter._route_stream_event(event))  # must not raise

        errors = [props for name, props in fake.captures if name == "TlonBot Error"]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["component"], "event_handler")
        self.assertEqual(errors[0]["app"], "chat")
        self.assertEqual(errors[0]["errorType"], "RuntimeError")
        self.assertNotIn("~ten", errors[0]["detail"])

    def test_invite_accept_failure_emits_approval_error(self):
        adapter, fake = self.make_instrumented_adapter()

        class AcceptFailingCLI(FakeCLI):
            async def run_command(self, args):
                if tuple(args)[:2] == ("dms", "accept"):
                    self.commands.append(tuple(args))
                    return tlon_api.TlonSendResult(
                        success=False,
                        command=("tlon-test", *args),
                        error="rsvp poke failed",
                        returncode=1,
                    )
                return await super().run_command(args)

        adapter._cli = AcceptFailingCLI()
        self.dispatches(adapter, ["~ten"], dm=True)
        request_id = adapter._pending_approvals[0]["id"]

        self.dispatches(
            adapter, dm_event(f"/allow {request_id}", author="~mug", whom="~mug"), dm=True
        )

        # request stays pending and the failure is countable
        self.assertEqual(len(adapter._pending_approvals), 1)
        errors = [
            props
            for name, props in fake.captures
            if name == "TlonBot Error" and props.get("operation") == "invite_accept"
        ]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["component"], "approval")

    def test_object_settings_are_persisted_as_json_strings(self):
        # %settings values cannot hold objects — raw dict pokes are NACKED by
        # the ship and silently lost on restart. Pin the JSON-string encoding
        # (which is also what OpenClaw writes).
        adapter = self.make_adapter()
        self.dispatches(adapter, dm_event("hi"), dm=True)
        self.dispatches(
            adapter, channel_event("/channel-access open", author="~mug", post_id="9")
        )

        raw = {
            poke[2]["put-entry"]["entry-key"]: poke[2]["put-entry"]["value"]
            for poke in adapter._sse.pokes
            if poke[1] == "settings-event"
        }
        self.assertIsInstance(raw["pendingApprovals"], str)
        self.assertIsInstance(raw["channelRules"], str)
        self.assertEqual(
            json.loads(raw["channelRules"]),
            {"chat/~pen/general": {"mode": "open"}},
        )

    def test_settings_event_hot_reloads_approval_state(self):
        adapter = self.make_adapter()
        self.apply_settings_event(
            adapter,
            {
                "settings-event": {
                    "put-entry": {
                        "desk": "moltbot",
                        "bucket-key": "tlon",
                        "entry-key": "dmAllowlist",
                        "value": ["~bus"],
                    }
                }
            },
        )
        self.assertEqual(adapter._settings_dm_allowlist, {"~bus"})

        self.apply_settings_event(
            adapter,
            {
                "put-entry": {
                    "desk": "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": "channelRules",
                    "value": {"chat/~pen/general": {"mode": "open"}},
                }
            },
        )
        self.assertTrue(
            adapter_mod.is_channel_open(adapter._channel_rules, "chat/~pen/general")
        )


if __name__ == "__main__":
    unittest.main()
