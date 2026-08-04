"""Owner diary migration control flow."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from dataclasses import dataclass
from typing import Awaitable, Callable, Mapping, Optional, Sequence

from .approval import build_migrate_card
from .owner_listen import canonicalize_nest
from .tlon_api import TlonSendResult, normalize_ship

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
MIGRATE_USAGE = (
    "Usage: /migrate <diary-nest> [--allow-write-widening] | "
    "/migrate cleanup <notes-nest>"
)
CREATE_FAILURE_MARKER = "Notebook creation may or may not have landed."
_MIGRATE_COMMAND_RE = re.compile(r"^/migrate(?:\s|$)", re.IGNORECASE)
_TARGET_NEST_RE = re.compile(r"\bnotes/~[a-z-]+/[a-zA-Z0-9-]+\b")


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
    [Sequence[str], float], Awaitable[TlonSendResult]
]
SendReply = Callable[[str], Awaitable[None]]
SendMigrationDm = Callable[[str, Optional[str]], Awaitable[None]]
BuildMigrationCard = Callable[[str], str]


def is_migrate_command(text: str) -> bool:
    return bool(_MIGRATE_COMMAND_RE.match(str(text or "").strip()))


def _canonical_migration_nest(raw: str, prefix: str) -> Optional[str]:
    if prefix == "diary":
        canonical = canonicalize_nest(raw)
        return canonical if canonical and canonical.startswith("diary/") else None
    parts = str(raw or "").strip().split("/")
    if (
        len(parts) != 3
        or parts[0].lower() != "notes"
        or not parts[1]
        or not parts[2]
        or any(char.isspace() for char in parts[2])
    ):
        return None
    return f"notes/{normalize_ship(parts[1]).lower()}/{parts[2]}"


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


def _target_nest_from_result(result: TlonSendResult) -> Optional[str]:
    combined = (
        f"{result.stdout}\n{result.stderr}\n"
        f"{str(result.error or '')}"
    )
    match = _TARGET_NEST_RE.search(combined)
    return match.group(0) if match else None


def _is_write_widening_refusal(result: TlonSendResult) -> bool:
    combined = (
        f"{result.stdout}\n{result.stderr}\n"
        f"{str(result.error or '')}"
    )
    return "--allow-write-widening" in combined


def format_migration_failure(
    result: TlonSendResult, credential_kind: str
) -> str:
    error_text = result.stderr or str(result.error or "Migration failed")
    combined = f"{result.stdout}\n{error_text}"
    target_match = _TARGET_NEST_RE.search(combined)
    base = _strip_cli_recovery(error_text)
    captured = (
        f"Captured migration output:\n{result.stdout.rstrip()}\n\n"
        if result.stdout
        else ""
    )
    timeout = "Migration timed out.\n\n" if result.timed_out else ""

    if target_match:
        target = target_match.group(0)
        if credential_kind == "bot-hosted":
            recovery = (
                f"Reply `/migrate cleanup {target}`, then run `/migrate` again."
            )
        else:
            recovery = (
                f"Delete the notebook `{target}` in the Notes app and run "
                "`/migrate` again."
            )
        return (
            f"{timeout}{captured}{base}\n\n"
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
        return f"{timeout}{captured}{base}\n\n{recovery}".strip()
    if not result.timed_out and not result.stdout:
        return error_text
    return f"{timeout}{captured}{base}".strip()


class MigrationCommandController:
    def __init__(
        self,
        *,
        run_command: RunMigrationCommand,
        send_dm: SendMigrationDm,
        env: Mapping[str, str] | None = None,
        build_card: BuildMigrationCard = build_migrate_card,
    ) -> None:
        self._run_command = run_command
        self._send_dm = send_dm
        self._env = env
        self._build_card = build_card
        self._tasks: set[asyncio.Task[None]] = set()

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

    async def _send_action_dm(
        self, text: str, command: Optional[str] = None
    ) -> None:
        if command is None:
            await self._send_dm(text, None)
            return
        try:
            blob = self._build_card(command)
        except Exception:
            logger.exception("[tlon] failed to build migration A2UI card")
            blob = None
        await self._send_dm(text, blob)

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
            await send_reply(
                f"Migration started for {parsed.nest}. I’ll DM the result.\n\n"
                f"{MIGRATION_DROP_WARNING}"
            )
            self._spawn(self._run_apply(parsed, selection))
            return

        await send_reply(
            f"Cleanup started for {parsed.nest}. I’ll DM the result."
        )
        self._spawn(self._run_cleanup(parsed, selection))

    async def _run_apply(
        self,
        parsed: ParsedMigrationCommand,
        selection: CredentialSelection,
    ) -> None:
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
        result = await self._run_command(args, MIGRATION_APPLY_TIMEOUT_SECONDS)
        if result.success:
            await self._send_dm(result.stdout, None)
            return

        text = format_migration_failure(result, selection.kind)
        target = _target_nest_from_result(result)
        command = (
            f"/migrate cleanup {target}"
            if selection.kind == "bot-hosted" and target
            else None
        )
        if (
            command is None
            and target is None
            and not parsed.allow_write_widening
            and _is_write_widening_refusal(result)
        ):
            command = (
                f"/migrate {parsed.nest} --allow-write-widening"
            )
            text += (
                f"\n\nReply `{command}` to accept that every reader "
                "will become an editor and proceed."
            )
        await self._send_action_dm(text, command)

    async def _run_cleanup(
        self,
        parsed: ParsedMigrationCommand,
        selection: CredentialSelection,
    ) -> None:
        result = await self._run_command(
            (
                *selection.prefix_args,
                "notes",
                "notebook-delete",
                parsed.nest,
                "--yes",
            ),
            MIGRATION_CLEANUP_TIMEOUT_SECONDS,
        )
        if result.success:
            await self._send_dm(result.stdout, None)
            return

        text = (
            "Migration cleanup failed.\n\n"
            + format_migration_failure(result, selection.kind)
        )
        target = _target_nest_from_result(result)
        await self._send_action_dm(
            text,
            f"/migrate cleanup {target}"
            if selection.kind == "bot-hosted" and target
            else None,
        )
