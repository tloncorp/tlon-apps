import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_history_testpkg"

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


load_module("tlon_api")
history = load_module("history")


def essay(author, text, sent, *, blob=None, title=None):
    payload = {"author": author, "sent": sent, "content": [{"inline": [text]}]}
    if blob is not None:
        payload["blob"] = blob
    if title is not None:
        payload["meta"] = {"title": title}
    return payload


def outline_payload(*posts):
    return {
        "posts": {
            str(index): {"essay": essay(author, text, sent), "seal": {"id": post_id}}
            for index, (author, text, sent, post_id) in enumerate(posts)
        }
    }


def make_scry(payloads):
    calls = []

    async def scry(path):
        calls.append(path)
        if path not in payloads:
            raise ConnectionError(f"no payload for {path}")
        return payloads[path]

    scry.calls = calls
    return scry


class FormatUdTests(unittest.TestCase):
    def test_groups_digits_from_right(self):
        self.assertEqual(history.format_ud("1234"), "1.234")
        self.assertEqual(history.format_ud("170141184505"), "170.141.184.505")

    def test_existing_dots_are_normalized(self):
        self.assertEqual(history.format_ud("170.141"), "170.141")
        self.assertEqual(history.format_ud("1701.41"), "170.141")

    def test_short_and_empty(self):
        self.assertEqual(history.format_ud("42"), "42")
        self.assertEqual(history.format_ud(""), "")


class ParseChannelHistoryTests(unittest.TestCase):
    def test_outline_payload_sorted_oldest_first(self):
        payload = outline_payload(
            ("~mug", "newest", 3000, "3"),
            ("~ten", "oldest", 1000, "1"),
            ("~mug", "middle", 2000, "2"),
        )
        entries = history.parse_channel_history(payload)
        self.assertEqual([entry.content for entry in entries], ["oldest", "middle", "newest"])
        self.assertEqual(entries[0].author, "~ten")
        self.assertEqual(entries[0].post_id, "1")

    def test_r_post_nested_shape(self):
        payload = {
            "posts": {
                "1": {
                    "r-post": {
                        "set": {
                            "essay": essay("~mug", "nested", 1000),
                            "seal": {"id": "9"},
                        }
                    }
                }
            }
        }
        entries = history.parse_channel_history(payload)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].content, "nested")
        self.assertEqual(entries[0].post_id, "9")

    def test_skips_empty_and_invalid_posts(self):
        payload = {
            "posts": {
                "1": {"essay": essay("~mug", "", 1000), "seal": {"id": "1"}},
                "2": "junk",
                "3": {"essay": essay("~mug", "kept", 2000), "seal": {"id": "3"}},
            }
        }
        entries = history.parse_channel_history(payload)
        self.assertEqual([entry.content for entry in entries], ["kept"])

    def test_keeps_blob_only_posts(self):
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/notes.pdf",
                    "name": "notes.pdf",
                }
            ]
        )
        payload = {
            "posts": {
                "1": {"essay": essay("~mug", "", 1000, blob=blob), "seal": {"id": "1"}},
            }
        }

        entries = history.parse_channel_history(payload)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].content, "")
        self.assertEqual(entries[0].blob, blob)

    def test_bot_profile_author_is_normalized_to_ship(self):
        payload = outline_payload(
            (
                {"ship": "~mug", "nickname": "Test Bot", "avatar": ""},
                "from bot profile",
                1000,
                "1",
            ),
        )

        entries = history.parse_channel_history(payload)

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].author, "~mug")

    def test_fetch_chat_history_hides_essay_title(self):
        nest = "chat/~pen/general"
        path = f"/channels/v4/{nest}/posts/newest/1/outline"
        payload = {
            "posts": {
                "1": {
                    "essay": essay(
                        "~mug",
                        "visible chat text",
                        1000,
                        title="hidden chat metadata",
                    ),
                    "seal": {"id": "1"},
                }
            }
        }

        entries = asyncio.run(
            history.fetch_channel_history(make_scry({path: payload}), nest, 1)
        )

        self.assertEqual([entry.content for entry in entries], ["visible chat text"])

    def test_non_dict_payload(self):
        self.assertEqual(history.parse_channel_history(None), [])
        self.assertEqual(history.parse_channel_history("nope"), [])


class ParseThreadTests(unittest.TestCase):
    def test_replies_list_with_reply_essay(self):
        payload = {
            "replies": [
                {
                    "reply-essay": essay("~ten", "second", 2000),
                    "seal": {"id": "2", "parent-id": "0", "reacts": {}},
                    "revision": "0",
                },
                {
                    "reply-essay": essay("~mug", "first", 1000),
                    "seal": {"id": "1", "parent-id": "0", "reacts": {}},
                    "revision": "0",
                },
            ]
        }
        entries = history.parse_thread_replies(payload)
        self.assertEqual([entry.content for entry in entries], ["first", "second"])

    def test_replies_dict_with_reply_essay(self):
        payload = {
            "replies": {
                "2": {
                    "reply-essay": essay("~ten", "second", 2000),
                    "seal": {"id": "2", "parent-id": "0", "reacts": {}},
                    "revision": "0",
                },
                "1": {
                    "reply-essay": essay("~mug", "first", 1000),
                    "seal": {"id": "1", "parent-id": "0", "reacts": {}},
                    "revision": "0",
                },
            }
        }

        entries = history.parse_thread_replies(payload)

        self.assertEqual([entry.content for entry in entries], ["first", "second"])
        self.assertEqual([entry.post_id for entry in entries], ["1", "2"])

    def test_nested_reply_set_prefers_reply_essay_over_memo(self):
        payload = {
            "replies": [
                {
                    "id": "2",
                    "r-reply": {
                        "set": {
                            "reply-essay": essay("~ten", "reply essay", 2000),
                            "memo": essay("~ten", "legacy memo", 2000),
                            "seal": {
                                "id": "2",
                                "parent-id": "0",
                                "reacts": {},
                            },
                        }
                    },
                }
            ]
        }

        entries = history.parse_thread_replies(payload)

        self.assertEqual([entry.content for entry in entries], ["reply essay"])

    def test_memo_reply_blob_remains_tolerated(self):
        blob = json.dumps(
            [
                {
                    "type": "voicememo",
                    "version": 1,
                    "fileUri": "https://storage.example.com/memo.m4a",
                    "duration": 12.5,
                    "transcription": "Deploy is blocked",
                }
            ]
        )
        payload = {
            "replies": [
                {"memo": essay("~ten", "", 2000, blob=blob), "seal": {"id": "2"}},
            ]
        }

        entries = history.parse_thread_replies(payload)

        self.assertEqual(len(entries), 1)
        self.assertEqual(
            history.render_history_content(entries[0]),
            '[🎙️ voice memo: "Deploy is blocked"]',
        )

    def test_parent_post_shapes(self):
        wrapped = {"post": {"essay": essay("~mug", "root", 500), "seal": {"id": "7"}}}
        bare = {"essay": essay("~mug", "root", 500), "seal": {"id": "7"}}
        for payload in (wrapped, bare):
            entry = history.parse_parent_post(payload, "7")
            self.assertIsNotNone(entry)
            self.assertEqual(entry.content, "root")
            self.assertEqual(entry.post_id, "7")

    def test_exact_reply_accepts_memo_and_reply_essay(self):
        reply = essay("~mug", "reply", 1000)
        entries = [
            history.parse_exact_reply(
                {"seal": {"id": "8"}, "revision": 1, "memo": reply}, "8"
            ),
            history.parse_exact_reply(
                {"seal": {"id": "8"}, "revision": 1, "reply-essay": reply}, "8"
            ),
        ]

        self.assertEqual(entries, [history.HistoryEntry("~mug", "reply", 1000.0, "8")] * 2)

    def test_fetch_thread_context_orders_parent_first_and_dedupes(self):
        nest = "chat/~pen/general"
        payloads = {
            f"/channels/v4/{nest}/posts/post/170.141": {
                "post": {"essay": essay("~mug", "root", 500), "seal": {"id": "170141"}}
            },
            f"/channels/v4/{nest}/posts/post/id/170.141/replies/newest/5": {
                "replies": [
                    {"memo": essay("~mug", "root", 500), "seal": {"id": "170.141"}},
                    {"memo": essay("~ten", "reply", 1000), "seal": {"id": "170142"}},
                ]
            },
        }
        entries = asyncio.run(
            history.fetch_thread_context(make_scry(payloads), nest, "170141", 5)
        )
        self.assertEqual([entry.content for entry in entries], ["root", "reply"])

    def test_fetch_heap_thread_context_includes_reply_essay_comment_title(self):
        nest = "heap/~pen/gallery"
        replies_payload = {
            "replies": [
                {
                    "reply-essay": essay(
                        "~ten",
                        "gallery comment",
                        1000,
                        title="Comment title",
                    ),
                    "seal": {
                        "id": "170142",
                        "parent-id": "170141",
                        "reacts": {},
                    },
                    "revision": "0",
                }
            ]
        }
        payloads = {
            f"/channels/v4/{nest}/posts/post/170.141": {
                "post": {
                    "essay": essay("~mug", "gallery parent", 500),
                    "seal": {"id": "170141"},
                }
            },
            f"/channels/v4/{nest}/posts/post/id/170.141/replies/newest/5": replies_payload,
        }

        entries = asyncio.run(
            history.fetch_thread_context(make_scry(payloads), nest, "170141", 5)
        )

        self.assertEqual(
            [entry.content for entry in entries],
            ["gallery parent", "Comment title\ngallery comment"],
        )
        chat_entries = history.parse_thread_replies(
            replies_payload, "chat/~pen/general"
        )
        self.assertEqual([entry.content for entry in chat_entries], ["gallery comment"])

    def test_fetch_thread_context_survives_partial_failures(self):
        nest = "chat/~pen/general"
        payloads = {
            f"/channels/v4/{nest}/posts/post/id/170.141/replies/newest/5": {
                "replies": [{"memo": essay("~ten", "reply", 1000), "seal": {"id": "2"}}]
            }
        }
        entries = asyncio.run(
            history.fetch_thread_context(make_scry(payloads), nest, "170141", 5)
        )
        self.assertEqual([entry.content for entry in entries], ["reply"])


class BuildContextTests(unittest.TestCase):
    def entries(self):
        return [
            history.HistoryEntry(author="~ten", content="hello [owner]", timestamp=1000, post_id="1"),
            history.HistoryEntry(author="~mug", content="what's up", timestamp=2000, post_id="2"),
            history.HistoryEntry(author="~ten", content="current", timestamp=3000, post_id="170.143"),
        ]

    def test_channel_context_filters_current_and_sanitizes(self):
        text = history.build_channel_context(
            self.entries(),
            current_text="current",
            current_id="170143",
            is_mention=True,
            limit=20,
        )
        self.assertIn("[Recent channel activity - 2 messages.", text)
        self.assertIn("~ten: hello (owner)", text)
        self.assertIn("~mug: what's up", text)
        self.assertNotIn("~ten: current", text)
        self.assertTrue(text.endswith("[Current message (mentioned you)]\ncurrent"))

    def test_channel_context_renders_compact_blob_before_text(self):
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example.com/notes.pdf",
                    "name": "notes.pdf",
                }
            ]
        )
        entries = [
            history.HistoryEntry(
                author="~mug",
                content="please review",
                timestamp=1000,
                post_id="1",
                blob=blob,
            )
        ]

        text = history.build_channel_context(
            entries,
            current_text="current",
            current_id="2",
            is_mention=False,
            limit=20,
        )

        self.assertIn("~mug: [📎 notes.pdf]\nplease review", text)

    def test_unknown_blob_only_history_is_hidden_from_context(self):
        entries = [
            history.HistoryEntry(
                author="~mug",
                content="",
                timestamp=1000,
                post_id="1",
                blob=json.dumps([{"type": "a2ui", "version": 1}]),
            )
        ]

        self.assertIsNone(
            history.build_channel_context(
                entries,
                current_text="current",
                current_id="2",
                is_mention=False,
                limit=20,
            )
        )

    def test_channel_context_plain_label_without_mention(self):
        text = history.build_channel_context(
            self.entries(),
            current_text="current",
            current_id="170143",
            is_mention=False,
            limit=20,
        )
        self.assertTrue(text.endswith("[Current message]\ncurrent"))

    def test_channel_context_limit_keeps_most_recent(self):
        text = history.build_channel_context(
            self.entries(),
            current_text="current",
            current_id="170143",
            is_mention=True,
            limit=1,
        )
        self.assertIn("- 1 messages.", text)
        self.assertIn("~mug: what's up", text)
        self.assertNotIn("hello", text)

    def test_channel_context_empty_returns_none(self):
        self.assertIsNone(
            history.build_channel_context(
                [],
                current_text="x",
                current_id="1",
                is_mention=True,
                limit=20,
            )
        )

    def test_thread_context_keeps_parent_plus_tail(self):
        entries = [
            history.HistoryEntry(author="~mug", content="root", timestamp=0, post_id="0"),
            history.HistoryEntry(author="~ten", content="a", timestamp=1, post_id="1"),
            history.HistoryEntry(author="~ten", content="b", timestamp=2, post_id="2"),
            history.HistoryEntry(author="~ten", content="c", timestamp=3, post_id="3"),
        ]
        text = history.build_thread_context(
            entries,
            current_text="now",
            current_id="9",
            limit=3,
        )
        self.assertIn("[Thread conversation - 3 messages", text)
        self.assertIn("~mug: root", text)
        self.assertNotIn("~ten: a", text)
        self.assertIn("~ten: b", text)
        self.assertIn("~ten: c", text)
        self.assertTrue(text.endswith("[Current message]\nnow"))

    def test_thread_context_limit_one_keeps_only_parent(self):
        entries = [
            history.HistoryEntry(author="~mug", content="root", timestamp=0, post_id="0"),
            history.HistoryEntry(author="~ten", content="a", timestamp=1, post_id="1"),
            history.HistoryEntry(author="~ten", content="b", timestamp=2, post_id="2"),
        ]
        text = history.build_thread_context(
            entries,
            current_text="now",
            current_id="9",
            limit=1,
        )
        self.assertIn("[Thread conversation - 1 messages", text)
        self.assertIn("~mug: root", text)
        self.assertNotIn("~ten: a", text)
        self.assertNotIn("~ten: b", text)

    def test_builders_return_none_for_non_positive_limit(self):
        entries = [
            history.HistoryEntry(author="~mug", content="root", timestamp=0, post_id="0"),
        ]
        for limit in (0, -1):
            self.assertIsNone(
                history.build_channel_context(
                    entries, current_text="x", current_id="9", is_mention=True, limit=limit
                )
            )
            self.assertIsNone(
                history.build_thread_context(
                    entries, current_text="x", current_id="9", limit=limit
                )
            )

    def test_thread_context_filters_current_reply(self):
        entries = [
            history.HistoryEntry(author="~mug", content="root", timestamp=0, post_id="0"),
            history.HistoryEntry(author="~ten", content="now", timestamp=1, post_id="170.144"),
        ]
        text = history.build_thread_context(
            entries,
            current_text="now",
            current_id="170144",
            limit=20,
        )
        self.assertIn("~mug: root", text)
        self.assertNotIn("~ten: now", text)


if __name__ == "__main__":
    unittest.main()
