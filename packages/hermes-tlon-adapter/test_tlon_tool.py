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
PACKAGE_NAME = "hermes_tlon_adapter_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


# Minimal stand-ins for the gateway package so ``adapter`` imports at module
# load. Only the names ``adapter`` binds are needed; ``block_tlon_session_tool``
# never instantiates the adapter, so trivial classes suffice.
class _StubBasePlatformAdapter:
    def __init__(self, *args, **kwargs):
        pass


gateway = types.ModuleType("gateway")
gateway_config = types.ModuleType("gateway.config")
gateway_config.Platform = type("Platform", (), {})
gateway_config.PlatformConfig = type("PlatformConfig", (), {})
gateway_platforms = types.ModuleType("gateway.platforms")
gateway_base = types.ModuleType("gateway.platforms.base")
gateway_base.BasePlatformAdapter = _StubBasePlatformAdapter
gateway_base.MessageEvent = type("MessageEvent", (), {})
gateway_base.MessageType = type("MessageType", (), {"TEXT": "text"})
gateway_base.SendResult = type("SendResult", (), {})
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
tlon_tool = load_module("tlon_tool")
approval = sys.modules[f"{PACKAGE_NAME}.approval"]
adapter_mod = load_module("adapter")


class TlonToolGuardTests(unittest.TestCase):
    def test_credential_flags_are_skipped_before_subcommand(self):
        args, error = tlon_tool.split_tlon_command(
            "--url http://127.0.0.1:8080 --ship ~zod contacts self"
        )

        self.assertIsNone(error)
        self.assertEqual(tlon_tool.find_subcommand_index(args), 4)
        self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_first_positional_skips_flag_with_separate_value(self):
        args = (
            "notes",
            "migrate-apply",
            "--output",
            "plan",
            "diary/~zod/log",
        )

        self.assertEqual(
            tlon_tool.find_first_positional_argument_index(
                args, 2, frozenset({"--output"})
            ),
            4,
        )

    def test_first_positional_skips_flag_with_equals_value(self):
        args = (
            "notes",
            "migrate-apply",
            "--output=plan",
            "diary/~zod/log",
        )

        self.assertEqual(
            tlon_tool.find_first_positional_argument_index(
                args, 2, frozenset({"--output"})
            ),
            3,
        )

    def test_first_positional_skips_boolean_flag(self):
        args = ("notes", "migrate-apply", "--yes", "diary/~zod/log")

        self.assertEqual(
            tlon_tool.find_first_positional_argument_index(
                args,
                2,
                frozenset(),
                tlon_tool.MIGRATION_BOOLEAN_FLAGS,
            ),
            3,
        )

    def test_first_positional_returns_unknown_flag(self):
        args = ("notes", "migrate-apply", "--unknown", "diary/~zod/log")

        self.assertEqual(
            tlon_tool.find_first_positional_argument_index(
                args,
                2,
                frozenset(),
                tlon_tool.MIGRATION_BOOLEAN_FLAGS,
            ),
            2,
        )

    def test_first_positional_returns_minus_one_when_absent(self):
        args = ("notes", "migrate-apply", "--yes", "--force")

        self.assertEqual(
            tlon_tool.find_first_positional_argument_index(
                args,
                2,
                frozenset(),
                tlon_tool.MIGRATION_BOOLEAN_FLAGS,
            ),
            -1,
        )

    def test_migration_source_operand_skips_boolean_flags(self):
        cases = (
            (
                "before",
                ("notes", "migrate-apply", "--yes", "diary/~zod/log"),
            ),
            (
                "after",
                ("notes", "migrate-apply", "diary/~zod/log", "--force"),
            ),
            (
                "interleaved",
                (
                    "notes",
                    "migrate-apply",
                    "--allow-write-widening",
                    "--force",
                    "diary/~zod/log",
                    "--yes",
                ),
            ),
        )

        for name, args in cases:
            with self.subTest(name=name):
                self.assertEqual(
                    tlon_tool._migration_source_operand(args),
                    "diary/~zod/log",
                )

    def test_canonical_notes_nest_accepts_valid_nest(self):
        self.assertEqual(
            tlon_tool._canonical_notes_nest("Notes/ZOD/Field-Notes"),
            "notes/~zod/Field-Notes",
        )

    def test_canonical_notes_nest_rejects_wrong_prefix(self):
        self.assertIsNone(
            tlon_tool._canonical_notes_nest("diary/~zod/field-notes")
        )

    def test_canonical_notes_nest_rejects_wrong_arity(self):
        for nest in ("notes/~zod", "notes/~zod/field-notes/extra"):
            with self.subTest(nest=nest):
                self.assertIsNone(tlon_tool._canonical_notes_nest(nest))

    def test_canonical_notes_nest_rejects_empty_segments(self):
        for nest in ("/~zod/field-notes", "notes//field-notes", "notes/~zod/"):
            with self.subTest(nest=nest):
                self.assertIsNone(tlon_tool._canonical_notes_nest(nest))

    def test_canonical_notes_nest_rejects_whitespace_in_name(self):
        self.assertIsNone(
            tlon_tool._canonical_notes_nest("notes/~zod/field notes")
        )

    def test_blocks_sending_to_current_conversation(self):
        # Targets that equal the session's current chat must go through the
        # streaming reply path, not the tool.
        cases = [
            ('posts send ~nec "hello"', "~nec"),
            ('posts reply ~nec 170.141 "hello"', "~nec"),
            ('dms send 0v5.abcde "hello"', "0v5.abcde"),
            ('dms reply 0v5.abcde 170.141 "hello"', "0v5.abcde"),
            ('posts send chat/~zod/general "hi"', "chat/~zod/general"),
            ('posts reply chat/~zod/general 170.141 "hi"', "chat/~zod/general"),
            ('posts send Chat/~ZOD/general "hi"', "chat/~zod/general"),  # case-insensitive
        ]
        for command, chat_id in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                blocked = tlon_tool.check_tlon_tool_command(
                    args, session_chat_id=chat_id
                )
                self.assertIsNotNone(blocked)
                self.assertIn("current conversation", blocked)

    def test_allows_proactive_sends_to_other_conversations(self):
        # Posting somewhere other than the current chat is a proactive send —
        # the only path for it, so it must be allowed.
        cases = [
            ('posts send chat/~bot/general "hi"', "~owner"),  # in a DM, post to a channel
            ('posts send ~friend "hi"', "chat/~zod/general"),  # in a channel, DM someone
            ('dms send 0v5.abcde "hi"', "chat/~zod/general"),  # in a channel, group-DM someone
            ('posts reply chat/~bot/general 170.141 "hi"', "~owner"),
            ('posts send heap/~zod/gallery "new gallery item"', "chat/~zod/general"),
        ]
        for command, chat_id in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertIsNone(
                    tlon_tool.check_tlon_tool_command(args, session_chat_id=chat_id)
                )

    def test_allows_sends_when_no_current_conversation(self):
        # cron/standalone contexts have no current conversation to protect.
        args, _ = tlon_tool.split_tlon_command('posts send chat/~zod/general "hi"')
        self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_allows_image_sends_to_current_conversation(self):
        # The streaming reply path is text-only, so --image sends are the only
        # way to deliver an image — allowed even to the current chat.
        cases = [
            ('posts send chat/~zod/general --image https://x/y.png', "chat/~zod/general"),
            ('posts send chat/~zod/general --image=https://x/y.png', "chat/~zod/general"),
            (
                'posts send chat/~zod/general "a tree" --image https://x/y.png',
                "chat/~zod/general",
            ),
            ('dms send 0v5.abcde --image https://x/y.png', "0v5.abcde"),
            ('dms send 0v5.abcde --image=https://x/y.png', "0v5.abcde"),
        ]
        for command, chat_id in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertIsNone(
                    tlon_tool.check_tlon_tool_command(args, session_chat_id=chat_id)
                )

    def test_text_sends_to_current_conversation_stay_blocked(self):
        args, _ = tlon_tool.split_tlon_command('posts send chat/~zod/general "hi"')
        blocked = tlon_tool.check_tlon_tool_command(
            args, session_chat_id="chat/~zod/general"
        )
        self.assertIsNotNone(blocked)
        self.assertIn("--image", blocked)  # block message teaches the escape

    def test_current_gallery_send_is_allowed_but_gallery_reply_stays_blocked(self):
        send_args, send_error = tlon_tool.split_tlon_command(
            'posts send heap/~zod/gallery "new gallery item"'
        )
        reply_args, reply_error = tlon_tool.split_tlon_command(
            'posts reply heap/~zod/gallery 170.141 "gallery comment"'
        )

        self.assertIsNone(send_error)
        self.assertIsNone(reply_error)
        self.assertIsNone(
            tlon_tool.check_tlon_tool_command(
                send_args, session_chat_id="heap/~zod/gallery"
            )
        )
        blocked = tlon_tool.check_tlon_tool_command(
            reply_args, session_chat_id="heap/~zod/gallery"
        )
        self.assertIsNotNone(blocked)
        self.assertIn("current conversation", blocked)

    def test_heap_comment_reactions_and_gallery_delete_are_allowed(self):
        react_args, react_error = tlon_tool.split_tlon_command(
            'posts react heap/~zod/gallery 170.142 "🔥" --parent 170.141'
        )
        delete_args, delete_error = tlon_tool.split_tlon_command(
            "posts delete heap/~zod/gallery 170.141"
        )

        self.assertIsNone(react_error)
        self.assertIsNone(delete_error)
        self.assertIsNone(
            tlon_tool.check_tlon_tool_command(react_args, reaction_level="minimal")
        )
        self.assertIsNone(tlon_tool.check_tlon_tool_command(delete_args))
        blocked = tlon_tool.check_tlon_tool_command(react_args, reaction_level="off")
        self.assertIsNotNone(blocked)
        self.assertIn("reactions are disabled", blocked)

    def test_tool_description_includes_gallery_guidance(self):
        description = tlon_tool.TLON_TOOL_DESCRIPTION
        command_description = tlon_tool.TLON_TOOL_SCHEMA["parameters"]["properties"][
            "command"
        ]["description"]

        self.assertIn("heap/~host/name", description)
        self.assertIn("--parent <post-id>", description)
        self.assertIn("posts delete heap/~host/name", description)
        self.assertIn("heap/~host/name", command_description)
        self.assertIn("--parent <post-id>", command_description)

        class RecordingContext:
            def __init__(self):
                self.platform = None

            def register_hook(self, *_args):
                pass

            def register_tool(self, **_kwargs):
                pass

            def register_skill(self, *_args, **_kwargs):
                pass

            def register_platform(self, **kwargs):
                self.platform = kwargs

        context = RecordingContext()
        adapter_mod.register(context)
        platform_hint = context.platform["platform_hint"]

        self.assertIn("Sending plain text to the current conversation", platform_hint)
        self.assertIn("except that posts send heap/~host/name", platform_hint)
        self.assertIn("Reply normally in a gallery to comment on the triggering post", platform_hint)
        self.assertIn("allowed even in the current gallery", platform_hint)
        self.assertIn("--parent <post-id>", platform_hint)
        self.assertIn("posts delete heap/~host/name <post-id>", platform_hint)

    def test_media_guidance_carries_the_delivery_claim_and_fallback_rules(self):
        # TLON_TOOL_DESCRIPTION is the authoritative rule set; the platform
        # hint only has to carry the two rules a wrong answer is costly on —
        # never claiming an undelivered image, and the storage-less fallback.
        description = tlon_tool.TLON_TOOL_DESCRIPTION
        self.assertIn("public https", description)
        self.assertIn(
            "never claim an image was delivered unless the upload", description
        )
        self.assertIn("cannot store uploads", description)
        self.assertIn("posts without uploading", description)

        class RecordingContext:
            def __init__(self):
                self.platform = None

            def register_hook(self, *_args):
                pass

            def register_tool(self, **_kwargs):
                pass

            def register_skill(self, *_args, **_kwargs):
                pass

            def register_platform(self, **kwargs):
                self.platform = kwargs

        context = RecordingContext()
        adapter_mod.register(context)
        platform_hint = context.platform["platform_hint"]
        self.assertIn("never claim an image was posted unless", platform_hint)
        self.assertIn("cannot store uploads", platform_hint)

    def test_platform_hint_advertises_product_guide_only_when_registered(self):
        # The guide ships in the OpenClaw plugin tree, which a Hermes install
        # may not have. Pointing the model at a skill_view that can't resolve
        # would turn every product question into a failed tool call, so the
        # hint fragment has to track the registration.
        class RecordingContext:
            def __init__(self):
                self.platform = None
                self.skills: list[str] = []

            def register_hook(self, *_args):
                pass

            def register_tool(self, **_kwargs):
                pass

            def register_skill(self, name, *_args, **_kwargs):
                self.skills.append(name)

            def register_platform(self, **kwargs):
                self.platform = kwargs

        marker = 'skill_view("tlon-platform:tlon-product-guide")'

        found = RecordingContext()
        with patch.object(
            adapter_mod,
            "resolve_tlon_product_guide_path",
            return_value=Path("/plugin/skills/tlon-product-guide/SKILL.md"),
        ):
            adapter_mod.register(found)
        self.assertIn("tlon-product-guide", found.skills)
        self.assertIn(marker, found.platform["platform_hint"])

        missing = RecordingContext()
        with patch.object(
            adapter_mod, "resolve_tlon_product_guide_path", return_value=None
        ):
            adapter_mod.register(missing)
        self.assertNotIn("tlon-product-guide", missing.skills)
        self.assertNotIn(marker, missing.platform["platform_hint"])
        # The rest of the hint is unaffected by the guide's absence.
        self.assertIn(
            'skill_view("tlon-platform:tlon")', missing.platform["platform_hint"]
        )

    def test_tool_description_includes_latex_guidance(self):
        description = tlon_tool.TLON_TOOL_DESCRIPTION

        self.assertIn("Never use LaTeX math delimiters", description)
        self.assertIn("$$...$$", description)
        self.assertIn("\\(...\\)", description)
        self.assertIn("\\[...\\]", description)
        self.assertIn("plain text/Unicode", description)
        self.assertIn("code blocks", description)

        class RecordingContext:
            def __init__(self):
                self.platform = None

            def register_hook(self, *_args):
                pass

            def register_tool(self, **_kwargs):
                pass

            def register_skill(self, *_args, **_kwargs):
                pass

            def register_platform(self, **kwargs):
                self.platform = kwargs

        context = RecordingContext()
        adapter_mod.register(context)
        platform_hint = context.platform["platform_hint"]

        self.assertIn("Never use LaTeX math delimiters", platform_hint)
        self.assertIn("$$...$$", platform_hint)
        self.assertIn("\\(...\\)", platform_hint)
        self.assertIn("\\[...\\]", platform_hint)
        self.assertIn("plain text/Unicode", platform_hint)
        self.assertIn("code blocks", platform_hint)

    def test_blocks_notebook(self):
        args, error = tlon_tool.split_tlon_command('notebook diary/~zod/notes "Title"')
        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(args)
        self.assertIsNotNone(blocked)
        self.assertIn("notebook", blocked.lower())
        # The redirect must point at %notes and the owner migration path.
        self.assertIn("notes", blocked.lower())
        self.assertIn("/migrate diary/~zod/notes", blocked)
        self.assertNotIn("<diary-nest>", blocked)

    def test_bare_notebook_refusal_keeps_placeholder(self):
        blocked = tlon_tool.check_tlon_tool_command(["notebook"])

        self.assertIn("/migrate <diary-nest>", blocked)

    def test_blocks_migration_mutations_after_credential_flags(self):
        cases = (
            ("notes migrate diary/~zod/log", "/migrate diary/~zod/log"),
            (
                "notes migrate-apply diary/~zod/log --yes",
                "/migrate diary/~zod/log",
            ),
            ("notes migrate-other diary/~zod/log", "/migrate diary/~zod/log"),
            (
                "notes migrate-plan-extra diary/~zod/log",
                "/migrate diary/~zod/log",
            ),
            (
                "notes notebook-delete notes/~zod/log --yes",
                "/migrate cleanup notes/~zod/log",
            ),
            (
                "notes notebook-delete --yes notes/~zod/log",
                "/migrate cleanup notes/~zod/log",
            ),
            (
                "--config /tmp/owner.json notes migrate-apply "
                "diary/~zod/log --yes",
                "/migrate diary/~zod/log",
            ),
            (
                "--url=https://example.test --ship ~zod --code secret "
                "notes notebook-delete notes/~zod/log --yes",
                "/migrate cleanup notes/~zod/log",
            ),
        )

        for command, owner_command in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertEqual(
                    tlon_tool.check_tlon_tool_command(args),
                    "Blocked: this notes operation requires owner "
                    "confirmation. Ask the owner to type "
                    f"`{owner_command}`.",
                )

    def test_channels_delete_migration_guard_target_kinds(self):
        cases = (
            (
                "channels delete notes/~zod/log",
                "Blocked: this notes operation requires owner confirmation. "
                "Ask the owner to type `/migrate cleanup notes/~zod/log`.",
            ),
            (
                "--config /tmp/owner.json channels delete notes/~zod/log",
                "Blocked: this notes operation requires owner confirmation. "
                "Ask the owner to type `/migrate cleanup notes/~zod/log`.",
            ),
            ("channels delete chat/~zod/log", None),
            ("channels delete heap/~zod/log", None),
            (
                "channels delete diary/~zod/log",
                "Blocked: %diary channels are deprecated and unsupported by "
                "this CLI tool. Ask the owner to type "
                "`/migrate diary/~zod/log`.",
            ),
        )

        for command, expected in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertEqual(
                    tlon_tool.check_tlon_tool_command(args), expected
                )

    def test_migration_flag_before_nest_preserves_refused_diary_nest(self):
        args = (
            "notes",
            "migrate-apply",
            "--yes",
            "diary/~zod/log",
        )

        self.assertEqual(
            tlon_tool.check_blocked_migration_operation(args),
            "Blocked: this notes operation requires owner confirmation. "
            "Ask the owner to type `/migrate diary/~zod/log`.",
        )
        self.assertEqual(
            tlon_tool.refused_diary_nest(args), "diary/~zod/log"
        )

    def test_bare_notebook_delete_uses_cleanup_placeholder(self):
        self.assertEqual(
            tlon_tool.check_blocked_migration_operation(
                ("notes", "notebook-delete")
            ),
            "Blocked: this notes operation requires owner confirmation. "
            "Ask the owner to type `/migrate cleanup <notes-nest>`.",
        )

    def test_whitespace_notes_nest_uses_strict_hermes_canonicalization(self):
        cases = (
            ('channels delete "notes/~zod/field notes"', None),
            (
                'notes notebook-delete "notes/~zod/field notes"',
                "Blocked: this notes operation requires owner confirmation. "
                "Ask the owner to type `/migrate cleanup <notes-nest>`.",
            ),
        )

        for command, expected in cases:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertEqual(
                    tlon_tool.check_tlon_tool_command(args), expected
                )

    def test_interpolates_diary_targets_refused_by_cli_surface(self):
        for command in (
            "channels info diary/~sampel-palnet/field-notes",
            "messages channel diary/~sampel-palnet/field-notes",
            'posts send diary/~sampel-palnet/field-notes "hello"',
            "expose check /1/chan/diary/~sampel-palnet/field-notes/note/170.141",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                blocked = tlon_tool.check_tlon_tool_command(args)
                self.assertIn(
                    "/migrate diary/~sampel-palnet/field-notes",
                    blocked,
                )
                self.assertNotIn("<diary-nest>", blocked)

    def test_diary_guard_matches_cli_validation_order(self):
        cases = (
            (
                "valid posts action",
                ("posts", "send", "diary/~zod/log", "hello"),
                True,
            ),
            (
                "known posts action with incidental missing argument",
                ("posts", "react", "diary/~zod/log", "170.141"),
                True,
            ),
            (
                "unknown posts action",
                ("posts", "bogus", "diary/~zod/log"),
                False,
            ),
            (
                "mis-cased posts action",
                ("posts", "Send", "diary/~zod/log", "hello"),
                False,
            ),
            (
                "valid expose action",
                ("expose", "check", "diary/~zod/log/170.141"),
                True,
            ),
            (
                "unknown expose action",
                ("expose", "bogus", "diary/~zod/log/170.141"),
                False,
            ),
            (
                "mis-cased expose action",
                ("expose", "Check", "diary/~zod/log/170.141"),
                False,
            ),
            (
                "valid messages search",
                (
                    "messages",
                    "search",
                    "query",
                    "--channel",
                    "diary/~zod/log",
                ),
                True,
            ),
            (
                "channel flag in the query position",
                (
                    "messages",
                    "search",
                    "--channel",
                    "diary/~zod/log",
                ),
                False,
            ),
            (
                "messages context missing its post id",
                ("messages", "context", "diary/~zod/log"),
                False,
            ),
            (
                "mis-cased messages action",
                (
                    "messages",
                    "Search",
                    "query",
                    "--channel",
                    "diary/~zod/log",
                ),
                False,
            ),
            (
                "channels rename missing title",
                ("channels", "rename", "diary/~zod/log"),
                False,
            ),
            (
                "channels rename with title",
                ("channels", "rename", "diary/~zod/log", "New"),
                True,
            ),
            (
                "channels add-writers missing role",
                ("channels", "add-writers", "diary/~zod/log"),
                False,
            ),
            (
                "channels add-writers with role",
                ("channels", "add-writers", "diary/~zod/log", "admin"),
                True,
            ),
            (
                "channels del-writers missing role",
                ("channels", "del-writers", "diary/~zod/log"),
                False,
            ),
            (
                "channels del-writers with role",
                ("channels", "del-writers", "diary/~zod/log", "admin"),
                True,
            ),
            (
                "channels add-readers missing group flag",
                (
                    "channels",
                    "add-readers",
                    "",
                    "diary/~zod/log",
                    "member",
                ),
                False,
            ),
            (
                "channels add-readers missing role",
                (
                    "channels",
                    "add-readers",
                    "~zod/group",
                    "diary/~zod/log",
                ),
                False,
            ),
            (
                "channels add-readers with role",
                (
                    "channels",
                    "add-readers",
                    "~zod/group",
                    "diary/~zod/log",
                    "member",
                ),
                True,
            ),
            (
                "channels del-readers missing group flag",
                (
                    "channels",
                    "del-readers",
                    "",
                    "diary/~zod/log",
                    "member",
                ),
                False,
            ),
            (
                "channels del-readers missing role",
                (
                    "channels",
                    "del-readers",
                    "~zod/group",
                    "diary/~zod/log",
                ),
                False,
            ),
            (
                "channels del-readers with role",
                (
                    "channels",
                    "del-readers",
                    "~zod/group",
                    "diary/~zod/log",
                    "member",
                ),
                True,
            ),
        )

        for name, args, cli_refuses_diary in cases:
            with self.subTest(name=name):
                self.assertEqual(
                    tlon_tool.check_blocked_diary_operation(args) is not None,
                    cli_refuses_diary,
                )
                self.assertEqual(
                    tlon_tool.refused_diary_nest(args) is not None,
                    cli_refuses_diary,
                )

    def test_allows_only_exact_migrate_plan(self):
        for command in (
            "notes migrate-plan diary/~zod/log",
            "--config /tmp/owner.json notes migrate-plan diary/~zod/log",
        ):
            args, error = tlon_tool.split_tlon_command(command)
            self.assertIsNone(error)
            self.assertIsNone(tlon_tool.check_tlon_tool_command(args))
        self.assertIn(
            "/migrate <diary-nest>",
            tlon_tool.check_blocked_migration_operation(
                ("notes", "migrate-plan-extra")
            ),
        )

    def test_allows_packaged_cli_help_before_diary_interception(self):
        for command in (
            "messages channel diary/~zod/log --help",
            "expose check diary/~zod/log/170.141 --help",
            "posts react diary/~zod/log 170.141 --help",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_preserves_cli_help_literal_exceptions(self):
        for command in (
            "messages search --help --channel diary/~zod/log",
            "posts send diary/~zod/log --help",
            "posts reply diary/~zod/log 170.141 --help",
            "posts edit diary/~zod/log 170.141 --help",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                blocked = tlon_tool.check_tlon_tool_command(args)
                self.assertIn("/migrate diary/~zod/log", blocked)

    def test_allows_notes_read_and_write_commands(self):
        # Ordinary %notes reads and writes pass the tool guard (owner gating
        # happens at the session level); migration mutations are separate.
        for command in (
            "notes list",
            "notes note notes/~zod/docs 12",
            'notes note-create notes/~zod/docs root "Title" --markdown post.md',
            "notes note-update notes/~zod/docs 12 --body new.md",
            "notes note-delete notes/~zod/docs 12",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_notes_writes_not_caught_by_current_conversation_block(self):
        # notes never targets a chat conversation, so the send block (which
        # protects the current chat) must not fire even when a chat is active.
        args, error = tlon_tool.split_tlon_command(
            'notes note-create notes/~zod/docs root "Title" --markdown post.md'
        )
        self.assertIsNone(error)
        self.assertIsNone(
            tlon_tool.check_tlon_tool_command(args, session_chat_id="chat/~zod/general")
        )

    def test_blocks_notes_stdin_content_source(self):
        # Hermes only passes argv to the tlon subprocess; it cannot stream a
        # Markdown body on stdin. File-backed notes writes remain allowed.
        for command in (
            'notes note-create notes/~zod/docs root "Title" --stdin',
            "notes note-update notes/~zod/docs 12 --stdin",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                blocked = tlon_tool.check_tlon_tool_command(args)
                self.assertIsNotNone(blocked)
                self.assertIn("--stdin", blocked)
                self.assertIn("--body", blocked)

    def test_allows_read_and_admin_commands(self):
        for command in (
            "contacts self",
            'contacts update-profile --nickname "Mr Arvo"',
            "messages dm ~nec --limit 5",
            'groups create "Private Bot Scratchpad"',
            "posts react chat/~zod/general 170.141 :thumbsup:",
        ):
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_blocks_plain_group_create_in_tlon_session(self):
        args, error = tlon_tool.split_tlon_command(
            'groups create "Animals" --description "A fun group"'
        )

        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(
            args,
            session_platform="tlon",
            session_user_id="~mug",
        )
        self.assertIsNotNone(blocked)
        self.assertIn("groups create-owned Animals --owner ~mug", blocked)
        self.assertIn("--description 'A fun group'", blocked)

    def test_blocks_profile_update_in_tlon_session_without_owner(self):
        args, error = tlon_tool.split_tlon_command(
            'contacts update-profile --avatar "https://example.com/a.png"'
        )

        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(
            args,
            session_platform="tlon",
            session_user_id="~mug",
        )
        self.assertIsNotNone(blocked)
        self.assertIn("TLON_OWNER_SHIP", blocked)

    def test_blocks_profile_update_for_non_owner(self):
        args, error = tlon_tool.split_tlon_command(
            'contacts update-profile --avatar "https://example.com/a.png"'
        )

        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(
            args,
            session_platform="tlon",
            session_user_id="~nec",
            owner_ship="~mug",
        )
        self.assertIsNotNone(blocked)
        self.assertIn("only the configured Tlon owner", blocked)

    def test_allows_profile_update_for_owner(self):
        args, error = tlon_tool.split_tlon_command(
            'contacts update-profile --avatar "https://example.com/a.png"'
        )

        self.assertIsNone(error)
        self.assertIsNone(
            tlon_tool.check_tlon_tool_command(
                args,
                session_platform="tlon",
                session_user_id="~mug",
                owner_ship="~mug",
            )
        )

    def test_rejects_unknown_command(self):
        args, error = tlon_tool.split_tlon_command("frobnicate now")

        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(args)
        self.assertIsNotNone(blocked)
        self.assertIn("Unknown tlon subcommand", blocked)
        # The block advertises the allowlist, which now includes notes.
        self.assertIn("Allowed:", blocked)
        self.assertIn("notes", blocked)

    def test_normalizes_global_help_and_version_aliases(self):
        self.assertEqual(tlon_tool.normalize_global_command_args(["help"]), ["--help"])
        self.assertEqual(tlon_tool.normalize_global_command_args(["version"]), ["--version"])
        self.assertIsNone(tlon_tool.check_tlon_tool_command(["--help"]))
        self.assertIsNone(tlon_tool.check_tlon_tool_command(["--version"]))


class TlonToolExecutionTests(unittest.TestCase):
    @staticmethod
    def _card_components(blob):
        entry = json.loads(blob)[0]
        components = entry["messages"][1]["updateComponents"]["components"]
        return {component["id"]: component for component in components}

    @classmethod
    def _card_action(cls, blob):
        components = cls._card_components(blob)
        button = next(
            component
            for component in components.values()
            if component["component"] == "Button"
        )
        return button["action"]["event"]["context"]["text"]

    def test_diary_refusal_notifies_owner_once_with_card_and_literal_text(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return True

        async def title_lookup(_nest):
            return "Discovery diary"

        tlon_tool.set_diary_migration_notification_sender(
            send_dm,
            bot_ship="~sampel-palnet",
            owner_ship="~mug",
            title_lookup=title_lookup,
        )
        self.addCleanup(
            tlon_tool.clear_diary_migration_notification_sender,
            send_dm,
        )
        command = (
            "notes migrate-apply "
            "diary/~sampel-palnet/discovery-execution --yes"
        )

        async def run():
            first = json.loads(
                await tlon_tool.execute_tlon_tool({"command": command})
            )
            await tlon_tool.wait_for_pending_discovery()
            second = json.loads(
                await tlon_tool.execute_tlon_tool({"command": command})
            )
            await tlon_tool.wait_for_pending_discovery()
            return first, second

        first, second = asyncio.run(run())

        self.assertTrue(first["blocked"])
        self.assertTrue(second["blocked"])
        self.assertIn(
            "/migrate diary/~sampel-palnet/discovery-execution",
            first["error"],
        )
        self.assertEqual(len(calls), 1)
        text, blob = calls[0]
        expected = "/migrate diary/~sampel-palnet/discovery-execution"
        self.assertEqual(text, 'Diary migration available for "Discovery diary"')
        self.assertEqual(self._card_action(blob), expected)

    def test_throwing_card_builder_still_delivers_literal_text(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return True

        async def title_lookup(_nest):
            return "Fallback diary"

        def throw_card(_command, title=None):
            del title
            raise ValueError("bad card")

        nest = "diary/~zod/discovery-card-fallback"
        sent = asyncio.run(
            tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
                build_card=throw_card,
            )
        )

        self.assertTrue(sent)
        self.assertEqual(len(calls), 1)
        self.assertEqual(
            calls[0][0],
            f'Diary migration available for "Fallback diary" — to migrate, type `/migrate {nest}`',
        )
        self.assertIsNone(calls[0][1])

    def test_diary_notification_deduplicates_canonical_nest_variants(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return True

        async def title_lookup(_nest):
            return "Canonical diary"

        async def run():
            await tlon_tool.notify_diary_migration_discovery(
                "Diary/ZOD/Discovery-Canonical",
                sender=send_dm,
                bot_ship="zod",
                owner_ship="mug",
                title_lookup=title_lookup,
            )
            await tlon_tool.notify_diary_migration_discovery(
                "diary/~zod/Discovery-Canonical",
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )

        asyncio.run(run())

        self.assertEqual(len(calls), 1)
        self.assertEqual(
            self._card_action(calls[0][1]),
            "/migrate diary/~zod/Discovery-Canonical",
        )

    def test_diary_notification_rejects_host_mismatch_before_title_lookup(self):
        sends = []
        lookups = []

        async def send_dm(text, blob):
            sends.append((text, blob))
            return True

        async def title_lookup(nest):
            lookups.append(nest)
            return "Foreign diary"

        sent = asyncio.run(
            tlon_tool.notify_diary_migration_discovery(
                "diary/~nec/foreign",
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
        )

        self.assertFalse(sent)
        self.assertEqual(lookups, [])
        self.assertEqual(sends, [])

    def test_diary_notification_rejects_empty_owner_before_title_lookup(self):
        sends = []
        lookups = []

        async def send_dm(text, blob):
            sends.append((text, blob))
            return True

        async def title_lookup(nest):
            lookups.append(nest)
            return "Bot diary"

        sent = asyncio.run(
            tlon_tool.notify_diary_migration_discovery(
                "diary/~zod/ownerless",
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="",
                title_lookup=title_lookup,
            )
        )

        self.assertFalse(sent)
        self.assertEqual(lookups, [])
        self.assertEqual(sends, [])

    def test_missing_diary_title_sends_nothing_and_retries(self):
        sends = []
        lookups = []

        async def send_dm(text, blob):
            sends.append((text, blob))
            return True

        async def title_lookup(nest):
            lookups.append(nest)
            return None

        nest = "diary/~zod/missing-title"

        async def run():
            first = await tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
            second = await tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
            return first, second

        first, second = asyncio.run(run())

        self.assertFalse(first)
        self.assertFalse(second)
        self.assertEqual(lookups, [nest, nest])
        self.assertEqual(sends, [])

    def test_archived_diary_sends_remedy_without_card_and_records(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return True

        async def title_lookup(_nest):
            return f"Old log{tlon_tool.ARCHIVE_TITLE_SUFFIX}"

        nest = "diary/~zod/archived-title"

        async def run():
            first = await tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
            second = await tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
            return first, second

        first, second = asyncio.run(run())

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(calls), 1)
        self.assertEqual(
            calls[0][0],
            f"Found legacy diary `{nest}`, but its title already ends in `{tlon_tool.ARCHIVE_TITLE_SUFFIX}`, "
            "so it looks like it has already been migrated and no action was offered. "
            "If it has not been migrated, rename the channel to remove "
            f"`{tlon_tool.ARCHIVE_TITLE_SUFFIX}` and it can be migrated again.",
        )
        self.assertIsNone(calls[0][1])

    def test_normal_diary_title_sends_warning_card(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return True

        async def title_lookup(_nest):
            return "  Garden journal  "

        nest = "diary/~mug/normal-title"
        sent = asyncio.run(
            tlon_tool.notify_diary_migration_discovery(
                nest,
                sender=send_dm,
                bot_ship="~zod",
                owner_ship="mug",
                title_lookup=title_lookup,
            )
        )

        self.assertTrue(sent)
        self.assertEqual(calls[0][0], 'Diary migration available for "Garden journal"')
        components = self._card_components(calls[0][1])
        self.assertEqual(
            components["title"]["text"],
            'Migrate "Garden journal" to %notes?',
        )
        self.assertIn(
            approval.MIGRATION_CARD_WARNING,
            components["allowNote"]["text"],
        )

    def test_sender_returning_none_does_not_record_delivery(self):
        calls = []

        async def send_dm(text, blob):
            calls.append((text, blob))
            return None

        async def title_lookup(_nest):
            return "Unconfirmed diary"

        nest = "diary/~zod/unconfirmed-send"

        async def run():
            results = []
            for _ in range(2):
                results.append(
                    await tlon_tool.notify_diary_migration_discovery(
                        nest,
                        sender=send_dm,
                        bot_ship="~zod",
                        owner_ship="~mug",
                        title_lookup=title_lookup,
                    )
                )
            return results

        results = asyncio.run(run())

        self.assertEqual(results, [False, False])
        self.assertEqual(len(calls), 2)

    def test_concurrent_diary_notification_awaits_in_flight_delivery(self):
        calls = []

        async def run():
            started = asyncio.Event()
            release = asyncio.Event()

            async def send_dm(text, blob):
                calls.append((text, blob))
                started.set()
                await release.wait()
                return True

            async def title_lookup(_nest):
                return "Concurrent diary"

            kwargs = {
                "sender": send_dm,
                "bot_ship": "~zod",
                "owner_ship": "~mug",
                "title_lookup": title_lookup,
            }
            first = asyncio.create_task(
                tlon_tool.notify_diary_migration_discovery(
                    "diary/~zod/concurrent", **kwargs
                )
            )
            await started.wait()
            second = asyncio.create_task(
                tlon_tool.notify_diary_migration_discovery(
                    "diary/~zod/concurrent", **kwargs
                )
            )
            await asyncio.sleep(0)
            second_waited = not second.done()
            release.set()
            return second_waited, await first, await second

        second_waited, first, second = asyncio.run(run())

        self.assertTrue(second_waited)
        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(calls), 1)

    def test_blocked_tool_result_returns_before_notification_sender_resolves(self):
        calls = []

        async def run():
            started = asyncio.Event()
            release = asyncio.Event()

            async def send_dm(text, blob):
                calls.append((text, blob))
                started.set()
                await release.wait()
                return True

            async def title_lookup(_nest):
                return "Detached diary"

            tlon_tool.set_diary_migration_notification_sender(
                send_dm,
                bot_ship="~zod",
                owner_ship="~mug",
                title_lookup=title_lookup,
            )
            try:
                execute = asyncio.create_task(
                    tlon_tool.execute_tlon_tool(
                        {"command": "channels info diary/~zod/detached"}
                    )
                )
                await started.wait()
                returned_before_release = execute.done()
                release.set()
                payload = json.loads(await execute)
                await tlon_tool.wait_for_pending_discovery()
                return returned_before_release, payload
            finally:
                tlon_tool.clear_diary_migration_notification_sender(send_dm)

        returned_before_release, payload = asyncio.run(run())

        self.assertTrue(returned_before_release)
        self.assertTrue(payload["blocked"])
        self.assertEqual(len(calls), 1)

    def test_diary_refusal_without_active_adapter_still_returns_normally(self):
        async def absent_sender(_text, _blob):
            return False

        async def title_lookup(_nest):
            return "Absent adapter"

        tlon_tool.set_diary_migration_notification_sender(
            absent_sender,
            bot_ship="~zod",
            owner_ship="~mug",
            title_lookup=title_lookup,
        )
        tlon_tool.clear_diary_migration_notification_sender(absent_sender)

        async def run():
            payload = json.loads(
                await tlon_tool.execute_tlon_tool(
                    {
                        "command": (
                            "notebook diary/~zod/discovery-no-adapter Title"
                        )
                    }
                )
            )
            await tlon_tool.wait_for_pending_discovery()
            return payload

        payload = asyncio.run(run())

        self.assertTrue(payload["blocked"])
        self.assertIn(
            "/migrate diary/~zod/discovery-no-adapter",
            payload["error"],
        )

    def test_execute_tlon_tool_runs_allowed_command(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append((tuple(command), dict(env), timeout))
            return tlon_api.TlonProcessResult(returncode=0, stdout="~zod\n")

        async def run():
            return await tlon_tool.execute_tlon_tool(
                {"command": "contacts self"},
                config=cfg,
                runner=runner,
            )

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["success"])
        self.assertEqual(payload["stdout"], "~zod\n")
        self.assertEqual(calls[0][0], ("tlon-test", "contacts", "self"))
        self.assertEqual(calls[0][1]["TLON_NODE_URL"], "https://zod.tlon.network")

    def test_execute_tlon_tool_runs_notes_command(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append(tuple(command))
            return tlon_api.TlonProcessResult(returncode=0, stdout="[]\n")

        async def run():
            return await tlon_tool.execute_tlon_tool(
                {"command": "notes list"},
                config=cfg,
                runner=runner,
            )

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["success"])
        self.assertEqual(calls[0], ("tlon-test", "notes", "list"))

    def test_execute_tlon_tool_does_not_run_blocked_command(self):
        async def runner(command, env, timeout, _on_deadline):
            raise AssertionError("blocked command should not execute")

        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
            }
        )

        async def run():
            return await tlon_tool.execute_tlon_tool(
                {"command": 'posts send chat/~zod/general "hello"'},
                config=cfg,
                runner=runner,
            )

        # Blocked because the target equals the current conversation.
        with patch.dict(
            os.environ, {"HERMES_SESSION_CHAT_ID": "chat/~zod/general"}, clear=False
        ):
            payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["blocked"])
        self.assertIn("current conversation", payload["error"])

    def test_execute_tlon_tool_uses_session_env_for_group_create_guard(self):
        async def runner(command, env, timeout, _on_deadline):
            raise AssertionError("blocked command should not execute")

        async def run():
            return await tlon_tool.execute_tlon_tool(
                {"command": 'groups create "Animals"'},
                runner=runner,
            )

        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~mug",
            },
            clear=False,
        ):
            payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["blocked"])
        self.assertIn("groups create-owned Animals --owner ~mug", payload["error"])

    def test_execute_tlon_tool_maps_help_and_version_to_cli_flags(self):
        calls = []
        cfg = tlon_api.TlonConfig.from_env(
            env={
                "TLON_NODE_URL": "https://zod.tlon.network",
                "TLON_NODE_ID": "~zod",
                "TLON_ACCESS_CODE": "code",
                "TLON_CLI": "tlon-test",
            }
        )

        async def runner(command, env, timeout, _on_deadline):
            calls.append(tuple(command))
            return tlon_api.TlonProcessResult(returncode=0, stdout="ok\n")

        async def run():
            help_result = await tlon_tool.execute_tlon_tool(
                {"command": "help"},
                config=cfg,
                runner=runner,
            )
            version_result = await tlon_tool.execute_tlon_tool(
                {"command": "version"},
                config=cfg,
                runner=runner,
            )
            return json.loads(help_result), json.loads(version_result)

        help_payload, version_payload = asyncio.run(run())

        self.assertTrue(help_payload["success"])
        self.assertTrue(version_payload["success"])
        self.assertEqual(calls, [("tlon-test", "--help"), ("tlon-test", "--version")])

    def test_execute_tlon_tool_reports_parse_error(self):
        payload = json.loads(
            asyncio.run(tlon_tool.execute_tlon_tool({"command": 'contacts "unterminated'}))
        )

        self.assertIn("Could not parse", payload["error"])


class TlonSkillPathTests(unittest.TestCase):
    def test_resolve_tlon_skill_path_uses_explicit_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / "SKILL.md"
            skill.write_text("# Tlon\n", encoding="utf-8")

            self.assertEqual(
                tlon_tool.resolve_tlon_skill_path({"TLON_SKILL_PATH": str(skill)}),
                skill,
            )

    def test_resolve_tlon_skill_path_uses_explicit_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill_dir = Path(tmp) / "tlon-skill"
            skill_dir.mkdir()
            skill = skill_dir / "SKILL.md"
            skill.write_text("# Tlon\n", encoding="utf-8")

            self.assertEqual(
                tlon_tool.resolve_tlon_skill_path({"TLON_SKILL_DIR": str(skill_dir)}),
                skill,
            )

    def test_resolve_tlon_product_guide_path_uses_explicit_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            guide = Path(tmp) / "SKILL.md"
            guide.write_text("# Tlon Messenger\n", encoding="utf-8")

            self.assertEqual(
                tlon_tool.resolve_tlon_product_guide_path(
                    {"TLON_PRODUCT_GUIDE_PATH": str(guide)}
                ),
                guide,
            )

    def test_resolve_tlon_product_guide_path_uses_plugin_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            plugin_dir = Path(tmp) / "openclaw"
            guide = plugin_dir / "skills" / "tlon-product-guide" / "SKILL.md"
            guide.parent.mkdir(parents=True)
            guide.write_text("# Tlon Messenger\n", encoding="utf-8")

            self.assertEqual(
                tlon_tool.resolve_tlon_product_guide_path(
                    {"TLON_PLUGIN_DIR": str(plugin_dir)}
                ),
                guide,
            )

    def test_resolve_tlon_product_guide_path_falls_back_to_sibling_package(self):
        # No env pointing anywhere: the monorepo layout (this adapter and the
        # OpenClaw plugin as sibling packages) has to resolve on its own. This
        # is the assertion that breaks if the skill directory is ever moved or
        # renamed inside the plugin.
        resolved = tlon_tool.resolve_tlon_product_guide_path({})

        self.assertIsNotNone(resolved)
        assert resolved is not None
        self.assertTrue(resolved.is_file())
        self.assertEqual(resolved.parent.name, "tlon-product-guide")

    def test_resolve_tlon_product_guide_path_absent_without_plugin_tree(self):
        # A Hermes deployment that installs the adapter without the OpenClaw
        # plugin registers no product-guide skill rather than failing to boot.
        # The sibling fallback resolves inside this monorepo, so point the
        # search at a tree that has neither.
        with tempfile.TemporaryDirectory() as tmp:
            adapter_dir = Path(tmp) / "packages" / "hermes-tlon-adapter"
            adapter_dir.mkdir(parents=True)
            with patch.object(
                tlon_tool, "__file__", str(adapter_dir / "tlon_tool.py")
            ):
                self.assertIsNone(
                    tlon_tool.resolve_tlon_product_guide_path(
                        {"TLON_PLUGIN_DIR": str(Path(tmp) / "nonexistent")}
                    )
                )


class TlonSessionGateTests(unittest.TestCase):
    """The `tlon` tool is owner-only in Tlon chat sessions.

    Enforcement lives in ``block_tlon_session_tool`` and is arg-independent — it
    gates the whole tool before any command is parsed, so every ``notes``
    subcommand (read or write) inherits the gate. These cases prove that for a
    notes write, mirroring the existing send-block coverage.
    """

    NOTES_WRITE = {
        "command": 'notes note-create notes/~pen/docs root "T" --markdown body.md'
    }

    def test_blocks_notes_write_for_non_owner(self):
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~mug",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
            block = adapter_mod.block_tlon_session_tool("tlon", self.NOTES_WRITE)

        self.assertIsNotNone(block)
        self.assertEqual(block["action"], "block")
        self.assertIn("owner-only", block["message"])

    def test_allows_notes_write_for_owner(self):
        with patch.dict(
            os.environ,
            {
                "HERMES_SESSION_PLATFORM": "tlon",
                "HERMES_SESSION_USER_ID": "~pen",
                "TLON_OWNER_SHIP": "~pen",
            },
            clear=True,
        ):
            block = adapter_mod.block_tlon_session_tool("tlon", self.NOTES_WRITE)

        self.assertIsNone(block)


class ReactionToolGateTests(unittest.TestCase):
    def test_reaction_level_blocks_off_and_ack_but_allows_enabled_levels(self):
        args, error = tlon_tool.split_tlon_command(
            'posts react chat/~pen/general 170.141 "👍"'
        )
        self.assertIsNone(error)
        for level in ("off", "ack"):
            with self.subTest(level=level):
                blocked = tlon_tool.check_tlon_tool_command(args, reaction_level=level)
                self.assertIn("TLON_REACTION_LEVEL", blocked)
        for level in ("minimal", "extensive"):
            with self.subTest(level=level):
                self.assertIsNone(
                    tlon_tool.check_tlon_tool_command(args, reaction_level=level)
                )

    def _gate(self, command, **env):
        base = {
            "HERMES_SESSION_PLATFORM": "tlon",
            "HERMES_SESSION_USER_ID": "~mug",
            "HERMES_SESSION_CHAT_ID": "chat/~pen/general",
            "TLON_OWNER_SHIP": "~pen",
            "TLON_REACTION_LEVEL": "minimal",
        }
        base.update(env)
        with patch.dict(os.environ, base, clear=True):
            return adapter_mod.block_tlon_session_tool("tlon", {"command": command})

    def test_non_owner_reaction_carveout_is_bound_to_current_conversation(self):
        self.assertIsNone(
            self._gate('posts react chat/~pen/general 170.141 "👍"')
        )
        self.assertIn(
            "use posts",
            self._gate('dms react ~mug ~pen/170.141 "👍"')["message"],
        )
        self.assertIn(
            "current conversation",
            self._gate('posts react chat/~pen/else 170.141 "👍"')["message"],
        )
        self.assertIn(
            "owner-only",
            self._gate('posts delete chat/~pen/general 170.141')["message"],
        )
        self.assertIn("owner-only", self._gate('posts "unterminated')["message"])

    def test_non_owner_reaction_blocks_credentials_and_wrong_dm_family(self):
        for command in (
            '--ship ~other posts react chat/~pen/general 170.141 "👍"',
            '--config file posts react chat/~pen/general 170.141 "👍"',
            '--url=https://other posts react chat/~pen/general 170.141 "👍"',
        ):
            with self.subTest(command=command):
                self.assertIn("credential override", self._gate(command)["message"])
        self.assertIsNone(
            self._gate(
                'dms unreact ~mug ~pen/170.141',
                HERMES_SESSION_CHAT_ID="~mug",
            )
        )
        self.assertIn(
            "use dms",
            self._gate(
                'posts react ~mug 170.141 "👍"',
                HERMES_SESSION_CHAT_ID="~mug",
            )["message"],
        )
        self.assertIn(
            "disabled",
            self._gate(
                'posts react chat/~pen/general 170.141 "👍"',
                TLON_REACTION_LEVEL="ack",
            )["message"],
        )

    def test_owner_keeps_unrestricted_tlon_access(self):
        self.assertIsNone(
            self._gate(
                'posts react chat/~other/else 170.141 "👍"',
                HERMES_SESSION_USER_ID="~pen",
                TLON_REACTION_LEVEL="off",
            )
        )



class MediaCommandTimeoutTests(unittest.TestCase):
    def test_upload_and_image_sends_get_budgets_above_the_cli_fetch_deadlines(self):
        timeout = tlon_tool.media_command_timeout
        self.assertEqual(
            timeout(["upload", "https://x.example/a.png"]),
            tlon_tool.UPLOAD_CLI_TIMEOUT_SECONDS,
        )
        self.assertEqual(
            timeout(["--config", "/tmp/c.json", "upload", "https://x.example/a.png"]),
            tlon_tool.UPLOAD_CLI_TIMEOUT_SECONDS,
        )
        for args in (
            ["posts", "send", "chat/~pen/general", "hi", "--image", "https://x/y.png"],
            ["posts", "send", "chat/~pen/general", "--image=https://x/y.png"],
            ["dms", "send", "0v5.abcde", "hi", "--image", "https://x/y.png"],
        ):
            self.assertEqual(
                timeout(args), tlon_tool.IMAGE_SEND_CLI_TIMEOUT_SECONDS, args
            )

        # The override must clear the CLI's own inner budgets, or the model
        # sees "tlon CLI timed out" instead of the contract error.
        self.assertGreater(tlon_tool.UPLOAD_CLI_TIMEOUT_SECONDS, 120.0)
        self.assertGreater(tlon_tool.IMAGE_SEND_CLI_TIMEOUT_SECONDS, 30.0)

    def test_non_media_commands_keep_the_default_timeout(self):
        timeout = tlon_tool.media_command_timeout
        for args in (
            ["posts", "send", "chat/~pen/general", "hi"],
            ["dms", "send", "0v5.abcde", "hi"],
            ["posts", "react", "chat/~pen/general", "170.141", "\u2764\ufe0f"],
            ["activity", "mentions"],
            ["contacts", "self"],
            [],
        ):
            self.assertIsNone(timeout(args), args)

    def test_execute_passes_the_override_to_the_cli(self):
        recorded = {}

        class RecordingCLI:
            def __init__(self, *_args, **_kwargs):
                pass

            async def run_command(self, args, *, timeout=None, on_deadline=None):
                recorded[tuple(args)] = timeout
                return tlon_api.TlonSendResult(success=True, command=tuple(args))

        config = tlon_api.TlonConfig(
            ship_url="https://pen.tlon.network",
            ship_name="~pen",
            ship_code="code",
        )
        with patch.object(tlon_tool, "TlonCLI", RecordingCLI):
            asyncio.run(
                tlon_tool.execute_tlon_tool(
                    {"command": "upload https://x.example/a.png"}, config=config
                )
            )
            asyncio.run(
                tlon_tool.execute_tlon_tool(
                    {"command": "activity mentions"}, config=config
                )
            )

        self.assertEqual(
            recorded[("upload", "https://x.example/a.png")],
            tlon_tool.UPLOAD_CLI_TIMEOUT_SECONDS,
        )
        self.assertIsNone(recorded[("activity", "mentions")])


if __name__ == "__main__":
    unittest.main()
