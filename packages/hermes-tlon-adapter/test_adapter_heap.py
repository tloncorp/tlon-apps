"""Heap/gallery channel parsing, dispatch, history, and reaction coverage."""

import asyncio
import os
import sys
import unittest
from unittest.mock import patch

from test_adapter_attention import (  # noqa: E402
    MessageType,
    PlatformConfig,
    RecordingCLI,
    adapter_mod,
    channel_event,
    tlon_api,
)


HEAP_NEST = "heap/~zod/gallery"
history = sys.modules[f"{adapter_mod.__package__}.history"]


def heap_event(
    text="",
    *,
    author="~mug",
    post_id="170.141",
    content=None,
    title=None,
    nest=HEAP_NEST,
):
    raw = channel_event(
        text,
        author=author,
        nest=nest,
        post_id=post_id,
        content=content,
    )
    essay = raw["response"]["post"]["r-post"]["set"]["essay"]
    essay["kind"] = "/heap"
    if title is not None:
        essay["meta"] = title if not isinstance(title, str) else {"title": title}
    return raw


def heap_reply_event(
    text,
    *,
    author="~mug",
    parent_id="170.140",
    reply_id="170.141",
    nest=HEAP_NEST,
):
    return {
        "nest": nest,
        "response": {
            "post": {
                "id": parent_id,
                "r-post": {
                    "reply": {
                        "id": reply_id,
                        "r-reply": {
                            "set": {
                                "seal": {"parent-id": parent_id},
                                "reply-essay": {
                                    "author": author,
                                    "sent": 1000,
                                    "content": [{"inline": [text]}],
                                },
                            }
                        },
                    }
                },
            }
        },
    }


def heap_comment_reacts(*, post_id="170.141", parent_id="170.140", reacts=None):
    return {
        "nest": HEAP_NEST,
        "response": {
            "post": {
                "id": parent_id,
                "r-post": {
                    "reply": {
                        "id": post_id,
                        "r-reply": {"reacts": reacts or {"~mug": "🔥"}},
                    }
                },
            }
        },
    }


class RecordingScry:
    def __init__(self, payloads):
        self.payloads = payloads
        self.paths = []

    async def scry(self, path):
        self.paths.append(path)
        if path not in self.payloads:
            raise ConnectionError(f"no payload for {path}")
        return self.payloads[path]


class HeapAdapterTests(unittest.TestCase):
    def make_adapter(self, extra=None):
        config = {
            "node_url": "https://pen.tlon.network",
            "node_id": "~pen",
            "access_code": "code",
            "channels": [HEAP_NEST],
            "owner_ship": "~mug",
            "allowed_users": ["~mug"],
            "reaction_level": "minimal",
        }
        config.update(extra or {})
        with patch.dict(os.environ, {}, clear=True):
            adapter = adapter_mod.TlonAdapter(PlatformConfig(extra=config))
        adapter._cli = RecordingCLI()
        return adapter

    async def dispatches(self, adapter, *raw_events):
        events = []

        async def record(event):
            events.append(event)

        adapter.handle_message = record
        for raw in raw_events:
            await adapter._handle_channel_event(raw)
        return events

    def test_top_level_gallery_post_parses_caches_and_dispatches(self):
        adapter = self.make_adapter()
        raw = heap_event("~pen look at this gallery post")

        parsed = tlon_api.parse_channel_message(raw, self_ship="~pen")
        events = asyncio.run(self.dispatches(adapter, raw))

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.chat_id, HEAP_NEST)
        self.assertEqual(parsed.chat_type, "group")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].source.chat_id, HEAP_NEST)
        self.assertIsNotNone(adapter._message_cache.lookup(HEAP_NEST, "170.141"))

    def test_image_only_gallery_post_dispatches_and_prepares_media(self):
        adapter = self.make_adapter()
        content = [
            {
                "block": {
                    "image": {
                        "src": "https://storage.example.com/gallery.png",
                        "alt": "~pen gallery image",
                    }
                }
            }
        ]
        raw = heap_event(content=content)

        async def fake_prepare(story_content, raw_blob):
            self.assertEqual(story_content, content)
            self.assertIsNone(raw_blob)
            return adapter_mod.PreparedMedia(
                media_urls=("/cache/gallery.png",),
                media_types=("image/png",),
                message_type="photo",
            )

        with patch.object(adapter_mod, "prepare_inbound_media", fake_prepare):
            events = asyncio.run(self.dispatches(adapter, raw))

        parsed = tlon_api.parse_channel_message(raw, self_ship="~pen")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.text, "[image: ~pen gallery image]")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].message_type, MessageType.PHOTO)
        self.assertEqual(events[0].media_urls, ["/cache/gallery.png"])
        self.assertIsNotNone(adapter._message_cache.lookup(HEAP_NEST, "170.141"))

    def test_block_only_gallery_posts_dispatch_and_cache(self):
        cases = {
            "link": [
                {
                    "block": {
                        "link": {
                            "url": "https://example.com/gallery",
                            "meta": {"title": "~pen useful link"},
                        }
                    }
                }
            ],
            "header": [
                {
                    "block": {
                        "header": {
                            "tag": "h2",
                            "content": [{"ship": "~pen"}, " heading"],
                        }
                    }
                }
            ],
            "flat listing": [
                {
                    "block": {
                        "listing": {
                            "list": {
                                "type": "unordered",
                                "contents": [],
                                "items": [{"item": [{"ship": "~pen"}, " first"]}],
                            }
                        }
                    }
                }
            ],
            "nested listing": [
                {
                    "block": {
                        "listing": {
                            "list": {
                                "type": "unordered",
                                "contents": [{"ship": "~pen"}, " parent"],
                                "items": [
                                    {
                                        "list": {
                                            "type": "unordered",
                                            "contents": ["nested label"],
                                            "items": [{"item": ["nested item"]}],
                                        }
                                    }
                                ],
                            }
                        }
                    }
                }
            ],
            "task listing": [
                {
                    "block": {
                        "listing": {
                            "list": {
                                "type": "tasklist",
                                "contents": [],
                                "items": [
                                    {
                                        "item": [
                                            {
                                                "task": {
                                                    "checked": True,
                                                    "content": [
                                                        {"ship": "~pen"},
                                                        " done",
                                                    ],
                                                }
                                            }
                                        ]
                                    }
                                ],
                            }
                        }
                    }
                }
            ],
        }

        required_text = {
            "link": ("https://example.com/gallery",),
            "header": ("heading",),
            "flat listing": ("first",),
            "nested listing": ("parent", "nested label", "nested item"),
            "task listing": ("done", "[x]"),
        }

        for name, content in cases.items():
            with self.subTest(name=name):
                adapter = self.make_adapter()
                raw = heap_event(content=content, post_id=f"170.{len(name)}")
                events = asyncio.run(self.dispatches(adapter, raw))
                parsed = tlon_api.parse_channel_message(raw, self_ship="~pen")

                self.assertIsNotNone(parsed)
                for text in required_text[name]:
                    with self.subTest(required_text=text):
                        self.assertIn(text, parsed.text)
                self.assertEqual(len(events), 1)
                self.assertIsNotNone(
                    adapter._message_cache.lookup(HEAP_NEST, parsed.message_id)
                )

    def test_link_only_gallery_post_dispatches_for_owner_listen(self):
        adapter = self.make_adapter({"owner_listen_enabled_channels": HEAP_NEST})
        raw = heap_event(
            content=[
                {
                    "block": {
                        "link": {
                            "url": "https://example.com/gallery",
                            "meta": {"title": "Useful link"},
                        }
                    }
                }
            ]
        )

        events = asyncio.run(self.dispatches(adapter, raw))

        self.assertEqual(len(events), 1)
        self.assertIn("Useful link", events[0].text)

    def test_gallery_titles_are_live_heap_only_and_history_safe(self):
        title_only = heap_event(content=[], title="Gallery ~pen title")
        title_caption = heap_event(
            "~pen caption", post_id="170.142", title="Gallery title"
        )
        chat_title = heap_event(
            "caption",
            nest="chat/~zod/general",
            post_id="170.143",
            title="~pen invisible metadata",
        )
        malformed_meta = heap_event("caption", post_id="170.144", title=[])
        absent_meta = heap_event("caption", post_id="170.145")

        parsed_title = tlon_api.parse_channel_message(title_only, self_ship="~pen")
        parsed_caption = tlon_api.parse_channel_message(title_caption, self_ship="~pen")
        parsed_chat = tlon_api.parse_channel_message(chat_title, self_ship="~pen")

        self.assertIsNotNone(parsed_title)
        self.assertIn("Gallery ~pen title", parsed_title.text)
        self.assertIsNotNone(parsed_caption)
        self.assertIn("Gallery title", parsed_caption.text)
        self.assertIn("~pen caption", parsed_caption.text)
        self.assertIsNotNone(parsed_chat)
        self.assertEqual(parsed_chat.text, "caption")
        self.assertIsNotNone(tlon_api.parse_channel_message(malformed_meta, self_ship="~pen"))
        self.assertIsNotNone(tlon_api.parse_channel_message(absent_meta, self_ship="~pen"))

        adapter = self.make_adapter()
        events = asyncio.run(self.dispatches(adapter, title_only))
        self.assertEqual(len(events), 1)
        self.assertIn("Gallery ~pen title", events[0].text)

    def test_title_only_parent_reaches_thread_history_and_reaction_fetch(self):
        essay = {
            "author": "~pen",
            "sent": 1000,
            "content": [],
            "meta": {"title": "Gallery parent title"},
        }
        parent_path = f"/channels/v4/{HEAP_NEST}/posts/post/170.141"
        replies_path = (
            f"/channels/v4/{HEAP_NEST}/posts/post/id/170.141/replies/newest/5"
        )
        scry = RecordingScry(
            {
                parent_path: {"post": {"essay": essay, "seal": {"id": "170.141"}}},
                replies_path: {"replies": []},
            }
        )

        entries = asyncio.run(
            history.fetch_thread_context(scry.scry, HEAP_NEST, "170141", 5)
        )
        self.assertEqual([entry.content for entry in entries], ["Gallery parent title"])

        adapter = self.make_adapter()
        adapter._sse = RecordingScry(
            {
                parent_path: {"post": {"essay": essay, "seal": {"id": "170.141"}}},
            }
        )
        raw_reaction = {
            "nest": HEAP_NEST,
            "response": {
                "post": {"id": "170.141", "r-post": {"reacts": {"~mug": "👍"}}}
            },
        }
        events = asyncio.run(self.dispatches(adapter, raw_reaction))

        self.assertEqual(len(events), 1)
        self.assertIn("Gallery parent title", events[0].text)
        self.assertEqual(adapter._sse.paths, [parent_path])

    def test_gallery_reply_dispatches_as_a_thread_message(self):
        adapter = self.make_adapter()
        raw = heap_reply_event("~pen gallery comment")

        parsed = tlon_api.parse_channel_message(raw, self_ship="~pen")
        events = asyncio.run(self.dispatches(adapter, raw))

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.message_id, "170.141")
        self.assertEqual(parsed.reply_to_message_id, "170.140")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].source.thread_id, "170.140")

    def test_auto_discovers_heap_nest_and_dispatches(self):
        adapter = self.make_adapter(
            {"channels": ["chat/~pen/general"], "auto_discover": "true"}
        )
        raw = heap_event("~pen discover this", post_id="170.146")

        events = asyncio.run(self.dispatches(adapter, raw))

        self.assertIn(HEAP_NEST, adapter._monitored_channels)
        self.assertEqual(len(events), 1)

    def test_gallery_comment_reaction_dispatches_with_parent_id(self):
        adapter = self.make_adapter()
        own_comment = heap_reply_event(
            "bot comment", author="~pen", parent_id="170.150", reply_id="170.151"
        )
        raw_reacts = heap_comment_reacts(post_id="170.151", parent_id="170.150")

        events = asyncio.run(self.dispatches(adapter, own_comment, raw_reacts))

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].reply_to_message_id, "170.150")
        self.assertEqual(events[0].source.thread_id, "170.150")
        self.assertIn("[thread root: 170.150]", events[0].text)

    def test_top_level_gallery_control_reply_is_a_comment(self):
        adapter = self.make_adapter()
        raw = heap_event("/channel-access status", post_id="170.152")

        events = asyncio.run(self.dispatches(adapter, raw))

        self.assertEqual(events, [])
        self.assertEqual(len(adapter._cli.thread_replies), 1)
        self.assertEqual(adapter._cli.thread_replies[0][0], HEAP_NEST)
        self.assertEqual(adapter._cli.thread_replies[0][1], "170.152")
