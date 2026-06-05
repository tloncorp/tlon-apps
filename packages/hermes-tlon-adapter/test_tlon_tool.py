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


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(module_name, PACKAGE_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


tlon_api = load_module("tlon_api")
tlon_tool = load_module("tlon_tool")


class TlonToolGuardTests(unittest.TestCase):
    def test_credential_flags_are_skipped_before_subcommand(self):
        args, error = tlon_tool.split_tlon_command(
            "--url http://127.0.0.1:8080 --ship ~zod contacts self"
        )

        self.assertIsNone(error)
        self.assertEqual(tlon_tool.find_subcommand_index(args), 4)
        self.assertIsNone(tlon_tool.check_tlon_tool_command(args))

    def test_blocks_message_delivery_commands(self):
        commands = [
            'dms send ~nec "hello"',
            'dms reply ~nec 170.141 "hello"',
            'posts send chat/~zod/general "hello"',
            'posts reply chat/~zod/general 170.141 "hello"',
            'notebook diary/~zod/notes "Title"',
        ]

        for command in commands:
            with self.subTest(command=command):
                args, error = tlon_tool.split_tlon_command(command)
                self.assertIsNone(error)
                blocked = tlon_tool.check_tlon_tool_command(args)
                self.assertIsNotNone(blocked)
                self.assertIn("TlonAdapter.send", blocked)

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

        payload = json.loads(asyncio.run(run()))

        self.assertTrue(payload["blocked"])
        self.assertIn("TlonAdapter.send", payload["error"])

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


if __name__ == "__main__":
    unittest.main()
