import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("media.py")
SPEC = importlib.util.spec_from_file_location("hermes_tlon_adapter_media", MODULE_PATH)
media = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = media
SPEC.loader.exec_module(media)


def blob_entry(**overrides):
    entry = {
        "type": "file",
        "version": 1,
        "fileUri": "https://storage.example.com/report.pdf",
        "mimeType": "application/pdf",
        "name": "report.pdf",
        "size": 245760,
    }
    entry.update(overrides)
    return entry


class MediaParsingTests(unittest.TestCase):
    def test_parse_supported_entries_and_ignore_unknowns(self):
        blob = json.dumps(
            [
                {"type": "a2ui", "version": 1},
                {"type": "future", "version": 1},
                blob_entry(),
                blob_entry(
                    type="voicememo",
                    fileUri="https://storage.example.com/memo.m4a",
                    duration=12.5,
                    transcription="Hey check this out",
                    name="",
                    mimeType="",
                ),
                blob_entry(
                    type="video",
                    fileUri="https://storage.example.com/clip.mp4",
                    mimeType="video/mp4",
                    name="clip.mp4",
                    size=5242880,
                ),
            ]
        )

        entries = media.parse_blob_data(blob)

        self.assertEqual([entry.type for entry in entries], ["file", "voicememo", "video"])
        self.assertEqual(entries[1].transcription, "Hey check this out")
        self.assertEqual(entries[2].name, "clip.mp4")

    def test_malformed_blob_is_invisible(self):
        self.assertEqual(media.parse_blob_data("not json"), [])
        self.assertEqual(media.parse_blob_data(json.dumps({"type": "file"})), [])
        self.assertEqual(media.parse_blob_data(""), [])

    def test_active_and_compact_annotations(self):
        entries = media.parse_blob_data(
            json.dumps(
                [
                    blob_entry(),
                    blob_entry(
                        type="voicememo",
                        fileUri="https://storage.example.com/memo.m4a",
                        duration=12.5,
                        transcription="Hey check this out",
                        name="",
                        mimeType="",
                    ),
                    blob_entry(
                        type="video",
                        fileUri="https://storage.example.com/clip.mp4",
                        mimeType="video/mp4",
                        name="clip.mp4",
                        size=5242880,
                    ),
                ]
            )
        )

        active = media.format_blob_annotations(entries)
        compact = media.format_blob_for_history(entries)

        self.assertIn("report.pdf", active)
        self.assertIn("application/pdf", active)
        self.assertIn("240KB", active)
        self.assertIn("13s", active)
        self.assertIn('"Hey check this out"', active)
        self.assertIn("5.0MB", active)
        self.assertEqual(
            compact,
            '[📎 report.pdf]\n[🎙️ voice memo: "Hey check this out"]\n[🎬 clip.mp4]',
        )


class MediaPreparationTests(unittest.TestCase):
    def cache(self, kind):
        def fake_cache(data, *, filename="", mime_type="", default_kind=None):
            cache_kind = kind or default_kind or "document"
            return types.SimpleNamespace(
                path=f"/cache/{filename or cache_kind}",
                media_type=mime_type or f"{cache_kind}/test",
                kind=cache_kind,
            )

        return fake_cache

    async def fetched(self, uri, max_bytes):
        return media.FetchedMedia(data=b"media", content_type="", final_url=uri)

    def test_successful_file_cache_handoff(self):
        blob = json.dumps([blob_entry()])

        prepared = asyncio.run(
            media.prepare_inbound_media(
                None,
                blob,
                fetcher=self.fetched,
                cache_media=self.cache("document"),
            )
        )

        self.assertEqual(prepared.media_urls, ("/cache/report.pdf",))
        self.assertEqual(prepared.media_types, ("application/pdf",))
        self.assertEqual(prepared.message_type, "document")
        self.assertIn("report.pdf", prepared.text_prefix)

    def test_story_image_sets_photo_type(self):
        content = [
            {
                "block": {
                    "image": {
                        "src": "https://storage.example.com/diagram.png",
                        "alt": "diagram",
                    }
                }
            }
        ]

        prepared = asyncio.run(
            media.prepare_inbound_media(
                content,
                None,
                fetcher=self.fetched,
                cache_media=self.cache("image"),
            )
        )

        self.assertEqual(prepared.media_urls, ("/cache/diagram.png",))
        self.assertEqual(prepared.message_type, "photo")

    def test_voice_video_and_mixed_types(self):
        voice_blob = json.dumps(
            [blob_entry(type="voicememo", fileUri="https://x.example/memo.m4a", name="")]
        )
        video_blob = json.dumps(
            [
                blob_entry(
                    type="video",
                    fileUri="https://x.example/clip.mp4",
                    mimeType="video/mp4",
                    name="clip.mp4",
                )
            ]
        )
        mixed_blob = json.dumps(
            [
                blob_entry(name="a.pdf"),
                blob_entry(
                    type="video",
                    fileUri="https://x.example/clip.mp4",
                    mimeType="video/mp4",
                    name="clip.mp4",
                ),
            ]
        )

        voice = asyncio.run(
            media.prepare_inbound_media(
                None, voice_blob, fetcher=self.fetched, cache_media=self.cache("audio")
            )
        )
        video = asyncio.run(
            media.prepare_inbound_media(
                None, video_blob, fetcher=self.fetched, cache_media=self.cache("video")
            )
        )

        def mixed_cache(data, *, filename="", mime_type="", default_kind=None):
            kind = "video" if filename.endswith(".mp4") else "document"
            return types.SimpleNamespace(
                path=f"/cache/{filename}",
                media_type=mime_type or "application/octet-stream",
                kind=kind,
            )

        mixed = asyncio.run(
            media.prepare_inbound_media(
                None, mixed_blob, fetcher=self.fetched, cache_media=mixed_cache
            )
        )

        self.assertEqual(voice.message_type, "voice")
        self.assertEqual(video.message_type, "video")
        self.assertEqual(mixed.message_type, "document")

    def test_declared_oversized_blob_does_not_fetch(self):
        calls = []

        async def fake_fetch(uri, max_bytes):
            calls.append(uri)
            return await self.fetched(uri, max_bytes)

        blob = json.dumps(
            [blob_entry(size=media.MAX_BLOB_DOWNLOAD_BYTES + 1, name="large.pdf")]
        )
        prepared = asyncio.run(
            media.prepare_inbound_media(
                None, blob, fetcher=fake_fetch, cache_media=self.cache("document")
            )
        )

        self.assertEqual(calls, [])
        self.assertEqual(prepared.media_urls, ())
        self.assertIn("over the 100.0MB limit", prepared.text_prefix)

    def test_stream_oversized_failed_and_unsupported_notices(self):
        async def too_large(uri, max_bytes):
            raise media.MediaTooLargeError(max_bytes + 2, max_bytes)

        async def failed(uri, max_bytes):
            raise media.MediaDownloadError("boom")

        blob = json.dumps([blob_entry(name="report.heic", mimeType="image/heic")])
        oversized = asyncio.run(
            media.prepare_inbound_media(
                None, blob, fetcher=too_large, cache_media=self.cache("document")
            )
        )
        failed_prepared = asyncio.run(
            media.prepare_inbound_media(
                None, blob, fetcher=failed, cache_media=self.cache("document")
            )
        )
        unsupported = asyncio.run(
            media.prepare_inbound_media(
                None,
                blob,
                fetcher=self.fetched,
                cache_media=lambda *args, **kwargs: None,
            )
        )

        self.assertIn("over the 100.0MB limit", oversized.text_prefix)
        self.assertIn("could not be fetched", failed_prepared.text_prefix)
        self.assertIn("unsupported type", unsupported.text_prefix)


if __name__ == "__main__":
    unittest.main()
