import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).parent
PACKAGE_NAME = "hermes_tlon_adapter_migration_testpkg"

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PACKAGE_DIR)]
sys.modules[PACKAGE_NAME] = package


def load_module(name):
    module_name = f"{PACKAGE_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(
        module_name, PACKAGE_DIR / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


tlon_api = load_module("tlon_api")
owner_listen = load_module("owner_listen")
approval = load_module("approval")
migration = load_module("migration")


def result(*, success=True, stdout="", stderr="", error=None, timed_out=False):
    return tlon_api.TlonSendResult(
        success=success,
        command=("tlon",),
        stdout=stdout,
        stderr=stderr,
        error=error,
        returncode=0 if success else 1,
        timed_out=timed_out,
    )


def assert_drop_warning(test_case, text):
    test_case.assertIn(
        "comments, reactions, post references, and link blocks stay on the "
        "archived channel and are not copied",
        text,
    )
    test_case.assertIn(
        "Post descriptions, covers, and attachments also stay in the archive "
        "and are not copied",
        text,
    )
    test_case.assertIn("Group mentions become plain text", text)
    test_case.assertIn(
        "Every migrated note will show the acting ship as its author", text
    )
    test_case.assertIn(
        "source channel stays intact, remains writable, and is renamed with an "
        "`-ARCHIVE` suffix",
        text,
    )


def parse_migrate_card(blob):
    entry = json.loads(blob)[0]
    update = next(
        message["updateComponents"]
        for message in entry["messages"]
        if "updateComponents" in message
    )
    components = {
        component["id"]: component
        for component in update["components"]
    }
    action = components["action"]
    label = components[action["child"]]
    return (
        action["action"]["event"]["context"]["text"],
        label["text"],
    )


class MigrationParsingTests(unittest.TestCase):
    def test_canonicalizes_migrate_and_cleanup(self):
        self.assertEqual(
            migration.parse_migrate_command(
                "/migrate Diary/BOT/Field-Notes"
            ),
            migration.ParsedMigrationCommand(
                "migrate", "diary/~bot/Field-Notes"
            ),
        )
        self.assertEqual(
            migration.parse_migrate_command(
                "/migrate cleanup notes/BOT/Field-Notes"
            ),
            migration.ParsedMigrationCommand(
                "cleanup", "notes/~bot/Field-Notes"
            ),
        )

    def test_rejects_confirm_and_extra_flags(self):
        self.assertEqual(
            migration.parse_migrate_command(
                "/migrate confirm diary/~bot/log"
            ),
            migration.MIGRATE_USAGE,
        )
        self.assertEqual(
            migration.parse_migrate_command(
                "/migrate diary/~bot/log --allow-write-widening --extra"
            ),
            migration.MIGRATE_USAGE,
        )


class MigrationControllerTests(unittest.TestCase):
    def test_ack_warns_before_direct_apply_and_never_plans(self):
        calls = []
        replies = []
        dms = []

        async def run_command(args, timeout):
            calls.append((tuple(args), timeout))
            return result(stdout="Migration complete.\n")

        async def send_dm(text, blob):
            dms.append((text, blob))

        async def send_reply(text):
            replies.append(text)

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
            )
            await controller.handle(
                "/migrate diary/~bot/bulletin",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=send_reply,
            )
            self.assertEqual(calls, [])
            self.assertIn("Migration started", replies[0])
            assert_drop_warning(self, replies[0])
            self.assertIn(migration.MIGRATION_DROP_WARNING, replies[0])
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertEqual(
            calls,
            [
                (
                    (
                        "notes",
                        "migrate-apply",
                        "diary/~bot/bulletin",
                        "--yes",
                    ),
                    migration.MIGRATION_APPLY_TIMEOUT_SECONDS,
                )
            ],
        )
        self.assertNotIn("migrate-plan", calls[0][0])
        self.assertEqual(dms, [("Migration complete.\n", None)])

    def test_passes_widening_acceptance_directly_to_apply(self):
        calls = []

        async def run_command(args, timeout):
            calls.append((tuple(args), timeout))
            return result(stdout="Migration complete.\n")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0),
            )
            await controller.handle(
                "/migrate diary/~bot/log --allow-write-widening",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertEqual(
            calls[0],
            (
                (
                    "notes",
                    "migrate-apply",
                    "diary/~bot/log",
                    "--yes",
                    "--allow-write-widening",
                ),
                migration.MIGRATION_APPLY_TIMEOUT_SECONDS,
            ),
        )

    def test_cards_widening_refusal_with_exact_command_and_literal_fallback(self):
        refusal = (
            "Migration would widen write access: readers would gain write "
            "access. Refusing without explicit acceptance — pass "
            "--allow-write-widening to accept.\n"
        )
        calls = []
        replies = []
        dms = []

        async def run_command(args, timeout):
            calls.append((tuple(args), timeout))
            return result(success=False, stderr=refusal, error=refusal.strip())

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: self._append_async(
                    dms, (text, blob)
                ),
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda text: self._append_async(replies, text),
            )
            self.assertEqual(calls, [])
            assert_drop_warning(self, replies[0])
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        command = "/migrate diary/~bot/log --allow-write-widening"
        self.assertIn(refusal.strip(), dms[0][0])
        self.assertIn(command, dms[0][0])
        self.assertIn("every reader will become an editor", dms[0][0])
        self.assertEqual(
            parse_migrate_card(dms[0][1]),
            (
                command,
                "Accept widening and proceed — every reader becomes an editor",
            ),
        )

    def test_cards_bot_known_target_with_cleanup_command_and_literal_fallback(self):
        dms = []

        async def run_command(_args, _timeout):
            return result(
                success=False,
                stdout=(
                    "Target notebook created: "
                    "notes/~bot/field-notes\n"
                ),
                error="Import failed",
            )

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: self._append_async(
                    dms, (text, blob)
                ),
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        command = "/migrate cleanup notes/~bot/field-notes"
        self.assertIn(command, dms[0][0])
        self.assertEqual(
            parse_migrate_card(dms[0][1]),
            (command, "Delete notebook"),
        )

    def test_unknown_create_outcome_has_no_card_or_builder_call(self):
        dms = []
        card_commands = []

        async def run_command(_args, _timeout):
            return result(
                success=False,
                stderr=(
                    "Create failed\n"
                    "Notebook creation may or may not have landed."
                ),
            )

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: self._append_async(
                    dms, (text, blob)
                ),
                build_card=build_card,
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertIsNone(dms[0][1])
        self.assertIn(
            "requested title in the bot ship’s Notes web UI",
            dms[0][0],
        )
        self.assertEqual(card_commands, [])

    def test_throwing_card_builder_still_delivers_literal_command_text(self):
        dms = []
        refusal = (
            "Migration would widen write access. Pass "
            "--allow-write-widening to accept."
        )

        async def run_command(_args, _timeout):
            return result(
                success=False,
                stderr=refusal,
                error=refusal,
            )

        def build_card(_command):
            raise RuntimeError("card failed")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: self._append_async(
                    dms, (text, blob)
                ),
                build_card=build_card,
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        with self.assertLogs(migration.logger, level="ERROR"):
            asyncio.run(scenario())
        self.assertIsNone(dms[0][1])
        self.assertIn(
            "/migrate diary/~bot/log --allow-write-widening",
            dms[0][0],
        )

    @staticmethod
    async def _append_async(target, value):
        target.append(value)

    def test_owner_credentials_are_literal_argv_and_foreign_host_refuses(self):
        selection = migration.select_migration_credentials(
            "diary/~owner/log",
            bot_ship="~bot",
            owner_ship="~owner",
            env={
                "TLON_OWNER_URL": "https://owner.test",
                "TLON_OWNER_SHIP": "~owner",
                "TLON_PLANET_CODE": "owner-code",
            },
        )
        self.assertEqual(selection.kind, "owner-hosted")
        self.assertEqual(
            selection.prefix_args,
            (
                "--url",
                "https://owner.test",
                "--ship",
                "~owner",
                "--code",
                "owner-code",
            ),
        )
        refused = migration.select_migration_credentials(
            "diary/~nec/log",
            bot_ship="~bot",
            owner_ship="~owner",
            env={},
        )
        self.assertIn("~nec", refused.error)

    def test_owner_known_target_failure_has_no_card(self):
        dms = []
        card_commands = []

        async def run_command(_args, _timeout):
            return result(
                success=False,
                stdout="Target notebook created: notes/~owner/log\n",
                error="Import failed",
            )

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: self._append_async(
                    dms, (text, blob)
                ),
                env={
                    "TLON_OWNER_URL": "https://owner.test",
                    "TLON_OWNER_SHIP": "~owner",
                    "TLON_PLANET_CODE": "owner-code",
                },
                build_card=build_card,
            )
            await controller.handle(
                "/migrate diary/~owner/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertIsNone(dms[0][1])
        self.assertIn(
            "Delete the notebook `notes/~owner/log` in the Notes app",
            dms[0][0],
        )
        self.assertEqual(card_commands, [])

    def test_self_hosted_owner_path_fails_closed(self):
        selection = migration.select_migration_credentials(
            "diary/~owner/log",
            bot_ship="~bot",
            owner_ship="~owner",
            env={"TLON_OWNER_SHIP": "~owner"},
        )
        self.assertIn("TLON_OWNER_URL", selection.error)
        self.assertIn("~owner", selection.error)

    def test_cleanup_runs_notebook_delete_as_owner_control_path(self):
        calls = []
        replies = []
        dms = []

        async def run_command(args, timeout):
            calls.append((tuple(args), timeout))
            return result(stdout="Deleted notes/~bot/log\n")

        async def send_dm(text, blob):
            dms.append((text, blob))

        async def send_reply(text):
            replies.append(text)

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
            )
            await controller.handle(
                "/migrate cleanup notes/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=send_reply,
            )
            self.assertEqual(calls, [])
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertEqual(
            calls[0],
            (
                ("notes", "notebook-delete", "notes/~bot/log", "--yes"),
                migration.MIGRATION_CLEANUP_TIMEOUT_SECONDS,
            ),
        )
        self.assertIn("Cleanup started", replies[0])
        self.assertIn("Deleted", dms[0][0])


class MigrationFailureTests(unittest.TestCase):
    def test_timeout_relays_stdout_and_offers_bot_cleanup(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stdout="Target notebook created: notes/~bot/field-notes\n",
                error="tlon CLI timed out",
                timed_out=True,
            ),
            "bot-hosted",
        )
        self.assertIn(
            "Target notebook created: notes/~bot/field-notes", text
        )
        self.assertIn(
            "/migrate cleanup notes/~bot/field-notes", text
        )

    def test_create_failure_uses_bot_notes_web_ui(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stderr=(
                    "Create failed\nNotebook creation may or may not have "
                    "landed. Look for a notebook with the requested title in "
                    "the Notes app and remove it before retrying."
                ),
            ),
            "bot-hosted",
        )
        self.assertIn(
            "requested title in the bot ship’s Notes web UI", text
        )
        self.assertNotIn("cleanup notes/", text)

    def test_create_failure_uses_owner_notes_app(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stderr=(
                    "Create failed\n"
                    "Notebook creation may or may not have landed."
                ),
            ),
            "owner-hosted",
        )
        self.assertIn("requested title in your Notes app", text)
        self.assertNotIn("bot ship", text)

    def test_owner_host_uses_notes_app_recovery_for_known_target(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stdout="Target notebook created: notes/~owner/log\n",
                error="Import failed",
            ),
            "owner-hosted",
        )
        self.assertIn("Delete the notebook `notes/~owner/log`", text)
        self.assertNotIn("/migrate cleanup", text)


if __name__ == "__main__":
    unittest.main()
