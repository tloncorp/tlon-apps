import asyncio
import os
import re
import unittest
from types import SimpleNamespace
from unittest.mock import patch

# Reuse the gateway stubs and adapter loader used by the existing adapter tests.
from test_adapter_attention import (  # noqa: E402
    FakeCLI,
    PlatformConfig,
    RecordingCLI,
    adapter_mod,
    channel_event,
    tlon_api,
)


def channel_reacts(entries, *, post_id="170.141", parent_id=None):
    r_post = {"reacts": entries}
    if parent_id:
        r_post = {
            "reply": {"id": post_id, "r-reply": {"reacts": entries}}
        }
    return {
        "nest": "chat/~pen/general",
        "response": {"post": {"id": parent_id or post_id, "r-post": r_post}},
    }


def dm_react(*, post_id="~pen/170.141", author="~mug", emoji="👍", added=True, parent_id=None):
    delta = {"add-react": {"author": author, "react": emoji}} if added else {"del-react": author}
    response = delta
    if parent_id:
        response = {"reply": {"id": post_id, "delta": delta}}
    return {"whom": "~mug", "id": parent_id or post_id, "response": response}


# Wire id shapes the CLI parsers accept: a channel post/reply is a bare
# dotted @ud (`posts.ts`'s formatPostId/extractNumericId round-trip); a DM
# post/writ id is author-prefixed (`dms.ts`'s parsePostId splits on "/").
_CHANNEL_ID_RE = re.compile(r"^[0-9.]+$")
_DM_ID_RE = re.compile(r"^~[a-z0-9-]+/[0-9.]+$")


def _extract_marker(text, label):
    match = re.search(rf"\[{re.escape(label)}: ([^\]]+)\]", text)
    return match.group(1) if match else None


class RecordingSSE:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error
        self.paths = []

    async def scry(self, path):
        self.paths.append(path)
        if self.error:
            raise self.error
        if callable(self.payload):
            return self.payload(path)
        return self.payload


class AdapterReactionTests(unittest.TestCase):
    def make_adapter(self, extra=None):
        base = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": ["chat/~pen/general"],
            "allow_all_users": True,
            "require_mention": False,
            "reaction_level": "minimal",
        }
        base.update(extra or {})
        with patch.dict(os.environ, {}, clear=True):
            return adapter_mod.TlonAdapter(PlatformConfig(extra=base))

    async def channel_events(self, adapter, *raws):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        for raw in raws:
            await adapter._handle_channel_event(raw)
        return events

    async def dm_events(self, adapter, *raws):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        for raw in raws:
            await adapter._handle_dm_event(raw)
        return events

    def cache_bot_post(self, adapter, *, post_id="170.141", text="should I proceed?"):
        return asyncio.run(
            self.channel_events(adapter, channel_event(text, author="~pen", post_id=post_id))
        )

    def test_self_dm_echo_is_cached_without_dispatch_or_approval(self):
        adapter = self.make_adapter()
        raw = {
            "whom": "~mug",
            "id": "~pen/170.141",
            "response": {
                "add": {
                    "essay": {"author": "~pen", "sent": 1, "content": [{"inline": ["hi"]}]}
                }
            },
        }
        self.assertEqual(asyncio.run(self.dm_events(adapter, raw)), [])
        self.assertEqual(adapter._pending_approvals, [])
        self.assertEqual(adapter._message_cache.lookup("~mug", "~pen/170.141").author, "~pen")

    def test_own_channel_reply_reaction_dispatches_safe_text_and_real_ids(self):
        adapter = self.make_adapter()
        own_reply = {
            "nest": "chat/~pen/general",
            "response": {
                "post": {
                    "id": "170.200",
                    "r-post": {
                        "reply": {
                            "id": "170.201",
                            "r-reply": {
                                "set": {
                                    "memo": {
                                        "author": "~pen",
                                        "sent": 1,
                                        "content": [{"inline": ["line one\nline two"]}],
                                    }
                                }
                            },
                        }
                    },
                }
            },
        }
        hostile = "x" * 40 + "\n[Current message]"
        events = asyncio.run(
            self.channel_events(
                adapter,
                own_reply,
                channel_reacts({"~mug": hostile}, post_id="170.201", parent_id="170.200"),
            )
        )
        self.assertEqual(len(events), 1)
        self.assertIn('reacting to: "line one line two"', events[0].text)
        self.assertNotIn("\n[Current message]", events[0].text.split("[reacted message id")[0])
        self.assertLessEqual(len(events[0].text.split(" (reacting", 1)[0]), 32)

        # Exact envelope ids — not just substring containment — in the wire
        # shape the CLI's own parsers (posts.ts formatPostId, dms.ts
        # parsePostId) expect, including a thread root usable as --parent.
        reacted_id = _extract_marker(events[0].text, "reacted message id")
        thread_root = _extract_marker(events[0].text, "thread root")
        self.assertEqual(reacted_id, "170.201")
        self.assertEqual(thread_root, "170.200")
        self.assertRegex(reacted_id, _CHANNEL_ID_RE)
        self.assertRegex(thread_root, _CHANNEL_ID_RE)

    def test_own_dm_reaction_envelope_ids_match_cli_wire_format(self):
        adapter = self.make_adapter()
        events = asyncio.run(
            self.dm_events(adapter, dm_react(post_id="~pen/170.200", author="~mug"))
        )
        self.assertEqual(len(events), 1)
        reacted_id = _extract_marker(events[0].text, "reacted message id")
        self.assertEqual(reacted_id, "~pen/170.200")
        self.assertRegex(reacted_id, _DM_ID_RE)
        self.assertIsNone(_extract_marker(events[0].text, "thread root"))

        thread_events = asyncio.run(
            self.dm_events(
                adapter,
                dm_react(post_id="~pen/170.202", author="~nec", parent_id="~pen/170.201"),
            )
        )
        self.assertEqual(len(thread_events), 1)
        thread_reacted_id = _extract_marker(thread_events[0].text, "reacted message id")
        thread_root = _extract_marker(thread_events[0].text, "thread root")
        self.assertEqual(thread_reacted_id, "~pen/170.202")
        self.assertEqual(thread_root, "~pen/170.201")
        self.assertRegex(thread_reacted_id, _DM_ID_RE)
        self.assertRegex(thread_root, _DM_ID_RE)

    def test_reaction_state_snapshot_and_dm_delta_transitions(self):
        adapter = self.make_adapter()
        self.cache_bot_post(adapter)
        one = channel_reacts({"~mug": "👍"})
        two = channel_reacts({"~mug": "👍", "~nec": "🔥"})
        removed = channel_reacts({})
        readded = channel_reacts({"~mug": "👍"})
        events = asyncio.run(self.channel_events(adapter, one, one, two, removed, readded))
        # initial add, new entry, and a remove-then-re-add (seen-LRU bypassed)
        self.assertEqual(len(events), 3)
        # The re-add is the next dispatch, so it drains the two passive removal
        # notes only after core accepted that event.
        self.assertIn("[Recent reactions in this conversation]", events[-1].text)

        dm_adapter = self.make_adapter()
        dm_events = asyncio.run(
            self.dm_events(
                dm_adapter,
                dm_react(),
                dm_react(),
                dm_react(added=False),
                dm_react(added=False),
            )
        )
        self.assertEqual(len(dm_events), 1)
        self.assertEqual(len(dm_adapter._pending_reaction_notes["dm:~mug"]), 1)

        tombstone = self.make_adapter()
        asyncio.run(self.dm_events(tombstone, dm_react(added=False), dm_react(added=False)))
        self.assertEqual(len(tombstone._pending_reaction_notes["dm:~mug"]), 1)

    def test_snapshot_wire_keys_and_bad_snapshot_preserve_state(self):
        adapter = self.make_adapter()
        self.cache_bot_post(adapter)
        bot_entry = {
            "ship": "~mug",
            "nickname": "same-ship-bot",
            "avatar": None,
            "react": "🔥",
        }
        good = channel_reacts({"~mug": "👍", "~mug/bot": bot_entry})
        malformed = channel_reacts({"~mug": "👍", "~bad": {"unexpected": True}})
        events = asyncio.run(self.channel_events(adapter, good, malformed, good))
        self.assertEqual(len(events), 2)
        # The malformed full snapshot did not create a false removal/re-add.
        self.assertEqual(len(adapter._pending_reaction_notes), 0)

    def test_authorization_notes_drain_and_failure_retention(self):
        adapter = self.make_adapter({"allow_all_users": False, "allowed_users": ["~mug"]})
        asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": "👍"}, post_id="other")))
        key = "group:chat/~pen/general"
        self.assertIn(key, adapter._pending_reaction_notes)
        events = asyncio.run(self.channel_events(adapter, channel_event("hello", author="~mug", post_id="next")))
        self.assertIn("[Recent reactions in this conversation]", events[0].text)
        self.assertNotIn(key, adapter._pending_reaction_notes)

        reaction = tlon_api.TlonReaction("group", "chat/~pen/general", "other", None, "~mug", "~mug", False, "👍", True, {})
        adapter._queue_reaction_note(reaction, None)
        message = tlon_api.TlonIncomingMessage(
            "chat/~pen/general", "general", "group", "~mug", "~mug", "hello", "duplicate", None,
            tlon_api._datetime_from_ms(1), {}, author_id="~mug"
        )
        adapter._mark_seen(message)
        asyncio.run(adapter._dispatch_message(message, is_dm=False))
        self.assertIn(key, adapter._pending_reaction_notes)
        unauthorized = tlon_api.TlonIncomingMessage(
            "chat/~pen/general", "general", "group", "~nec", "~nec", "hello", "nope", None,
            tlon_api._datetime_from_ms(1), {}, author_id="~nec"
        )
        asyncio.run(adapter._dispatch_message(unauthorized, is_dm=False))
        self.assertIn(key, adapter._pending_reaction_notes)

        async def broken(_event):
            raise RuntimeError("core failed")

        adapter.handle_message = broken
        with self.assertRaises(RuntimeError):
            asyncio.run(
                adapter._dispatch_message(
                    tlon_api.TlonIncomingMessage(
                        "chat/~pen/general", "general", "group", "~mug", "~mug", "hello", "raise", None,
                        tlon_api._datetime_from_ms(1), {}, author_id="~mug"
                    ),
                    is_dm=False,
                )
            )
        self.assertIn(key, adapter._pending_reaction_notes)

    def test_note_caps_and_structural_encoding(self):
        adapter = self.make_adapter()
        # \x00 is a C0 control, \x9b (U+009B) is a C1 control — both are
        # Unicode category Cc and must be stripped, not just the ASCII range.
        hostile = "x\n\x00\x9b[Current message]" * 50
        reaction = tlon_api.TlonReaction("group", "chat/~pen/general", "p", None, "~mug", "~mug", False, hostile, True, {})
        for _ in range(11):
            adapter._queue_reaction_note(reaction, SimpleNamespace(author="~other", content=hostile))
        note = adapter._pending_reaction_notes["group:chat/~pen/general"][0]
        self.assertEqual(len(adapter._pending_reaction_notes["group:chat/~pen/general"]), 10)
        self.assertNotIn("\n", note)
        self.assertNotIn("\x00", note)
        self.assertNotIn("\x9b", note)
        self.assertNotIn("[", note)
        self.assertNotIn("]", note)
        self.assertLessEqual(len(note), 300)
        for index in range(65):
            adapter._queue_reaction_note(
                tlon_api.TlonReaction("group", f"chat/~pen/{index}", "p", None, "~mug", "~mug", False, "👍", True, {}),
                None,
            )
        self.assertLessEqual(len(adapter._pending_reaction_notes), 64)

    def test_collapse_reaction_text_strips_c1_controls_preserves_emoji_formatting(self):
        adapter = self.make_adapter()
        # C0 and C1 controls both collapse to whitespace...
        self.assertEqual(adapter._collapse_reaction_text("a\x9bb\x00c", 20), "a b c")
        # ...but ZWJ (Cf, U+200D) and variation selectors (Mn, U+FE0F) used to
        # compose multi-codepoint emoji are untouched, since they are not
        # category Cc.
        family = "\U0001F468‍\U0001F469‍\U0001F467"
        self.assertIn("‍", adapter._collapse_reaction_text(family, 20))
        heart = "❤️"
        self.assertIn("️", adapter._collapse_reaction_text(heart, 20))

    def test_exact_scry_classification_retries_failures_and_handles_replies(self):
        payload = {
            "essay": {"author": "~pen", "sent": 1, "content": [{"inline": ["pre-startup"]}]},
            "seal": {"id": "170.141"},
        }
        adapter = self.make_adapter()
        adapter._sse = RecordingSSE(payload)
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": "👍"})))
        self.assertEqual(len(events), 1)
        self.assertEqual(adapter._sse.paths, ["/channels/v4/chat/~pen/general/posts/post/170.141"])

        reply_payload = {
            "seal": {"id": "170.142"},
            "revision": 1,
            "memo": {"author": "~pen", "sent": 1, "content": [{"inline": ["reply text"]}]},
        }
        reply_adapter = self.make_adapter()
        reply_adapter._sse = RecordingSSE(reply_payload)
        reply_events = asyncio.run(
            self.channel_events(
                reply_adapter,
                channel_reacts({"~mug": "👍"}, post_id="170.142", parent_id="170.141"),
            )
        )
        self.assertEqual(len(reply_events), 1)
        self.assertEqual(
            reply_adapter._sse.paths,
            ["/channels/v4/chat/~pen/general/posts/post/id/170.141/replies/reply/id/170.142"],
        )

        flaky = self.make_adapter()
        flaky._sse = RecordingSSE(error=RuntimeError("temporary"))
        asyncio.run(self.channel_events(flaky, channel_reacts({"~mug": "👍"})))
        flaky._sse.error = None
        flaky._sse.payload = payload
        events = asyncio.run(self.channel_events(flaky, channel_reacts({"~nec": "🔥"})))
        self.assertEqual(len(events), 1)
        self.assertEqual(len(flaky._sse.paths), 2)

    def test_snapshot_scry_failure_memoized_across_transitions(self):
        # I1: a failing exact scry for one post is made once per SSE event,
        # not once per authorized transition sharing that post — otherwise a
        # multi-entry snapshot repeats the 30s scry timeout per reactor and
        # stalls the serial SSE loop.
        adapter = self.make_adapter()
        adapter._sse = RecordingSSE(error=RuntimeError("boom"))
        events = asyncio.run(
            self.channel_events(adapter, channel_reacts({"~mug": "👍", "~nec": "🔥"}))
        )
        self.assertEqual(events, [])
        self.assertEqual(len(adapter._sse.paths), 1)
        notes = adapter._pending_reaction_notes["group:chat/~pen/general"]
        self.assertEqual(len(notes), 2)

    def test_snapshot_transition_exception_does_not_abort_remaining_transitions(self):
        # I2: apply_channel_snapshot() already committed the new map before
        # returning transitions, so a raise handling the first must not lose
        # the rest — an SSE redelivery of the same snapshot is a no-op diff
        # once state is committed, so anything skipped here is lost for good.
        adapter = self.make_adapter()
        self.cache_bot_post(adapter)
        calls = []

        async def flaky(event):
            calls.append(event)
            if len(calls) == 1:
                raise RuntimeError("boom")

        adapter.handle_message = flaky
        asyncio.run(
            adapter._handle_channel_event(channel_reacts({"~mug": "👍", "~nec": "🔥"}))
        )
        self.assertEqual(len(calls), 2)

    def test_unresolved_own_post_reaction_retries_after_scry_recovery(self):
        # Codex PR review P2: the snapshot commits before its transitions are
        # handled, so an added reaction whose exact scry fails must be
        # forgotten from state — otherwise redelivery of the same reacts map
        # is a no-op diff and the own-post reaction is permanently misfiled
        # as a passive note even after the scry recovers.
        payload = {
            "essay": {"author": "~pen", "sent": 1, "content": [{"inline": ["pre-startup"]}]},
            "seal": {"id": "170.141"},
        }
        adapter = self.make_adapter()
        adapter._sse = RecordingSSE(error=RuntimeError("temporary"))
        snapshot = channel_reacts({"~mug": "👍"})
        self.assertEqual(asyncio.run(self.channel_events(adapter, snapshot)), [])
        self.assertEqual(
            len(adapter._pending_reaction_notes["group:chat/~pen/general"]), 1
        )

        adapter._sse.error = None
        adapter._sse.payload = payload
        events = asyncio.run(self.channel_events(adapter, snapshot))
        self.assertEqual(len(events), 1)
        self.assertIn("👍", events[0].text)
        self.assertEqual(len(adapter._sse.paths), 2)

        # A resolved non-own target is final: the identical snapshot a third
        # time must not re-dispatch or re-scry (no rollback for real authors).
        other_payload = {
            "essay": {"author": "~mug", "sent": 1, "content": [{"inline": ["hers"]}]},
            "seal": {"id": "170.150"},
        }
        settled = self.make_adapter()
        settled._sse = RecordingSSE(other_payload)
        other_snapshot = channel_reacts({"~nec": "🔥"}, post_id="170.150")
        asyncio.run(self.channel_events(settled, other_snapshot))
        self.assertEqual(asyncio.run(self.channel_events(settled, other_snapshot)), [])
        self.assertEqual(len(settled._sse.paths), 1)

    def test_exact_scry_partial_payload_not_cached_negative(self):
        # M4: an exact scry that has text but no decodable author cannot
        # classify ownership, so it must not be cached as a durable "not own
        # post" result — a later reaction on the same post should re-scry.
        partial_payload = {
            "essay": {"author": None, "sent": 1, "content": [{"inline": ["partial"]}]},
            "seal": {"id": "170.141"},
        }
        valid_payload = {
            "essay": {"author": "~pen", "sent": 1, "content": [{"inline": ["now valid"]}]},
            "seal": {"id": "170.141"},
        }
        adapter = self.make_adapter()
        adapter._sse = RecordingSSE(partial_payload)
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": "👍"})))
        self.assertEqual(events, [])
        self.assertIsNone(adapter._message_cache.lookup("chat/~pen/general", "170.141"))

        adapter._sse.payload = valid_payload
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~nec": "🔥"})))
        self.assertEqual(len(events), 1)
        self.assertEqual(len(adapter._sse.paths), 2)
        self.assertIn("[reacted message id: 170.141]", events[0].text)

    def test_synthetic_message_id_caps_hostile_emoji_deterministically(self):
        # M7: the react component of the synthetic dispatch id is bounded
        # the same way ReactionState comparison values are (digest over 256
        # chars), and stays deterministic for the same input.
        adapter = self.make_adapter()
        self.cache_bot_post(adapter)
        hostile = "x" * 500
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": hostile})))
        self.assertEqual(len(events), 1)
        message_id = events[0].message_id
        self.assertTrue(message_id.startswith("react/170.141/~mug/sha256:"))
        self.assertLess(len(message_id), 150)

        again = self.make_adapter()
        self.cache_bot_post(again)
        again_events = asyncio.run(self.channel_events(again, channel_reacts({"~mug": hostile})))
        self.assertEqual(again_events[0].message_id, message_id)

    def test_reply_in_thread_reaction_fallback_uses_real_target_not_synthetic_id(self):
        # I3: with TLON_REPLY_IN_THREAD=true, a reply to a top-level own-post
        # reaction dispatch must thread on the real reacted post, not the
        # synthetic `react/<post>/<reactor>/<emoji>` trigger id (which is not
        # a real wire post and cannot be replied to).
        adapter = self.make_adapter({"reply_in_thread": True})
        self.cache_bot_post(adapter)
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": "👍"})))
        self.assertEqual(len(events), 1)
        message_id = events[0].message_id
        self.assertTrue(message_id.startswith("react/"))

        adapter._cli = RecordingCLI()
        asyncio.run(
            adapter.send("chat/~pen/general", "nice", reply_to=message_id, metadata=None)
        )
        self.assertEqual(len(adapter._cli.thread_replies), 1)
        self.assertEqual(adapter._cli.thread_replies[0][1], "170.141")

    def test_reply_in_thread_reaction_retry_keeps_real_channel_target(self):
        adapter = self.make_adapter({"reply_in_thread": True})
        self.cache_bot_post(adapter)
        events = asyncio.run(self.channel_events(adapter, channel_reacts({"~mug": "👍"})))
        self.assertEqual(len(events), 1)
        message_id = events[0].message_id
        self.assertTrue(message_id.startswith("react/"))

        timeout = tlon_api.TlonSendResult(
            success=False,
            command=("tlon-test", "posts", "reply"),
            returncode=124,
            error="timeout",
        )
        adapter._cli = RecordingCLI(results=[timeout])
        first = asyncio.run(
            adapter.send("chat/~pen/general", "nice", reply_to=message_id, metadata=None)
        )
        retry = asyncio.run(
            adapter.send("chat/~pen/general", "nice", reply_to=message_id, metadata=None)
        )

        self.assertFalse(first.success)
        self.assertTrue(first.retryable)
        self.assertTrue(retry.success)
        self.assertEqual(
            [reply[1] for reply in adapter._cli.thread_replies],
            ["170.141", "170.141"],
        )

    def test_reply_in_thread_dm_reaction_fallback_uses_real_target_and_parent_author(self):
        # I3 (DM): same fallback bug additionally corrupted parent_author —
        # normalize_ship("react") == "~react" — since the synthetic id's
        # first path segment ("react") was read as the author prefix.
        adapter = self.make_adapter({"reply_in_thread": True})
        events = asyncio.run(
            self.dm_events(adapter, dm_react(post_id="~pen/170.150", author="~mug"))
        )
        self.assertEqual(len(events), 1)
        message_id = events[0].message_id
        self.assertTrue(message_id.startswith("react/~pen/170.150/~mug/"))

        adapter._cli = RecordingCLI()
        asyncio.run(adapter.send("~mug", "nice", reply_to=message_id, metadata=None))
        self.assertEqual(len(adapter._cli.thread_replies), 1)
        self.assertEqual(adapter._cli.thread_replies[0][1], "~pen/170.150")
        self.assertEqual(adapter._cli.thread_replies[0][3], "~pen")

    def test_reply_in_thread_dm_reaction_retry_keeps_target_and_parent_author(self):
        adapter = self.make_adapter({"reply_in_thread": True})
        events = asyncio.run(
            self.dm_events(adapter, dm_react(post_id="~pen/170.150", author="~mug"))
        )
        self.assertEqual(len(events), 1)
        message_id = events[0].message_id
        self.assertTrue(message_id.startswith("react/~pen/170.150/~mug/"))

        timeout = tlon_api.TlonSendResult(
            success=False,
            command=("tlon-test", "dms", "reply"),
            returncode=124,
            error="timeout",
        )
        adapter._cli = RecordingCLI(results=[timeout])
        first = asyncio.run(adapter.send("~mug", "nice", reply_to=message_id, metadata=None))
        retry = asyncio.run(adapter.send("~mug", "nice", reply_to=message_id, metadata=None))

        self.assertFalse(first.success)
        self.assertTrue(first.retryable)
        self.assertTrue(retry.success)
        self.assertEqual(
            [reply[1] for reply in adapter._cli.thread_replies],
            ["~pen/170.150", "~pen/170.150"],
        )
        self.assertEqual(
            [reply[3] for reply in adapter._cli.thread_replies],
            ["~pen", "~pen"],
        )

    def test_bot_loop_envelope_levels_send_parent_author_and_disconnect_cleanup(self):
        adapter = self.make_adapter({"max_consecutive_bot_responses": 1})
        self.cache_bot_post(adapter)
        bot = {"ship": "~other", "nickname": "bot", "avatar": None, "react": "👍"}
        bot2 = {"ship": "~third", "nickname": "bot", "avatar": None, "react": "🔥"}
        events = asyncio.run(
            self.channel_events(adapter, channel_reacts({"~other/bot": bot}), channel_reacts({"~other/bot": bot, "~third/bot": bot2}))
        )
        self.assertEqual(len(events), 1)
        self.assertIn("[reacted message id: 170.141]", events[0].text)
        self.assertIn("~other", adapter._known_bot_ships)

        dm = self.make_adapter()
        dm._cli = RecordingCLI()
        asyncio.run(dm.send("~mug", "reply", reply_to="event", metadata={"thread_id": "~pen/root"}))
        self.assertEqual(dm._cli.thread_replies[0][3], "~pen")

        for level in ("off", "ack"):
            plain = self.make_adapter({"reaction_level": level})
            events = asyncio.run(self.channel_events(plain, channel_event("hello", author="~mug")))
            self.assertNotIn("[message id:", events[0].text)

        adapter._queue_reaction_note(
            tlon_api.TlonReaction("group", "chat/~pen/general", "p", None, "~mug", "~mug", False, "👍", True, {}), None
        )
        # Sanity: the channel_events() calls above populated ReactionState
        # for chat/~pen/general's post 170.141 before disconnect clears it.
        self.assertTrue(len(adapter._reaction_state._conversations) > 0)
        asyncio.run(adapter.disconnect())
        self.assertEqual(len(adapter._pending_reaction_notes), 0)
        self.assertIsNone(adapter._message_cache.lookup("chat/~pen/general", "170.141"))
        self.assertEqual(len(adapter._reaction_state._conversations), 0)


if __name__ == "__main__":
    unittest.main()
