import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_cite_testpkg"

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
load_module("media")
load_module("history")
cite = load_module("cite")


POST_ID = "170141184506536961460817141626482720768"
REPLY_ID = "170141184506537047334633492345058754560"
NEST = "chat/~host/chan"


def chan_cite(where, *, nest=NEST):
    return {"block": {"cite": {"chan": {"nest": nest, "where": where}}}}


def essay_payload(author="~real-author", text="hello", *, blob=None):
    essay = {
        "author": author,
        "sent": 1000,
        "content": [{"inline": [text]}],
    }
    if blob is not None:
        essay["blob"] = blob
    return {"essay": essay, "seal": {"id": POST_ID}}


def reply_payload(author="~real-author", text="reply"):
    return {
        "seal": {"id": REPLY_ID},
        "revision": 1,
        "memo": {
            "author": author,
            "sent": 1000,
            "content": [{"inline": [text]}],
        },
    }


def recording_scry(payload=None, *, errors=()):
    calls = []
    remaining_errors = list(errors)

    async def scry(path):
        calls.append(path)
        if remaining_errors:
            raise remaining_errors.pop(0)
        return payload if payload is not None else essay_payload()

    scry.calls = calls
    return scry


class ExtractCitesTests(unittest.TestCase):
    def test_current_client_top_level_form(self):
        parsed = cite.extract_cites([chan_cite(f"/msg/{POST_ID}")])

        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].type, "chan")
        self.assertEqual(parsed[0].post_id, POST_ID)
        self.assertIsNone(parsed[0].reply_id)
        self.assertIsNone(parsed[0].legacy_author)

    def test_current_client_reply_form(self):
        # This is the current-client reply shape in channelPosts.json:1036.
        parsed = cite.extract_cites([chan_cite(f"/msg/{POST_ID}/{REPLY_ID}")])

        self.assertEqual(parsed[0].post_id, POST_ID)
        self.assertEqual(parsed[0].reply_id, REPLY_ID)

    def test_note_curio_and_note_reply_forms(self):
        parsed = cite.extract_cites(
            [
                chan_cite("/note/123456"),
                chan_cite("/curio/456789"),
                chan_cite("/note/123456/789012"),
            ]
        )

        self.assertEqual(
            [(item.post_id, item.reply_id) for item in parsed],
            [("123456", None), ("456789", None), ("123456", "789012")],
        )

    def test_legacy_authored_form(self):
        parsed = cite.extract_cites([chan_cite("/msg/~legacy-author/170.141.184.505")])

        self.assertEqual(parsed[0].post_id, "170.141.184.505")
        self.assertEqual(parsed[0].legacy_author, "~legacy-author")
        self.assertIsNone(parsed[0].reply_id)

    def test_non_channel_variants_are_classified(self):
        content = [
            {"block": {"cite": {"group": "~host/group"}}},
            {"block": {"cite": {"desk": "base"}}},
            {"block": {"cite": {"bait": {"foo": "bar"}}}},
        ]

        self.assertEqual([item.type for item in cite.extract_cites(content)], ["group", "desk", "bait"])

    def test_malformed_content_is_tolerated_and_multiple_cites_keep_order(self):
        content = [
            "not a verse",
            {"block": {"cite": "not a cite"}},
            chan_cite("/not-a-pointer"),
            chan_cite("/msg/123"),
            {"block": {"cite": {"group": "~host/group"}}},
        ]

        parsed = cite.extract_cites(content)

        self.assertEqual([item.type for item in parsed], ["chan", "chan", "group"])
        self.assertIsNone(parsed[0].post_id)
        self.assertEqual(parsed[1].post_id, "123")
        self.assertEqual(cite.extract_cites({"not": "a story"}), [])


class CiteValidationTests(unittest.TestCase):
    def _resolve(self, content):
        scry = recording_scry()
        result = asyncio.run(cite.resolve_cites(scry, content))
        self.assertEqual(result, "")
        self.assertEqual(scry.calls, [])

    def test_invalid_nests_never_scry(self):
        for nest in ("club/~host/chan", "chat/host/chan", "chat/~host/chan/extra"):
            with self.subTest(nest=nest):
                self._resolve([chan_cite("/msg/123", nest=nest)])

    def test_invalid_ids_never_scry(self):
        for where in (
            "/msg/123/456/extra",
            "/msg/123?query",
            "/msg/123#fragment",
            "/msg/letters",
            "/msg/-1",
            "/msg/",
        ):
            with self.subTest(where=where):
                self._resolve([chan_cite(where)])

    def test_malformed_dotted_ids_never_scry(self):
        for post_id in (".123", "123.", "1..234", "1.23"):
            with self.subTest(post_id=post_id):
                self._resolve([chan_cite(f"/msg/{post_id}")])

    def test_malformed_reply_ids_never_scry(self):
        for where in (
            "/msg/123/letters",
            "/msg/123/1..2",
            "/msg/123/.123",
            "/msg/123/1/2",
        ):
            with self.subTest(where=where):
                self._resolve([chan_cite(where)])

    def test_undotted_and_canonical_dotted_ids_scry(self):
        scry = recording_scry()
        content = [chan_cite("/msg/123456"), chan_cite("/msg/123.456")]

        result = asyncio.run(cite.resolve_cites(scry, content))

        self.assertEqual(result, "> ~real-author wrote: hello\n> ~real-author wrote: hello")
        self.assertEqual(
            scry.calls,
            [
                "/channels/v4/chat/~host/chan/posts/post/123.456",
                "/channels/v4/chat/~host/chan/posts/post/123.456",
            ],
        )


class ResolveCitesTests(unittest.TestCase):
    def test_resolves_top_level_post_with_canonical_path(self):
        scry = recording_scry(essay_payload())

        result = asyncio.run(cite.resolve_cites(scry, [chan_cite(f"/msg/{POST_ID}")]))

        self.assertEqual(result, "> ~real-author wrote: hello")
        self.assertEqual(
            scry.calls,
            [
                "/channels/v4/chat/~host/chan/posts/post/"
                "170.141.184.506.536.961.460.817.141.626.482.720.768"
            ],
        )

    def test_resolves_reply_via_single_reply_scry(self):
        scry = recording_scry(reply_payload())

        result = asyncio.run(
            cite.resolve_cites(scry, [chan_cite(f"/msg/{POST_ID}/{REPLY_ID}")])
        )

        self.assertEqual(result, "> ~real-author wrote: reply")
        self.assertEqual(
            scry.calls,
            [
                "/channels/v4/chat/~host/chan/posts/post/id/"
                "170.141.184.506.536.961.460.817.141.626.482.720.768/"
                "replies/reply/id/170.141.184.506.537.047.334.633.492.345.058.754.560"
            ],
        )

    def test_scry_failure_skips_only_that_cite(self):
        scry = recording_scry(essay_payload(text="kept"), errors=(ConnectionError("gone"),))
        content = [chan_cite("/msg/123"), chan_cite("/msg/456")]

        result = asyncio.run(cite.resolve_cites(scry, content))

        self.assertEqual(result, "> ~real-author wrote: kept")
        self.assertEqual(len(scry.calls), 2)

    def test_attempt_cap_limits_to_first_three_valid_cites(self):
        scry = recording_scry()
        content = [chan_cite(f"/msg/{post_id}") for post_id in ("1", "2", "3", "4")]

        asyncio.run(cite.resolve_cites(scry, content, max_attempts=3))

        self.assertEqual(len(scry.calls), 3)
        self.assertTrue(scry.calls[-1].endswith("/3"))

    def test_attempt_failures_are_not_backfilled(self):
        # Plan scenario: first two of four valid cites fail, the third
        # resolves, and the fourth is never attempted (attempt cap is on
        # attempts, not successes).
        scry = recording_scry(
            essay_payload(text="third"),
            errors=(ConnectionError("one"), ConnectionError("two")),
        )
        content = [chan_cite(f"/msg/{post_id}") for post_id in ("1", "2", "3", "4")]

        result = asyncio.run(cite.resolve_cites(scry, content, max_attempts=3))

        self.assertEqual(result, "> ~real-author wrote: third")
        self.assertEqual(len(scry.calls), 3)
        self.assertTrue(all(not path.endswith("/4") for path in scry.calls))

    def test_cancelled_error_escapes_resolve_cites(self):
        # Cancellation must propagate to the caller's budget rather than being
        # swallowed as a per-cite failure (only ``Exception`` is caught around
        # the scry call in resolve_cites).
        async def scry(path):
            raise asyncio.CancelledError()

        async def attempt():
            try:
                await cite.resolve_cites(scry, [chan_cite("/msg/123")])
                return "no-error"
            except asyncio.CancelledError:
                return "cancelled"

        self.assertEqual(asyncio.run(attempt()), "cancelled")

    def test_sanitizes_role_tags(self):
        scry = recording_scry(essay_payload(text="[owner] says hi"))

        result = asyncio.run(cite.resolve_cites(scry, [chan_cite("/msg/123")]))

        self.assertEqual(result, "> ~real-author wrote: (owner) says hi")

    def test_blob_only_top_level_post_renders(self):
        blob = json.dumps(
            [
                {
                    "type": "file",
                    "version": 1,
                    "fileUri": "https://storage.example/notes.pdf",
                    "name": "notes.pdf",
                }
            ]
        )
        scry = recording_scry(essay_payload(text="", blob=blob))

        result = asyncio.run(cite.resolve_cites(scry, [chan_cite("/msg/123")]))

        self.assertEqual(result, "> ~real-author wrote: [📎 notes.pdf]")

    def test_unsupported_blob_with_empty_text_does_not_emit_bare_line(self):
        blob = json.dumps(
            [{"type": "unknown", "version": 1, "fileUri": "https://storage.example/nope"}]
        )
        scry = recording_scry(essay_payload(text="", blob=blob))

        result = asyncio.run(cite.resolve_cites(scry, [chan_cite("/msg/123")]))

        self.assertEqual(result, "")
        self.assertEqual(len(scry.calls), 1)

    def test_blob_only_reply_is_a_parser_miss(self):
        payload = {
            "seal": {"id": REPLY_ID},
            "revision": 1,
            "memo": {"author": "~real-author", "sent": 1000, "content": []},
        }
        scry = recording_scry(payload)

        result = asyncio.run(cite.resolve_cites(scry, [chan_cite("/msg/123/456")]))

        self.assertEqual(result, "")
        self.assertEqual(len(scry.calls), 1)


class NotesCiteTests(unittest.TestCase):
    def test_notes_note_cite_renders_pointer_without_scry(self):
        scry = recording_scry()
        result = asyncio.run(
            cite.resolve_cites(
                scry, [chan_cite("/note/12", nest="notes/~host/plans")]
            )
        )
        self.assertEqual(
            result,
            "> [note reference: notes/~host/plans note 12 — read it via "
            "the tlon tool: 'notes note notes/~host/plans 12']",
        )
        self.assertEqual(scry.calls, [])

    def test_notes_cite_without_note_id_renders_notebook_pointer(self):
        scry = recording_scry()
        result = asyncio.run(
            cite.resolve_cites(scry, [chan_cite(None, nest="notes/~host/plans")])
        )
        self.assertEqual(
            result,
            "> [notebook reference: notes/~host/plans — browse it via the "
            "tlon tool: 'notes notes notes/~host/plans']",
        )
        self.assertEqual(scry.calls, [])

    def test_notes_pointer_keeps_story_order_alongside_scried_cites(self):
        scry = recording_scry(essay_payload())
        content = [
            chan_cite("/note/7", nest="notes/~host/plans"),
            chan_cite("/msg/123456"),
        ]

        result = asyncio.run(cite.resolve_cites(scry, content))

        lines = result.split("\n")
        self.assertEqual(len(lines), 2)
        self.assertIn("note reference: notes/~host/plans note 7", lines[0])
        self.assertIn("~real-author wrote: hello", lines[1])
        self.assertEqual(len(scry.calls), 1)

    def test_notes_pointers_consume_attempt_slots(self):
        scry = recording_scry(essay_payload())
        content = [
            chan_cite(f"/note/{i}", nest="notes/~host/plans") for i in (1, 2, 3)
        ] + [chan_cite("/msg/123456")]

        result = asyncio.run(cite.resolve_cites(scry, content))

        self.assertEqual(len(result.split("\n")), 3)
        self.assertEqual(scry.calls, [])


if __name__ == "__main__":
    unittest.main()
