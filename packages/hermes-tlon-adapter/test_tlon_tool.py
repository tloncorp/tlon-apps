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
adapter_mod = load_module("adapter")


class TlonToolGuardTests(unittest.TestCase):
    def test_credential_flags_are_skipped_before_subcommand(self):
        args, error = tlon_tool.split_tlon_command(
            "--url http://127.0.0.1:8080 --ship ~zod contacts self"
        )

        self.assertIsNone(error)
        self.assertEqual(tlon_tool.find_subcommand_index(args), 4)
        self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

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

    def test_blocks_notebook(self):
        args, error = tlon_tool.split_tlon_command('notebook diary/~zod/notes "Title"')
        self.assertIsNone(error)
        blocked = tlon_tool.check_tlon_tool_command(args)
        self.assertIsNotNone(blocked)
        self.assertIn("notebook", blocked.lower())
        # The redirect must point at the replacement, not the removed backend.
        self.assertIn("notes", blocked.lower())

    def test_allows_notes_read_and_write_commands(self):
        # %notes replaced the removed %diary/notebook backend; reads and writes
        # both pass the tool guard (owner gating happens at the session level).
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

        async def runner(command, env, timeout):
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

        async def runner(command, env, timeout):
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
        async def runner(command, env, timeout):
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
        async def runner(command, env, timeout):
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

        async def runner(command, env, timeout):
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


if __name__ == "__main__":
    unittest.main()
