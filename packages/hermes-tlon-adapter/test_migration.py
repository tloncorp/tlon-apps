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


class MigrationDropWarningTests(unittest.TestCase):
    def test_drop_warning_pins_exact_hermes_copy(self):
        # OpenClaw's migration source is not present on every branch that runs
        # this Python suite, so pin the complete Hermes copy here.
        self.assertEqual(
            migration.MIGRATION_DROP_WARNING,
            "Before any write: comments, reactions, post references, and link blocks "
            "stay on the archived channel and are not copied. Post descriptions, covers, "
            "and attachments also stay in the archive and are not copied. Group mentions "
            "become plain text. Every migrated note will show the acting ship as its "
            "author, regardless of who wrote the original. Migrated notes are dated at "
            "import time. Note order follows the import, not the original post dates. "
            "The source channel stays intact, remains writable, and is renamed with an "
            "`-ARCHIVE` suffix.",
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
    def test_ack_is_scheduled_before_direct_apply_and_never_plans(self):
        calls = []
        replies = []
        dms = []
        scheduling = []

        async def run_command(args, timeout, _on_deadline):
            scheduling.append("apply")
            calls.append((tuple(args), timeout))
            return result(stdout="Migration complete.\n")

        async def send_dm(text, blob):
            dms.append((text, blob))
            return True

        async def send_reply(text):
            scheduling.append("acknowledgement")
            replies.append(text)
            await asyncio.sleep(0)

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
            self.assertIn("Migration started", replies[0])
            assert_drop_warning(self, replies[0])
            self.assertIn(migration.MIGRATION_DROP_WARNING, replies[0])
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertEqual(scheduling[:2], ["acknowledgement", "apply"])
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

        async def run_command(args, timeout, _on_deadline):
            calls.append((tuple(args), timeout))
            return result(stdout="Migration complete.\n")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
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

        async def run_command(args, timeout, _on_deadline):
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

        async def run_command(_args, _timeout, _on_deadline):
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

        async def run_command(_args, _timeout, _on_deadline):
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

        async def run_command(_args, _timeout, _on_deadline):
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
        return True

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

    def test_owner_known_target_failure_offers_cleanup_card(self):
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False,
                stdout="Target notebook created: notes/~owner/log\n",
                error="Import failed",
            )

        def build_card(command):
            card_commands.append(command)
            return approval.build_migrate_card(command)

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
        command = "/migrate cleanup notes/~owner/log"
        self.assertIn(command, dms[0][0])
        self.assertEqual(card_commands, [command])
        self.assertEqual(
            parse_migrate_card(dms[0][1]),
            (command, "Delete notebook"),
        )

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

        async def run_command(args, timeout, _on_deadline):
            calls.append((tuple(args), timeout))
            return result(stdout="Deleted notes/~bot/log\n")

        async def send_dm(text, blob):
            dms.append((text, blob))
            return True

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


class MigrationInFlightTests(unittest.TestCase):
    def test_apply_keys_normalize_prefix_and_ship_but_preserve_channel_case(self):
        calls = []
        replies = []
        release = asyncio.Event()

        async def run_command(args, _timeout, _on_deadline):
            calls.append(tuple(args))
            await release.wait()
            return result(stdout="Migration complete.\n")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
            )

            async def handle(command):
                await controller.handle(
                    command,
                    bot_ship="~zod",
                    owner_ship="~owner",
                    send_reply=lambda text: MigrationControllerTests._append_async(
                        replies, text
                    ),
                )

            await handle("/migrate DIARY/~Zod/Log")
            await handle("/migrate diary/~zod/Log")
            await handle("/migrate diary/~zod/Field-Notes")
            await handle("/migrate diary/~zod/field-notes")
            await asyncio.sleep(0)
            self.assertEqual(len(calls), 3)
            self.assertEqual(
                replies[1],
                "A migration for diary/~zod/Log is already running.",
            )
            self.assertEqual(
                {call[2] for call in calls},
                {
                    "diary/~zod/Log",
                    "diary/~zod/Field-Notes",
                    "diary/~zod/field-notes",
                },
            )
            release.set()
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())

    def test_cleanup_keys_normalize_ship_and_preserve_channel_case(self):
        calls = []
        replies = []
        release = asyncio.Event()

        async def run_command(args, _timeout, _on_deadline):
            calls.append(tuple(args))
            await release.wait()
            return result(stdout="Notebook deleted.\n")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
            )

            async def handle(command):
                await controller.handle(
                    command,
                    bot_ship="~zod",
                    owner_ship="~owner",
                    send_reply=lambda text: MigrationControllerTests._append_async(
                        replies, text
                    ),
                )

            await handle("/migrate cleanup NOTES/~Zod/Log")
            await handle("/migrate cleanup notes/~zod/Log")
            await handle("/migrate cleanup notes/~zod/Field-Notes")
            await handle("/migrate cleanup notes/~zod/field-notes")
            await asyncio.sleep(0)
            self.assertEqual(len(calls), 3)
            self.assertEqual(
                replies[1],
                "A migration cleanup for notes/~zod/Log is already running.",
            )
            self.assertEqual(
                {call[2] for call in calls},
                {
                    "notes/~zod/Log",
                    "notes/~zod/Field-Notes",
                    "notes/~zod/field-notes",
                },
            )
            release.set()
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())

    def test_cleanup_blocks_every_apply_and_apply_blocks_every_cleanup(self):
        async def blocked_pair(first, second):
            calls = []
            replies = []
            release = asyncio.Event()

            async def run_command(args, _timeout, _on_deadline):
                calls.append(tuple(args))
                await release.wait()
                return result(stdout="Done.\n")

            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
            )
            for command in (first, second):
                await controller.handle(
                    command,
                    bot_ship="~bot",
                    owner_ship="~owner",
                    send_reply=lambda text: MigrationControllerTests._append_async(
                        replies, text
                    ),
                )
            await asyncio.sleep(0)
            release.set()
            await controller.wait_for_background_tasks()
            return calls, replies

        async def scenario():
            cleanup_calls, cleanup_first_replies = await blocked_pair(
                "/migrate cleanup notes/~bot/one",
                "/migrate diary/~bot/two",
            )
            self.assertEqual(len(cleanup_calls), 1)
            self.assertEqual(
                cleanup_first_replies[1],
                "A migration cleanup is currently running. Wait for it to "
                "finish, then retry the migration.",
            )

            apply_calls, apply_first_replies = await blocked_pair(
                "/migrate diary/~bot/one",
                "/migrate cleanup notes/~bot/two",
            )
            self.assertEqual(len(apply_calls), 1)
            self.assertEqual(
                apply_first_replies[1],
                "A migration is currently running. Wait for it to finish, then "
                "retry the cleanup.",
            )

        asyncio.run(scenario())

    def test_failed_apply_releases_guard_for_retry(self):
        calls = []

        async def run_command(args, _timeout, _on_deadline):
            calls.append(tuple(args))
            return result(success=False, error="Import failed")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
            )
            for _ in range(2):
                await controller.handle(
                    "/migrate diary/~bot/log",
                    bot_ship="~bot",
                    owner_ship="~owner",
                    send_reply=lambda _text: asyncio.sleep(0),
                )
                await controller.wait_for_background_tasks()
            self.assertEqual(len(calls), 2)

        asyncio.run(scenario())

    def test_release_does_not_remove_a_replaced_in_flight_identity(self):
        started = asyncio.Event()
        release = asyncio.Event()

        async def run_command(_args, _timeout, _on_deadline):
            started.set()
            await release.wait()
            return result(stdout="Migration complete.\n")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda _text, _blob: asyncio.sleep(0, result=True),
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await started.wait()
            replacement = object()
            controller._apply_in_flight["diary/~bot/log"] = replacement
            release.set()
            await controller.wait_for_background_tasks()
            self.assertIs(
                controller._apply_in_flight["diary/~bot/log"], replacement
            )

        asyncio.run(scenario())


class MigrationCleanupOutcomeTests(unittest.TestCase):
    def test_partial_cleanup_variants_report_success_without_card(self):
        variants = (
            ": its old group listing is still present.",
            ": the group listing could not be checked.",
        )
        for tail in variants:
            with self.subTest(tail=tail):
                dms = []
                card_commands = []

                async def run_command(_args, _timeout, _on_deadline):
                    return result(
                        success=False,
                        stderr=(
                            "Notebook deleted; group cleanup unconfirmed for "
                            f"notes/~bot/log{tail}"
                        ),
                    )

                def build_card(command):
                    card_commands.append(command)
                    return "unexpected"

                async def scenario():
                    controller = migration.MigrationCommandController(
                        run_command=run_command,
                        send_dm=lambda text, blob: MigrationControllerTests._append_async(
                            dms, (text, blob)
                        ),
                        build_card=build_card,
                    )
                    await controller.handle(
                        "/migrate cleanup notes/~bot/log",
                        bot_ship="~bot",
                        owner_ship="~owner",
                        send_reply=lambda _text: asyncio.sleep(0),
                    )
                    await controller.wait_for_background_tasks()

                asyncio.run(scenario())
                self.assertEqual(
                    dms,
                    [
                        (
                            "The notebook `notes/~bot/log` was deleted "
                            "successfully. The channel may still show in your "
                            "group for a moment. Wait a few seconds, then retry "
                            "the migration.",
                            None,
                        )
                    ],
                )
                self.assertEqual(card_commands, [])

    def test_unmarked_notes_refusal_has_no_card_or_recovery_command(self):
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False,
                stdout=(
                    "tlon notes notebook-delete notes/~bot/log --yes\n"
                ),
                stderr=(
                    "Refusing to delete notes/~bot/log: found 1 unmarked note "
                    "without a tlon-migrate provenance footer."
                ),
            )

        async def send_dm(text, blob):
            dms.append((text, blob))
            return False

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
                build_card=build_card,
            )
            await controller.handle(
                "/migrate cleanup notes/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        with self.assertLogs(migration.logger, level="ERROR") as captured:
            asyncio.run(scenario())
        self.assertEqual(
            dms,
            [
                (
                    "Migration cleanup stopped. The notebook "
                    "`notes/~bot/log` contains notes that were added or edited "
                    "since the migration. Inspect it in the Notes app and delete "
                    "it there if that is what you want.",
                    None,
                )
            ],
        )
        self.assertEqual(card_commands, [])
        self.assertNotIn("recovery command:", "\n".join(captured.output))

    def test_unknown_target_appends_inspect_guidance_without_card(self):
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(success=False, error="Connection lost")

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: MigrationControllerTests._append_async(
                    dms, (text, blob)
                ),
                build_card=build_card,
            )
            await controller.handle(
                "/migrate cleanup notes/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        self.assertIn(
            "Inspect the notebook `notes/~bot/log` in the Notes app and delete "
            "it there if that is what you want.",
            dms[0][0],
        )
        self.assertIsNone(dms[0][1])
        self.assertEqual(card_commands, [])

    def test_markerless_known_target_still_offers_retry_card(self):
        dms = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False,
                stderr=(
                    "Delete failed. Recover with tlon notes notebook-delete "
                    "notes/~owner/log --yes"
                ),
            )

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: MigrationControllerTests._append_async(
                    dms, (text, blob)
                ),
                env={
                    "TLON_OWNER_URL": "https://owner.test",
                    "TLON_OWNER_SHIP": "~owner",
                    "TLON_PLANET_CODE": "owner-code",
                },
            )
            await controller.handle(
                "/migrate cleanup notes/~owner/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        command = "/migrate cleanup notes/~owner/log"
        self.assertEqual(
            parse_migrate_card(dms[0][1]),
            (command, "Delete notebook"),
        )


class MigrationDeliveryTests(unittest.TestCase):
    def test_failed_known_target_apply_dm_logs_target_recovery_and_full_message(self):
        dms = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False,
                stdout="Target notebook created: notes/~bot/generated\n",
                error="Import failed",
            )

        async def send_dm(text, blob):
            dms.append((text, blob))
            raise RuntimeError("delivery unavailable")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
            )
            await controller.handle(
                "/migrate diary/~bot/source",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        with self.assertLogs(migration.logger, level="ERROR") as captured:
            asyncio.run(scenario())
        logged = "\n".join(captured.output)
        self.assertIn("target nest: notes/~bot/generated", logged)
        self.assertIn(
            "recovery command: /migrate cleanup notes/~bot/generated",
            logged,
        )
        self.assertIn(f"Undelivered message: {dms[0][0]}", logged)

    def test_false_unknown_cleanup_dm_logs_recovery_and_full_message(self):
        dms = []

        async def run_command(_args, _timeout, _on_deadline):
            return result(success=False, error="Connection lost")

        async def send_dm(text, blob):
            dms.append((text, blob))
            return False

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
            )
            await controller.handle(
                "/migrate cleanup notes/~bot/original",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        with self.assertLogs(migration.logger, level="ERROR") as captured:
            asyncio.run(scenario())
        logged = "\n".join(captured.output)
        self.assertIn("target nest: notes/~bot/original", logged)
        self.assertIn(
            "recovery command: /migrate cleanup notes/~bot/original",
            logged,
        )
        self.assertIn(f"Undelivered message: {dms[0][0]}", logged)


class MigrationFailureTests(unittest.TestCase):
    def test_apply_deadline_reports_without_card_while_command_keeps_running(self):
        deadline_reported = asyncio.Event()
        release = asyncio.Event()
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, on_deadline):
            await on_deadline(
                tlon_api.TlonDeadlineOutput(
                    stdout=(
                        'Creating %notes channel "notes/~bot/decoy"\n'
                        "Target notebook created: notes/~bot/real\n"
                    ),
                    stderr="still importing\n",
                )
            )
            deadline_reported.set()
            await release.wait()
            return result(stdout="Migration complete.\n")

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: MigrationControllerTests._append_async(
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
            await deadline_reported.wait()
            self.assertEqual(
                dms,
                [
                    (
                        "No migration result has arrived yet. The migration may "
                        "still be running. Do not retry it while it is still "
                        "running. The target notebook reported so far is "
                        "`notes/~bot/real`; inspect that notebook in the Notes app "
                        "after the migration finishes.",
                        None,
                    )
                ],
            )
            self.assertEqual(card_commands, [])
            release.set()
            await controller.wait_for_background_tasks()
            self.assertEqual(dms[-1], ("Migration complete.\n", None))

        asyncio.run(scenario())

    def test_cleanup_deadline_reports_without_card_while_command_keeps_running(self):
        deadline_reported = asyncio.Event()
        release = asyncio.Event()
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, on_deadline):
            await on_deadline(
                tlon_api.TlonDeadlineOutput(
                    stdout='Inspecting "notes/~bot/log"\n',
                    stderr="still checking\n",
                )
            )
            deadline_reported.set()
            await release.wait()
            return result(stdout="Notebook deleted.\n")

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: MigrationControllerTests._append_async(
                    dms, (text, blob)
                ),
                build_card=build_card,
            )
            await controller.handle(
                "/migrate cleanup notes/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await deadline_reported.wait()
            self.assertEqual(
                dms,
                [
                    (
                        "No migration result has arrived yet. The migration may "
                        "still be running. Do not retry it while it is still "
                        "running.",
                        None,
                    )
                ],
            )
            self.assertEqual(card_commands, [])
            release.set()
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())

    def test_target_extraction_prefers_anchored_created_line_over_title_decoy(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stdout=(
                    'Creating %notes channel "notes/~zod/decoy"\n'
                    "Target notebook created: notes/~zod/real\n"
                ),
                error="Import failed",
            ),
            "bot-hosted",
        )
        self.assertIn("/migrate cleanup notes/~zod/real", text)
        self.assertNotIn("/migrate cleanup notes/~zod/decoy", text)

    def test_prose_only_notes_nest_is_not_a_known_target(self):
        prose = 'Creating %notes channel "notes/~zod/decoy"'
        migration_result = result(
            success=False,
            stdout=prose,
            error="Import failed",
        )
        dms = []
        card_commands = []

        async def run_command(_args, _timeout, _on_deadline):
            return migration_result

        def build_card(command):
            card_commands.append(command)
            return "unexpected"

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=lambda text, blob: MigrationControllerTests._append_async(
                    dms, (text, blob)
                ),
                build_card=build_card,
            )
            await controller.handle(
                "/migrate diary/~zod/log",
                bot_ship="~zod",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        text = migration.format_migration_failure(
            migration_result, "bot-hosted"
        )
        self.assertIsNone(
            migration._target_nest_from_result(migration_result)
        )
        self.assertNotIn("The target notebook exists", text)
        self.assertIsNone(dms[0][1])
        self.assertEqual(card_commands, [])

    def test_recovery_command_form_still_yields_target(self):
        migration_result = result(
            success=False,
            stderr=(
                "Recover with: tlon notes notebook-delete "
                "notes/~zod/real --yes"
            ),
        )
        self.assertEqual(
            migration._target_nest_from_result(migration_result),
            "notes/~zod/real",
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

    def test_owner_host_uses_cleanup_recovery_for_known_target(self):
        text = migration.format_migration_failure(
            result(
                success=False,
                stdout="Target notebook created: notes/~owner/log\n",
                error="Import failed",
            ),
            "owner-hosted",
        )
        self.assertIn("/migrate cleanup notes/~owner/log", text)
        self.assertNotIn("Delete the notebook", text)


class MigrationTelemetryTests(unittest.TestCase):
    def _run(self, command, run_command, send_dm=None):
        events = []

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm or (lambda _t, _b: asyncio.sleep(0, result=True)),
                emit_event=lambda **fields: events.append(fields),
            )
            await controller.handle(
                command,
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        return events

    def test_apply_emits_started_then_completed_under_one_id(self):
        async def run_command(_args, _timeout, _on_deadline):
            return result(stdout="Migration complete.\n")

        events = self._run("/migrate diary/~bot/log", run_command)
        self.assertEqual(
            [(item["event"], item["action"]) for item in events],
            [("started", "apply"), ("completed", "apply")],
        )
        # `started` predates the outcome, so it carries no terminal fields.
        self.assertEqual(set(events[0]), {"event", "action", "migration_id"})
        self.assertEqual(events[0]["migration_id"], events[1]["migration_id"])
        self.assertIsInstance(events[1]["duration_ms"], int)
        self.assertFalse(events[1]["deadline_exceeded"])
        self.assertNotIn("error_text", events[1])

    def test_widening_refusal_is_consent_required_not_failed(self):
        refusal = (
            "Migration would widen write access. Refusing without explicit "
            "acceptance — pass --allow-write-widening to accept.\n"
        )

        async def run_command(_args, _timeout, _on_deadline):
            return result(success=False, stderr=refusal, error=refusal.strip())

        events = self._run("/migrate diary/~bot/log", run_command)
        self.assertEqual(
            [item["event"] for item in events], ["started", "consent_required"]
        )
        self.assertIsNone(events[1]["error_text"])

    def test_apply_failure_reports_failed_with_cli_error_text(self):
        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False, stderr="Import failed for ~bot\n", error="Import failed"
            )

        events = self._run("/migrate diary/~bot/log", run_command)
        self.assertEqual([item["event"] for item in events], ["started", "failed"])
        self.assertEqual(events[1]["error_text"], "Import failed for ~bot\n")
        self.assertIsInstance(events[1]["duration_ms"], int)

    def test_partial_cleanup_counts_as_completed(self):
        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False,
                stderr=f"{migration.PARTIAL_CLEANUP_MARKER} notes/~bot/log\n",
            )

        events = self._run("/migrate cleanup notes/~bot/log", run_command)
        self.assertEqual(
            [(item["event"], item["action"]) for item in events],
            [("started", "cleanup"), ("completed", "cleanup")],
        )
        self.assertIsNone(events[1]["error_text"])

    def test_deadline_marks_the_terminal_after_the_dm_already_landed(self):
        dms = []

        async def run_command(_args, _timeout, on_deadline):
            await on_deadline(
                tlon_api.TlonDeadlineOutput(stdout="", stderr="still importing\n")
            )
            return result(stdout="Migration complete.\n")

        events = self._run(
            "/migrate diary/~bot/log",
            run_command,
            send_dm=lambda text, _blob: MigrationControllerTests._append_async(
                dms, text
            ),
        )
        # Unlike OpenClaw, the runner awaits the deadline callback inline, so the
        # DM has landed before the terminal is known — nothing to overtake.
        self.assertTrue(events[1]["deadline_exceeded"])
        self.assertIn("No migration result has arrived yet", dms[0])

    def test_refused_commands_emit_nothing(self):
        async def run_command(_args, _timeout, _on_deadline):
            raise AssertionError("refused commands must not run the CLI")

        self.assertEqual(self._run("/migrate", run_command), [])
        self.assertEqual(self._run("/migrate diary/~other/log", run_command), [])

    def test_runner_level_failure_still_carries_error_text(self):
        # Timeout / missing-CLI / runner-exception failures describe
        # themselves only in result.error, with both streams empty.
        async def run_command(_args, _timeout, _on_deadline):
            return result(
                success=False, stdout="", stderr="", error="tlon CLI timed out"
            )

        events = self._run("/migrate diary/~bot/log", run_command)
        self.assertEqual(events[1]["event"], "failed")
        self.assertEqual(events[1]["error_text"], "tlon CLI timed out")

    def test_throwing_emitter_does_not_break_the_migration(self):
        ran = []
        dms = []

        async def run_command(_args, _timeout, _on_deadline):
            ran.append(True)
            return result(stdout="Migration complete.\n")

        def send_dm(text, _blob=None):
            dms.append(text)
            return asyncio.sleep(0, result=True)

        def exploding_emit(**_fields):
            raise RuntimeError("telemetry sink exploded")

        async def scenario():
            controller = migration.MigrationCommandController(
                run_command=run_command,
                send_dm=send_dm,
                emit_event=exploding_emit,
            )
            await controller.handle(
                "/migrate diary/~bot/log",
                bot_ship="~bot",
                owner_ship="~owner",
                send_reply=lambda _text: asyncio.sleep(0),
            )
            await controller.wait_for_background_tasks()

        asyncio.run(scenario())
        # Both the started and terminal emits raised; the CLI still ran and
        # the owner still received the success DM.
        self.assertEqual(ran, [True])
        self.assertTrue(any("Migration complete." in text for text in dms))


if __name__ == "__main__":
    unittest.main()
