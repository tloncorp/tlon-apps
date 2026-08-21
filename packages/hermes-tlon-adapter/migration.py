"""Owner diary migration control flow."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable, Mapping, Optional, Sequence

from .approval import build_migrate_card
from .commands import MIGRATE_USAGE, command_detection_regex
from .owner_listen import canonicalize_nest, canonicalize_notes_nest
from .tlon_api import (
    TlonDeadlineCallback,
    TlonDeadlineOutput,
    TlonSendResult,
    normalize_ship,
)

logger = logging.getLogger(__name__)

MIGRATION_APPLY_TIMEOUT_SECONDS = 30 * 60.0
MIGRATION_CLEANUP_TIMEOUT_SECONDS = 2 * 60.0
MIGRATION_DROP_WARNING = (
    "Before any write: comments, reactions, post references, and link blocks "
    "stay on the archived channel and are not copied. Post descriptions, covers, "
    "and attachments also stay in the archive and are not copied. Group mentions "
    "become plain text. Every migrated note will show the acting ship as its "
    "author, regardless of who wrote the original. Migrated notes are dated at "
    "import time. Note order follows the import, not the original post dates. "
    "The source channel stays intact, remains writable, and is renamed with an "
    "`-ARCHIVE` suffix."
)
CREATE_FAILURE_MARKER = "Notebook creation may or may not have landed."
UNMARKED_NOTES_REFUSAL_MARKER = "without a tlon-migrate provenance footer"
# Deliberately only the shared prefix: the CLI emits two variants that diverge
# after the nest ("still present" vs "could not be checked").
PARTIAL_CLEANUP_MARKER = "Notebook deleted; group cleanup unconfirmed"
# Detection lives in the command registry (commands.py).
_MIGRATE_COMMAND_RE = command_detection_regex("migrate")
_TARGET_CREATED_RE = re.compile(
    r"^Target notebook created: "
    r"(notes/~[a-z-]+/[a-zA-Z0-9-]+)[ \t]*\r?$",
    re.MULTILINE,
)
_TARGET_RECOVERY_RE = re.compile(
    r"\btlon notes notebook-delete "
    r"(notes/~[a-z-]+/[a-zA-Z0-9-]+) --yes\b"
)


@dataclass(frozen=True)
class ParsedMigrationCommand:
    kind: str
    nest: str
    allow_write_widening: bool = False


@dataclass(frozen=True)
class CredentialSelection:
    kind: str
    prefix_args: tuple[str, ...] = ()
    error: str = ""


RunMigrationCommand = Callable[
    [Sequence[str], float, TlonDeadlineCallback],
    Awaitable[TlonSendResult],
]
SendReply = Callable[[str], Awaitable[None]]
SendMigrationDm = Callable[[str, Optional[str]], Awaitable[bool]]
BuildMigrationCard = Callable[[str], str]
# Keyword-only telemetry sink (TlonTelemetry.migration_event); optional so the
# controller stays usable without a telemetry client.
EmitMigrationEvent = Callable[..., None]


def is_migrate_command(text: str) -> bool:
    return bool(_MIGRATE_COMMAND_RE.match(str(text or "").strip()))


def _canonical_migration_nest(raw: str, prefix: str) -> Optional[str]:
    if prefix == "diary":
        canonical = canonicalize_nest(raw)
        return canonical if canonical and canonical.startswith("diary/") else None
    return canonicalize_notes_nest(raw)


def parse_migrate_command(text: str) -> ParsedMigrationCommand | str:
    args = _MIGRATE_COMMAND_RE.sub(
        "", str(text or "").strip(), count=1
    ).split()
    if not args:
        return MIGRATE_USAGE
    action = args[0].lower()
    if action == "cleanup":
        nest = _canonical_migration_nest(args[1] if len(args) > 1 else "", "notes")
        if len(args) != 2 or nest is None:
            return MIGRATE_USAGE
        return ParsedMigrationCommand("cleanup", nest)

    nest = _canonical_migration_nest(
        args[0] if args else "", "diary"
    )
    rest = args[1:]
    if rest not in ([], ["--allow-write-widening"]) or nest is None:
        return MIGRATE_USAGE
    return ParsedMigrationCommand(
        "migrate", nest, allow_write_widening=bool(rest)
    )


def select_migration_credentials(
    nest: str,
    *,
    bot_ship: str,
    owner_ship: str,
    env: Mapping[str, str] | None = None,
) -> CredentialSelection:
    host = normalize_ship(nest.split("/")[1] if "/" in nest else "")
    bot = normalize_ship(bot_ship)
    owner = normalize_ship(owner_ship)
    if host and host == bot:
        return CredentialSelection("bot-hosted")
    if host and host == owner:
        source = os.environ if env is None else env
        url = str(source.get("TLON_OWNER_URL") or "").strip()
        env_owner = normalize_ship(str(source.get("TLON_OWNER_SHIP") or ""))
        code = str(source.get("TLON_PLANET_CODE") or "").strip()
        if not url or env_owner != owner or not code:
            return CredentialSelection(
                "owner-hosted",
                error=(
                    f"Migration for host {host} requires hosted owner credentials "
                    "TLON_OWNER_URL, TLON_OWNER_SHIP, and TLON_PLANET_CODE. "
                    "This Hermes instance cannot migrate that owner-hosted diary."
                ),
            )
        return CredentialSelection(
            "owner-hosted",
            ("--url", url, "--ship", env_owner, "--code", code),
        )
    return CredentialSelection(
        "unsupported",
        error=(
            f"Migration cannot run for host {host or '(unknown)'}. "
            "It must run from the ship that hosts the diary."
        ),
    )


def _strip_cli_recovery(text: str) -> str:
    for marker in (
        "\nThe target notebook exists.",
        f"\n{CREATE_FAILURE_MARKER}",
    ):
        index = text.find(marker)
        if index >= 0:
            return text[:index].rstrip()
    return text.rstrip()


def _result_corpus(result: TlonSendResult) -> str:
    return (
        f"{result.stdout}\n{result.stderr}\n"
        f"{str(result.error or '')}"
    )


def _target_nest_from_text(text: str) -> Optional[str]:
    created = _TARGET_CREATED_RE.search(text)
    if created:
        return created.group(1)
    recovery = _TARGET_RECOVERY_RE.search(text)
    return recovery.group(1) if recovery else None


def _target_nest_from_result(result: TlonSendResult) -> Optional[str]:
    return _target_nest_from_text(_result_corpus(result))


def _is_write_widening_refusal(result: TlonSendResult) -> bool:
    return "--allow-write-widening" in _result_corpus(result)


def _is_unmarked_notes_refusal(result: TlonSendResult) -> bool:
    return UNMARKED_NOTES_REFUSAL_MARKER in _result_corpus(result)


def _is_partial_cleanup(result: TlonSendResult) -> bool:
    return PARTIAL_CLEANUP_MARKER in _result_corpus(result)


def _failure_error_text(result: TlonSendResult) -> str:
    """Timeout, missing-CLI, and runner-exception failures describe themselves
    only in ``result.error`` with both streams empty — fall back so those
    operational failures still carry error text."""
    return (
        result.stderr or result.stdout or str(result.error or "") or "Migration failed"
    )


def format_migration_failure(
    result: TlonSendResult, credential_kind: str
) -> str:
    error_text = result.stderr or str(result.error or "Migration failed")
    combined = _result_corpus(result)
    target = _target_nest_from_result(result)
    base = _strip_cli_recovery(error_text)
    captured = (
        f"Captured migration output:\n{result.stdout.rstrip()}\n\n"
        if result.stdout
        else ""
    )
    if target:
        recovery = (
            f"Reply `/migrate cleanup {target}`, then run `/migrate` again."
        )
        return (
            f"{captured}{base}\n\n"
            f"The target notebook exists. {recovery}"
        )
    if CREATE_FAILURE_MARKER in combined:
        if credential_kind == "bot-hosted":
            recovery = (
                f"{CREATE_FAILURE_MARKER} Look for a notebook with the requested "
                "title in the bot ship’s Notes web UI and remove it before retrying."
            )
        else:
            recovery = (
                f"{CREATE_FAILURE_MARKER} Look for a notebook with the requested "
                "title in your Notes app and remove it before retrying."
            )
        return f"{captured}{base}\n\n{recovery}".strip()
    if not result.stdout:
        return error_text
    return f"{captured}{base}".strip()


class MigrationCommandController:
    def __init__(
        self,
        *,
        run_command: RunMigrationCommand,
        send_dm: SendMigrationDm,
        env: Mapping[str, str] | None = None,
        build_card: BuildMigrationCard = build_migrate_card,
        emit_event: Optional[EmitMigrationEvent] = None,
    ) -> None:
        self._run_command = run_command
        self._send_dm = send_dm
        self._env = env
        self._build_card = build_card
        self._emit_event = emit_event
        self._tasks: set[asyncio.Task[None]] = set()
        # These guards are instance state, and two things bound how far that
        # is safe.
        #
        # Across a restart: the only reachable teardown of a connected adapter
        # on hermes-agent v2026.6.19 is whole-process exit, and both entrypoints
        # run the gateway as PID 1, so container teardown reaps the CLI child
        # alongside it. That is a property of the deployment, not of process
        # exit — nothing here cancels the task or kills the child, so a gateway
        # killed without process-group teardown can leave the CLI applying
        # while a fresh controller starts with empty guards. An SSE drop
        # reconnects inside the same adapter instance, leaving this controller
        # intact; core's in-process replacement path fires only from
        # _notify_fatal_error, which the Tlon adapter never calls.
        #
        # Across adapters: these guards are per-instance, so two adapters in
        # one process configured for the same ship would not see each other.
        # The package already assumes one Tlon account per gateway process
        # (see README) — the discovery sender is a last-writer-wins module
        # global and breaks under the same misconfiguration. OpenClaw enforces
        # this with a gate; here it is not enforced, because the hosted
        # deployment configures one owner per Hermes instance. Do not add a
        # gate without first checking that assumption still holds — the guards
        # would have to become process-global, which means teardown in every
        # test that builds a controller.
        #
        # Revisit if either of those changes: a retryable _notify_fatal_error
        # from this adapter, or core gaining in-process adapter replacement,
        # would let a fresh controller with empty guards accept a /migrate for
        # a nest an orphaned task is still migrating.
        self._apply_in_flight: dict[str, object] = {}
        self._cleanup_in_flight: dict[str, object] = {}

    def _emit(self, **fields: object) -> None:
        try:
            if self._emit_event is not None:
                self._emit_event(**fields)
        except Exception:  # telemetry must never fail a migration
            logger.debug("[tlon] migration telemetry failed", exc_info=True)

    def _spawn(self, coro: Awaitable[None]) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._task_done)

    def _task_done(self, task: asyncio.Task[None]) -> None:
        self._tasks.discard(task)
        if task.cancelled():
            return
        error = task.exception()
        if error is not None:
            logger.exception(
                "[tlon] migration background task failed",
                exc_info=error,
            )

    async def wait_for_background_tasks(self) -> None:
        if self._tasks:
            await asyncio.gather(*tuple(self._tasks))

    async def _send_notification_dm(
        self,
        text: str,
        nest: str,
        recovery_command: Optional[str] = None,
        blob: Optional[str] = None,
    ) -> bool:
        try:
            sent = await self._send_dm(text, blob)
        except Exception as error:
            target = _target_nest_from_text(text) or nest
            recovery = (
                f"; recovery command: {recovery_command}"
                if recovery_command
                else ""
            )
            logger.error(
                "[tlon] failed to send owner migration notification "
                "(target nest: %s)%s: %s. Undelivered message: %s",
                target,
                recovery,
                error,
                text,
            )
            return False
        if sent:
            return True
        target = _target_nest_from_text(text) or nest
        recovery = (
            f"; recovery command: {recovery_command}"
            if recovery_command
            else ""
        )
        logger.error(
            "[tlon] failed to send owner migration notification "
            "(target nest: %s)%s. Undelivered message: %s",
            target,
            recovery,
            text,
        )
        return False

    async def _send_action_dm(
        self,
        text: str,
        nest: str,
        command: Optional[str] = None,
        recovery_command: Optional[str] = None,
    ) -> None:
        recovery = recovery_command or command
        if command is None:
            await self._send_notification_dm(text, nest, recovery)
            return
        try:
            blob = self._build_card(command)
        except Exception:
            logger.exception("[tlon] failed to build migration A2UI card")
            await self._send_notification_dm(text, nest, recovery)
            return
        await self._send_notification_dm(text, nest, recovery, blob)

    async def _report_deadline(
        self, nest: str, output: TlonDeadlineOutput
    ) -> None:
        target = _target_nest_from_text(
            f"{output.stdout}\n{output.stderr}"
        )
        target_detail = (
            f" The target notebook reported so far is `{target}`; inspect that "
            "notebook in the Notes app after the migration finishes."
            if target
            else ""
        )
        text = (
            "No migration result has arrived yet. The migration may still be "
            "running. Do not retry it while it is still running."
            f"{target_detail}"
        )
        await self._send_notification_dm(text, nest)

    async def handle(
        self,
        command_text: str,
        *,
        bot_ship: str,
        owner_ship: str,
        send_reply: SendReply,
    ) -> None:
        parsed = parse_migrate_command(command_text)
        if isinstance(parsed, str):
            await send_reply(parsed)
            return
        selection = select_migration_credentials(
            parsed.nest,
            bot_ship=bot_ship,
            owner_ship=owner_ship,
            env=self._env,
        )
        if selection.error:
            await send_reply(selection.error)
            return

        if parsed.kind == "migrate":
            # This deliberately blocks unrelated applies behind any cleanup. The
            # cleanup's two-minute deadline is advisory: its on_deadline callback
            # reports without killing the process, so a stuck cleanup blocks every
            # apply until the gateway restarts. That tradeoff is accepted for the
            # one-owner, one-notebook deployment.
            if self._cleanup_in_flight:
                await send_reply(
                    "A migration cleanup is currently running. Wait for it to "
                    "finish, then retry the migration."
                )
                return
            key = parsed.nest
            if key in self._apply_in_flight:
                await send_reply(
                    f"A migration for {parsed.nest} is already running."
                )
                return
            token = object()
            # Minted before the in-flight entry so a throw cannot strand the guard.
            migration_id = str(uuid.uuid4())
            self._apply_in_flight[key] = token
            self._spawn(
                self._run_apply(parsed, selection, key, token, migration_id)
            )
            await send_reply(
                f"Migration started for {parsed.nest}. I’ll DM the result.\n\n"
                f"{MIGRATION_DROP_WARNING}"
            )
            return

        if self._apply_in_flight:
            await send_reply(
                "A migration is currently running. Wait for it to finish, then "
                "retry the cleanup."
            )
            return
        key = parsed.nest
        if key in self._cleanup_in_flight:
            await send_reply(
                f"A migration cleanup for {parsed.nest} is already running."
            )
            return
        token = object()
        migration_id = str(uuid.uuid4())
        self._cleanup_in_flight[key] = token
        self._spawn(
            self._run_cleanup(parsed, selection, key, token, migration_id)
        )
        await send_reply(
            f"Cleanup started for {parsed.nest}. I’ll DM the result."
        )

    async def _run_apply(
        self,
        parsed: ParsedMigrationCommand,
        selection: CredentialSelection,
        key: str,
        token: object,
        migration_id: str,
    ) -> None:
        try:
            args = [
                *selection.prefix_args,
                "notes",
                "migrate-apply",
                parsed.nest,
                "--yes",
                *(
                    ["--allow-write-widening"]
                    if parsed.allow_write_widening
                    else []
                ),
            ]
            deadline_fired = False

            async def on_deadline(output: TlonDeadlineOutput) -> None:
                nonlocal deadline_fired
                deadline_fired = True
                await self._report_deadline(parsed.nest, output)

            self._emit(
                event="started", action="apply", migration_id=migration_id
            )
            started = time.monotonic()
            result = await self._run_command(
                args,
                MIGRATION_APPLY_TIMEOUT_SECONDS,
                on_deadline,
            )
            duration_ms = int((time.monotonic() - started) * 1000)
            if result.success:
                self._emit(
                    event="completed",
                    action="apply",
                    migration_id=migration_id,
                    duration_ms=duration_ms,
                    deadline_exceeded=deadline_fired,
                )
                await self._send_notification_dm(result.stdout, parsed.nest)
                return

            text = format_migration_failure(result, selection.kind)
            target = _target_nest_from_result(result)
            command = f"/migrate cleanup {target}" if target else None
            widening_offer = (
                command is None
                and target is None
                and not parsed.allow_write_widening
                and _is_write_widening_refusal(result)
            )
            if widening_offer:
                command = (
                    f"/migrate {parsed.nest} --allow-write-widening"
                )
                text += (
                    f"\n\nReply `{command}` to accept that every reader "
                    "will become an editor and proceed."
                )
            # A consent refusal is terminal but not a failure: the owner is
            # expected to accept and re-run, so counting it as failed would
            # halve the success rate of a correctly working flow.
            self._emit(
                event="consent_required" if widening_offer else "failed",
                action="apply",
                migration_id=migration_id,
                duration_ms=duration_ms,
                deadline_exceeded=deadline_fired,
                error_text=(
                    None if widening_offer else _failure_error_text(result)
                ),
            )
            await self._send_action_dm(
                text, parsed.nest, command, command
            )
        finally:
            if self._apply_in_flight.get(key) is token:
                del self._apply_in_flight[key]

    async def _run_cleanup(
        self,
        parsed: ParsedMigrationCommand,
        selection: CredentialSelection,
        key: str,
        token: object,
        migration_id: str,
    ) -> None:
        try:
            deadline_fired = False

            async def on_deadline(output: TlonDeadlineOutput) -> None:
                nonlocal deadline_fired
                deadline_fired = True
                await self._report_deadline(parsed.nest, output)

            self._emit(
                event="started", action="cleanup", migration_id=migration_id
            )
            started = time.monotonic()
            result = await self._run_command(
                (
                    *selection.prefix_args,
                    "notes",
                    "notebook-delete",
                    parsed.nest,
                    "--yes",
                ),
                MIGRATION_CLEANUP_TIMEOUT_SECONDS,
                on_deadline,
            )
            duration_ms = int((time.monotonic() - started) * 1000)
            if result.success:
                self._emit(
                    event="completed",
                    action="cleanup",
                    migration_id=migration_id,
                    duration_ms=duration_ms,
                    deadline_exceeded=deadline_fired,
                )
                await self._send_notification_dm(result.stdout, parsed.nest)
                return

            # A partial cleanup deleted the notebook (only the group-listing
            # check was unconfirmed), so it counts as completed.
            partial = _is_partial_cleanup(result)
            self._emit(
                event="completed" if partial else "failed",
                action="cleanup",
                migration_id=migration_id,
                duration_ms=duration_ms,
                deadline_exceeded=deadline_fired,
                error_text=(
                    None if partial else _failure_error_text(result)
                ),
            )
            if partial:
                text = (
                    f"The notebook `{parsed.nest}` was deleted successfully. "
                    "The channel may still show in your group for a moment. "
                    "Wait a few seconds, then retry the migration."
                )
                await self._send_notification_dm(text, parsed.nest)
                return

            target = _target_nest_from_result(result)
            unmarked_refusal = _is_unmarked_notes_refusal(result)
            if unmarked_refusal:
                text = (
                    "Migration cleanup stopped. The notebook "
                    f"`{target or parsed.nest}` contains notes that were added "
                    "or edited since the migration. Inspect it in the Notes app "
                    "and delete it there if that is what you want."
                )
            else:
                text = (
                    "Migration cleanup failed.\n\n"
                    + format_migration_failure(result, selection.kind)
                )
                if target is None:
                    text += (
                        f"\n\nInspect the notebook `{parsed.nest}` in the Notes "
                        "app and delete it there if that is what you want."
                    )
            command = (
                f"/migrate cleanup {target}"
                if target and not unmarked_refusal
                else None
            )
            recovery_command = (
                None
                if unmarked_refusal
                else f"/migrate cleanup {parsed.nest}"
            )
            await self._send_action_dm(
                text,
                parsed.nest,
                command,
                recovery_command,
            )
        finally:
            if self._cleanup_in_flight.get(key) is token:
                del self._cleanup_in_flight[key]
