"""Hermes model tool wrapper for the packaged ``tlon`` CLI."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shlex
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable, Collection, Mapping, Optional, Sequence

from .approval import build_migrate_card
from .owner_listen import canonicalize_nest, canonicalize_notes_nest
from .tlon_api import (
    CREDENTIAL_FLAGS_WITH_VALUE,
    SEND_OPERATIONS,
    CommandRunner,
    TlonCLI,
    TlonConfig,
    TlonSendResult,
    find_subcommand_index,
    normalize_ship,
)

logger = logging.getLogger(__name__)

ALLOWED_TLON_COMMANDS = frozenset(
    {
        "activity",
        "channels",
        "contacts",
        "dms",
        "expose",
        "groups",
        "hooks",
        "messages",
        "notebook",
        "notes",
        "posts",
        "settings",
        "upload",
        "help",
        "version",
    }
)

SendOwnerNotification = Callable[[str, Optional[str]], Awaitable[object]]
DiaryTitleLookup = Callable[[str], Awaitable[Optional[str]]]
BuildMigrationCard = Callable[..., str]


@dataclass(frozen=True)
class _DiaryMigrationNotificationRegistration:
    sender: SendOwnerNotification
    bot_ship: str
    owner_ship: str
    title_lookup: DiaryTitleLookup


_diary_notification_registration: Optional[
    _DiaryMigrationNotificationRegistration
] = None
_notified_diary_nests: set[str] = set()
_diary_notifications_in_flight: dict[str, asyncio.Task[bool]] = {}
_pending_discovery_tasks: set[asyncio.Task[bool]] = set()
ARCHIVE_TITLE_SUFFIX = "-ARCHIVE"

HELP_ARGS = frozenset({"--help", "-h"})
POST_REPLY_OPTION_FLAGS = ("author", "blob", "sent-at")
POST_SEND_OPTION_FLAGS = ("blob", "image", "title", "sent-at")
MESSAGES_COMMANDS = frozenset(
    {"dm", "channel", "history", "search", "context", "post"}
)
POSTS_COMMANDS = frozenset(
    {"send", "reply", "react", "unreact", "edit", "delete"}
)
EXPOSE_TARGET_COMMANDS = frozenset({"show", "hide", "check", "url"})

TLON_TOOL_DESCRIPTION = (
    "Tlon/Urbit CLI for reading data and administration: activity, channels, "
    "contacts, groups, messages, notes, posts, settings, upload, expose, hooks. "
    "Use the notes commands to manage %notes notebooks (Markdown notes at "
    "notes/~host/name nests). For notes bodies, use --body <file> "
    "(note-create also accepts --markdown <file>); --stdin is blocked because "
    "Hermes cannot pipe stdin into the CLI process. "
    "%diary channels are deprecated and unsupported by this tool. Ask the "
    "owner to type `/migrate <diary-nest>` to move one to %notes. Hermes "
    "delivery uses `tlon posts send`, which refuses diary/ targets. "
    "The bot node has its own Tlon profile; when the configured owner asks "
    "to change the bot nickname, avatar, bio, status, or cover image, use "
    "contacts update-profile. For avatars/covers, upload a direct raster "
    "image URL or local image first with tlon upload, then set the returned "
    "uploaded URL. Use image_search when available to find image URLs for "
    "user-requested avatars/covers. Do not use SVG profile images. "
    "For exact syntax, load skill_view(\"tlon-platform:tlon\") or run "
    "'<subcommand> --help'. "
    "For user-requested group creation, use groups create-owned with "
    "--owner set to the requesting ship. "
    "To reply to the CURRENT conversation, just write the reply — do not use "
    "posts/dms send here (that path is blocked so Hermes delivers replies, except "
    "posts send heap/~host/name creates a new gallery item). "
    "To post to a DIFFERENT channel or one-to-one DM (a proactive send), use "
    "posts send with that target, e.g. posts send chat/~host/channel \"...\" "
    "or posts send ~ship \"...\". Reserve dms send for group-DM club IDs "
    "starting with 0v. "
    "Gallery channels are heap/~host/name image/link boards. In a gallery, "
    "replying normally comments on the triggering post; posts send "
    "heap/~host/name \"text or URL\" creates a new top-level item and is "
    "allowed even in the current gallery (optional --title \"...\"). Upload "
    "before image items, then posts send heap/~host/name [caption] --image "
    "<uploaded-url>. React to a gallery comment with posts react "
    "heap/~host/name <comment-id> <emoji> --parent <post-id>; delete gallery "
    "posts with posts delete heap/~host/name <post-id>. "
    "To send an IMAGE anywhere (including the current conversation): first "
    "'upload <direct-image-url>', then 'posts send <target> [caption] --image "
    "<uploaded-url>' (group DMs: dms send <club-id> ... --image <url>)."
)

TLON_TOOL_SCHEMA = {
    "name": "tlon",
    "description": TLON_TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": (
                    "The tlon command and arguments. Examples: "
                    "'activity mentions --limit 10', 'contacts self', "
                    "'contacts get ~sampel-palnet', 'groups list', "
                    "'groups create-owned \"Projects\" --owner ~sampel-palnet', "
                    "'upload https://example.com/avatar.png', "
                    "'contacts update-profile --avatar \"https://storage...\"', "
                    "'messages dm ~ship --limit 20', 'contacts --help'. "
                    "For broader command guidance, load skill_view(\"tlon-platform:tlon\"). "
                    "For avatar/cover updates, do not set the source image URL "
                    "directly; use image_search when available, upload the "
                    "chosen image_url, and use the URL returned by tlon upload. "
                    "In Tlon chat sessions, 'groups create' is blocked; use "
                    "'groups create-owned' so the requester is invited and made admin. "
                    "To post to a different channel or one-to-one DM, use "
                    "'posts send <channel> \"...\"' or 'posts send ~ship \"...\"'. "
                    "Galleries use heap/~host/name: reply normally to comment on "
                    "the triggering gallery post, or use 'posts send "
                    "heap/~host/name \"...\" [--title \"...\"]' for a new item. "
                    "React to a gallery comment with 'posts react heap/~host/name "
                    "<comment-id> <emoji> --parent <post-id>'; delete with "
                    "'posts delete heap/~host/name <post-id>'. "
                    "Use 'dms send <club-id> \"...\"' only for group-DM club IDs "
                    "starting with 0v. Sending to "
                    "the CURRENT conversation is blocked (reply normally "
                    "instead) EXCEPT new gallery items and image sends: 'posts send <target> "
                    "[caption] --image <uploaded-url>' is allowed anywhere — "
                    "upload first with 'upload <direct-image-url>'. 'notebook' "
                    "uses deprecated %diary behavior unsupported by this tool; "
                    "use 'notes' for %notes, or ask the owner to type "
                    "`/migrate <diary-nest>`. Hermes cannot send to diary/ "
                    "targets because its delivery path uses `tlon posts send`. "
                    "For notes bodies, use --body <file>; note-create also "
                    "accepts --markdown <file>. Do not use --stdin."
                ),
            }
        },
        "required": ["command"],
    },
}


def _json(data: Mapping[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def split_tlon_command(command: str) -> tuple[list[str], Optional[str]]:
    try:
        args = shlex.split(command or "")
    except ValueError as exc:
        return [], str(exc)
    return args, None


def normalize_global_command_args(args: Sequence[str]) -> list[str]:
    lowered = [str(arg).lower() for arg in args]
    if lowered in (["help"], ["--help"], ["-h"]):
        return ["--help"]
    if lowered in (["version"], ["--version"], ["-v"]):
        return ["--version"]
    return [str(arg) for arg in args]


def _get_session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def _normalize_session_ship(ship: str) -> str:
    normalized = ship.strip()
    if normalized and not normalized.startswith("~"):
        normalized = f"~{normalized}"
    return normalized


def _canonical_diary_nest(raw: str | None) -> Optional[str]:
    canonical = canonicalize_nest(str(raw or ""))
    return canonical if canonical and canonical.startswith("diary/") else None


_canonical_notes_nest = canonicalize_notes_nest

MIGRATION_BOOLEAN_FLAGS = frozenset(
    {"--allow-write-widening", "--force", "--yes"}
)


def find_first_positional_argument_index(
    args: Sequence[str],
    from_index: int,
    flags_with_values: Collection[str],
    boolean_flags: Collection[str] = frozenset(),
) -> int:
    index = from_index
    while index < len(args):
        arg = str(args[index])
        equals_index = arg.find("=")
        flag = arg[:equals_index] if equals_index >= 0 else arg
        if flag in flags_with_values:
            index += 1 if equals_index >= 0 else 2
            continue
        if flag in boolean_flags:
            index += 1
            continue
        return index
    return -1


def _migration_source_operand(args: Sequence[str]) -> Optional[str]:
    index = find_first_positional_argument_index(
        args,
        2,
        frozenset(),
        MIGRATION_BOOLEAN_FLAGS,
    )
    return args[index] if index >= 0 else None


def _diary_nest_from_cite_path(raw: str | None) -> Optional[str]:
    parts = str(raw or "").strip().split("/")
    if (
        len(parts) >= 6
        and parts[0] == ""
        and parts[1] == "1"
        and parts[2] == "chan"
    ):
        return _canonical_diary_nest("/".join(parts[3:6]))
    return _canonical_diary_nest("/".join(parts[:3]))


def _is_help_arg(arg: object) -> bool:
    return str(arg) in HELP_ARGS


def _wants_help(args: Sequence[str]) -> bool:
    return any(_is_help_arg(arg) for arg in args)


def _first_flag_index(
    args: Sequence[str], flags: Sequence[str]
) -> int:
    indexes = [
        list(args).index(f"--{flag}")
        for flag in flags
        if f"--{flag}" in args
    ]
    return min(indexes) if indexes else len(args)


def _first_post_send_flag_index(args: Sequence[str]) -> int:
    indexes: list[int] = []
    for flag in POST_SEND_OPTION_FLAGS:
        if flag == "image":
            index = next(
                (
                    index
                    for index, arg in enumerate(args)
                    if str(arg) == "--image"
                    or str(arg).startswith("--image=")
                ),
                -1,
            )
        else:
            try:
                index = list(args).index(f"--{flag}")
            except ValueError:
                index = -1
        if index != -1:
            indexes.append(index)
    return min(indexes) if indexes else len(args)


def _messages_help_takes_precedence(args: Sequence[str]) -> bool:
    cli_args = [str(arg) for arg in args[1:]]
    if cli_args and _is_help_arg(cli_args[0]):
        return True
    if not _wants_help(cli_args[1:]):
        return False

    try:
        channel_index = cli_args.index("--channel", 2)
    except ValueError:
        channel_index = -1
    search_channel = (
        channel_index >= 0
        and len(cli_args) > channel_index + 1
        and not cli_args[channel_index + 1].startswith("--")
    )
    search_query_help_literal = (
        bool(cli_args)
        and cli_args[0] == "search"
        and len(cli_args) > 1
        and _is_help_arg(cli_args[1])
        and search_channel
    )
    return not search_query_help_literal


def _expose_help_takes_precedence(args: Sequence[str]) -> bool:
    cli_args = [str(arg) for arg in args[1:]]
    return bool(cli_args) and (
        _is_help_arg(cli_args[0]) or _wants_help(cli_args[1:])
    )


def _posts_help_takes_precedence(args: Sequence[str]) -> bool:
    cli_args = [str(arg) for arg in args[1:]]
    if cli_args and _is_help_arg(cli_args[0]):
        return True
    if not _wants_help(cli_args[1:]):
        return False

    edit_message_help_literal = (
        len(cli_args) > 2
        and cli_args[0] == "edit"
        and bool(cli_args[1])
        and bool(cli_args[2])
        and _wants_help(cli_args[3:])
    )
    send_message_help_literal = (
        len(cli_args) > 1
        and cli_args[0] == "send"
        and bool(cli_args[1])
        and _wants_help(
            cli_args[2 : _first_post_send_flag_index(cli_args)]
        )
    )
    reply_message_help_literal = (
        len(cli_args) > 2
        and cli_args[0] == "reply"
        and bool(cli_args[1])
        and bool(cli_args[2])
        and _wants_help(
            cli_args[
                3 : _first_flag_index(
                    cli_args, POST_REPLY_OPTION_FLAGS
                )
            ]
        )
    )
    return not (
        edit_message_help_literal
        or send_message_help_literal
        or reply_message_help_literal
    )


def _diary_nest_for_removed_cli_operation(
    args: Sequence[str],
) -> Optional[str]:
    subcommand = str(args[0]).lower() if args else ""
    # The packaged CLI validates case-sensitive command maps before it checks
    # for a removed diary target.
    action = str(args[1]) if len(args) > 1 else ""

    if subcommand == "channels":
        if action in {"info", "delete", "update"}:
            return _canonical_diary_nest(
                str(args[2]) if len(args) > 2 else None
            )
        if action == "rename":
            return (
                _canonical_diary_nest(str(args[2]))
                if len(args) > 3 and args[3]
                else None
            )
        if action in {"add-writers", "del-writers"}:
            return (
                _canonical_diary_nest(str(args[2]))
                if len(args[3:]) > 0
                else None
            )
        if action in {"add-readers", "del-readers"}:
            return (
                _canonical_diary_nest(str(args[3]))
                if len(args) > 2 and args[2] and len(args[4:]) > 0
                else None
            )
        return None

    if subcommand == "messages":
        if _messages_help_takes_precedence(args):
            return None
        if action not in MESSAGES_COMMANDS:
            return None
        if action in {"channel", "history"}:
            return _canonical_diary_nest(
                str(args[2]) if len(args) > 2 else None
            )
        if action in {"context", "post"}:
            if len(args) <= 3 or not args[2] or not args[3]:
                return None
            return _canonical_diary_nest(str(args[2]))
        if action == "search":
            if len(args) <= 2 or not args[2]:
                return None
            # messages.ts deliberately begins scanning after the query.
            channel_index = next(
                (
                    index
                    for index in range(3, len(args))
                    if str(args[index]) == "--channel"
                ),
                -1,
            )
            if channel_index < 0:
                return None
            channel = (
                str(args[channel_index + 1])
                if len(args) > channel_index + 1
                else ""
            )
            if not channel or channel.startswith("--"):
                return None
            return _canonical_diary_nest(
                channel
            )
        return None

    if subcommand == "posts":
        if _posts_help_takes_precedence(args):
            return None
        if action not in POSTS_COMMANDS:
            return None
        return _canonical_diary_nest(
            str(args[2]) if len(args) > 2 else None
        )

    if subcommand == "expose":
        if _expose_help_takes_precedence(args):
            return None
        if action not in EXPOSE_TARGET_COMMANDS:
            return None
        return _diary_nest_from_cite_path(
            str(args[2]) if len(args) > 2 else None
        )

    return None


def _migration_blocked_message(nest: Optional[str] = None) -> str:
    command = f"/migrate {nest or '<diary-nest>'}"
    return (
        "Blocked: this notes operation requires owner confirmation. "
        f"Ask the owner to type `{command}`."
    )


def _migration_cleanup_blocked_message(
    nest: Optional[str] = None,
) -> str:
    command = f"/migrate cleanup {nest or '<notes-nest>'}"
    return (
        "Blocked: this notes operation requires owner confirmation. "
        f"Ask the owner to type `{command}`."
    )


def _notebook_blocked_message(nest: Optional[str] = None) -> str:
    command = f"/migrate {nest or '<diary-nest>'}"
    return (
        "Blocked: the notebook command uses deprecated %diary behavior "
        "that this tool does not support. Use 'tlon notes' for %notes "
        "notebooks. To migrate a diary, ask the owner to type "
        f"`{command}`."
    )


def diary_target_blocked_message(nest: str) -> str:
    return (
        "Blocked: %diary channels are deprecated and unsupported by this CLI "
        f"tool. Ask the owner to type `/migrate {nest}`."
    )


def check_blocked_diary_operation(
    args: Sequence[str],
) -> Optional[tuple[str, Optional[str]]]:
    subcommand = str(args[0]).lower() if args else ""
    if subcommand == "notebook":
        nest = _canonical_diary_nest(
            str(args[1]) if len(args) > 1 else None
        )
        return _notebook_blocked_message(nest), nest

    nest = _diary_nest_for_removed_cli_operation(args)
    return (diary_target_blocked_message(nest), nest) if nest else None


def refused_diary_nest(args: Sequence[str]) -> Optional[str]:
    migration_block = check_blocked_migration_operation(args)
    if migration_block:
        return _canonical_diary_nest(_migration_source_operand(args))
    diary_block = check_blocked_diary_operation(args)
    return diary_block[1] if diary_block else None


def set_diary_migration_notification_sender(
    sender: SendOwnerNotification,
    *,
    bot_ship: str,
    owner_ship: str,
    title_lookup: DiaryTitleLookup,
) -> None:
    global _diary_notification_registration
    _diary_notification_registration = _DiaryMigrationNotificationRegistration(
        sender=sender,
        bot_ship=bot_ship,
        owner_ship=owner_ship,
        title_lookup=title_lookup,
    )


def clear_diary_migration_notification_sender(
    sender: SendOwnerNotification,
) -> None:
    global _diary_notification_registration
    registration = _diary_notification_registration
    if registration is not None and registration.sender == sender:
        _diary_notification_registration = None


async def _send_diary_migration_discovery(
    canonical: str,
    *,
    sender: SendOwnerNotification,
    title_lookup: DiaryTitleLookup,
    build_card: BuildMigrationCard,
) -> bool:
    command = f"/migrate {canonical}"
    try:
        source_title = await title_lookup(canonical)
    except Exception:
        logger.exception(
            "[tlon] failed to look up diary migration discovery title for %s",
            canonical,
        )
        return False
    title = source_title.strip() if isinstance(source_title, str) else ""
    if not title:
        return False

    archived = title.endswith(ARCHIVE_TITLE_SUFFIX)
    blob: Optional[str] = None
    if not archived:
        try:
            blob = build_card(command, title=title)
        except Exception:
            logger.exception(
                "[tlon] failed to build diary migration discovery card"
            )

    if archived:
        text = (
            f"Found legacy diary `{canonical}`, but its title already ends in "
            f"`{ARCHIVE_TITLE_SUFFIX}`, so it looks like it has already been "
            "migrated and no action was offered. If it has not been migrated, "
            f"rename the channel to remove `{ARCHIVE_TITLE_SUFFIX}` and it can "
            "be migrated again."
        )
    elif blob is not None:
        text = f'Diary migration available for "{title}"'
    else:
        text = (
            f'Diary migration available for "{title}" — to migrate, type '
            f"`{command}`"
        )

    try:
        result = await sender(text, blob)
    except Exception:
        logger.exception(
            "[tlon] failed to send diary migration discovery notification"
        )
        return False
    if result is not True:
        return False
    _notified_diary_nests.add(canonical)
    return True


async def notify_diary_migration_discovery(
    nest: str,
    *,
    sender: Optional[SendOwnerNotification] = None,
    bot_ship: Optional[str] = None,
    owner_ship: Optional[str] = None,
    title_lookup: Optional[DiaryTitleLookup] = None,
    build_card: BuildMigrationCard = build_migrate_card,
) -> bool:
    canonical = _canonical_diary_nest(nest)
    if canonical is None:
        return False
    if sender is None:
        registration = _diary_notification_registration
        if registration is None:
            return False
        notification_sender = registration.sender
        notification_bot_ship = registration.bot_ship
        notification_owner_ship = registration.owner_ship
        notification_title_lookup = registration.title_lookup
    else:
        notification_sender = sender
        notification_bot_ship = str(bot_ship or "")
        notification_owner_ship = str(owner_ship or "")
        notification_title_lookup = title_lookup

    normalized_owner = normalize_ship(notification_owner_ship).lower()
    normalized_bot = normalize_ship(notification_bot_ship).lower()
    host = canonical.split("/", 2)[1]
    if (
        not normalized_owner
        or host not in {normalized_owner, normalized_bot}
        or notification_title_lookup is None
        or canonical in _notified_diary_nests
    ):
        return False

    pending = _diary_notifications_in_flight.get(canonical)
    if pending is not None:
        await pending
        return False

    task = asyncio.create_task(
        _send_diary_migration_discovery(
            canonical,
            sender=notification_sender,
            title_lookup=notification_title_lookup,
            build_card=build_card,
        )
    )
    _diary_notifications_in_flight[canonical] = task
    try:
        return await task
    finally:
        if _diary_notifications_in_flight.get(canonical) is task:
            _diary_notifications_in_flight.pop(canonical, None)


def start_diary_migration_discovery(nest: str) -> None:
    task = asyncio.create_task(notify_diary_migration_discovery(nest))
    _pending_discovery_tasks.add(task)

    def done(completed: asyncio.Task[bool]) -> None:
        _pending_discovery_tasks.discard(completed)
        try:
            completed.result()
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception(
                "[tlon] diary migration discovery task failed for %s",
                nest,
            )

    task.add_done_callback(done)


async def wait_for_pending_discovery() -> None:
    while _pending_discovery_tasks:
        await asyncio.gather(
            *tuple(_pending_discovery_tasks),
            return_exceptions=True,
        )


def _tool_command_for_display(command: Sequence[str]) -> str:
    def quote_arg(arg: str) -> str:
        if not arg:
            return "''"
        if any(char.isspace() for char in arg) or any(char in arg for char in "'\"\\"):
            return shlex.quote(arg)
        return arg

    return " ".join(quote_arg(str(part)) for part in command)


def _user_group_create_block(
    command_args: Sequence[str],
    *,
    session_platform: str,
    session_user_id: str,
) -> Optional[str]:
    if session_platform.lower() != "tlon":
        return None
    owner = _normalize_session_ship(session_user_id)
    if not owner:
        return None

    title = command_args[2] if len(command_args) > 2 else "Name"
    suggested_args = ["groups", "create-owned", str(title), "--owner", owner]
    suggested_args.extend(str(arg) for arg in command_args[3:])
    suggested = _tool_command_for_display(suggested_args)
    return (
        "Blocked: use groups create-owned for user-requested Tlon groups. "
        "Plain groups create makes a bot-owned group and does not invite or "
        f"admin the requester. Retry with command parameter: {suggested}"
    )


def _profile_update_block(
    *,
    session_platform: str,
    session_user_id: str,
    owner_ship: str,
) -> Optional[str]:
    if session_platform.lower() != "tlon":
        return None

    owner = _normalize_session_ship(owner_ship)
    if not owner:
        return (
            "Blocked: Tlon profile updates from chat require TLON_OWNER_SHIP "
            "so the adapter knows who may change the bot identity."
        )

    requester = _normalize_session_ship(session_user_id)
    if requester != owner:
        return (
            "Blocked: only the configured Tlon owner may change the bot "
            f"profile. Configured owner: {owner}."
        )

    return None


def _has_image_flag(args: Sequence[str]) -> bool:
    """Image sends are exempt from the current-conversation block.

    The streaming reply path is text-only, so the tool is the only way to
    deliver an image anywhere — including the current chat. Keep this in sync
    with the Tlon CLI's accepted ``--image <url>`` and ``--image=<url>`` forms.
    """
    return any(
        str(arg) == "--image" or str(arg).startswith("--image=") for arg in args
    )


def _has_stdin_flag(args: Sequence[str]) -> bool:
    return any(str(arg) == "--stdin" for arg in args)


def check_blocked_migration_operation(args: Sequence[str]) -> Optional[str]:
    """Carry the guard locally because the skill package does not publish sources.

    This is intentionally duplicated in each runtime at the model-tool boundary.
    """
    command = str(args[0]).lower() if args else ""
    subcommand = str(args[1]).lower() if len(args) > 1 else ""
    if not subcommand:
        return None
    if command == "channels" and subcommand == "delete":
        nest = _canonical_notes_nest(_migration_source_operand(args))
        return _migration_cleanup_blocked_message(nest) if nest else None
    if command != "notes":
        return None
    if subcommand == "notebook-delete":
        nest = _canonical_notes_nest(_migration_source_operand(args))
        return _migration_cleanup_blocked_message(nest)
    if not subcommand.startswith("migrate"):
        return None
    nest = _canonical_diary_nest(_migration_source_operand(args))
    return (
        None
        if subcommand == "migrate-plan"
        else _migration_blocked_message(nest)
    )


def _send_targets_current_conversation(
    args: Sequence[str],
    sub_idx: int,
    session_chat_id: str,
) -> bool:
    """True when a send op's target is the conversation the bot is handling.

    The target is the first positional after ``<subcommand> <action>`` (a nest
    like ``chat/~host/name`` or a ship/club id). Compared case-insensitively;
    when there is no current conversation (e.g. cron/standalone) nothing is
    considered current, so proactive sends pass.
    """
    chat = str(session_chat_id or "").strip()
    if not chat or len(args) <= sub_idx + 2:
        return False
    target = str(args[sub_idx + 2]).strip()
    return bool(target) and target.casefold() == chat.casefold()


def check_tlon_tool_command(
    args: Sequence[str],
    *,
    session_platform: str = "",
    session_user_id: str = "",
    session_chat_id: str = "",
    owner_ship: str = "",
    reaction_level: str = "minimal",
) -> Optional[str]:
    lowered = [str(arg).lower() for arg in args]
    if lowered in (["--help"], ["--version"]):
        return None

    sub_idx = find_subcommand_index(args)
    subcommand = args[sub_idx].lower() if sub_idx >= 0 else ""
    if not subcommand or subcommand not in ALLOWED_TLON_COMMANDS:
        allowed = ", ".join(sorted(ALLOWED_TLON_COMMANDS))
        return f"Unknown tlon subcommand '{subcommand or '(none)'}'. Allowed: {allowed}"

    command_args = [str(arg) for arg in args[sub_idx:]]
    action = command_args[1] if len(command_args) > 1 else ""
    diary_block = check_blocked_diary_operation(command_args)
    if diary_block:
        return diary_block[0]
    if (
        (subcommand, action) in {("posts", "react"), ("posts", "unreact"), ("dms", "react"), ("dms", "unreact")}
        and str(reaction_level).lower() in {"off", "ack"}
    ):
        return (
            "Blocked: agent reactions are disabled "
            f'(TLON_REACTION_LEVEL="{str(reaction_level).lower()}"). '
            "Set TLON_REACTION_LEVEL to minimal or extensive to enable."
        )
    migration_block = check_blocked_migration_operation(command_args)
    if migration_block:
        return migration_block
    if subcommand == "notes" and _has_stdin_flag(args[sub_idx:]):
        return (
            "Blocked: notes --stdin is not available through this tool because "
            "Hermes cannot pipe stdin into the tlon CLI process. Write the "
            "Markdown body to a file and use --body <file>."
        )
    targets_current = _send_targets_current_conversation(
        args, sub_idx, session_chat_id
    )
    target = str(args[sub_idx + 2]).strip() if len(args) > sub_idx + 2 else ""
    is_current_heap_post_send = (
        (subcommand, action) == ("posts", "send")
        and targets_current
        and target.casefold().startswith("heap/")
    )
    # Message-send operations are blocked when they target the *current*
    # conversation — those must go through Hermes' streaming reply path
    # (TlonAdapter.send()). The current-gallery ``posts send`` carveout creates a
    # new top-level gallery item. Sends to any other channel/DM are proactive and
    # allowed through the tool, since "reply normally" only reaches the current chat.
    if (
        (subcommand, action) in SEND_OPERATIONS
        and not _has_image_flag(args)
        and targets_current
        and not is_current_heap_post_send
    ):
        return (
            "Blocked: don't deliver your reply to the current conversation with "
            "the tlon tool — reply normally so Hermes delivers it through "
            "TlonAdapter.send(). Sending to other channels or one-to-one DMs "
            "with posts send|reply is allowed, dms send|reply is reserved for "
            "group-DM club IDs, and image sends (posts/dms send --image) are "
            "allowed anywhere, including this conversation."
        )
    if subcommand == "groups" and action == "create":
        group_create_block = _user_group_create_block(
            args[sub_idx:],
            session_platform=session_platform,
            session_user_id=session_user_id,
        )
        if group_create_block:
            return group_create_block
    if subcommand == "contacts" and action == "update-profile":
        profile_block = _profile_update_block(
            session_platform=session_platform,
            session_user_id=session_user_id,
            owner_ship=owner_ship,
        )
        if profile_block:
            return profile_block

    return None


def _command_for_display(command: Sequence[str]) -> str:
    return " ".join(shlex.quote(str(part)) for part in command)


def _tool_result(result: TlonSendResult) -> str:
    payload: dict[str, Any] = {
        "success": result.success,
        "command": _command_for_display(result.command),
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }
    if result.message_id:
        payload["message_id"] = result.message_id
    if result.error:
        payload["error"] = result.error
    return _json(payload)


async def execute_tlon_tool(
    params: Mapping[str, Any],
    *,
    config: Optional[TlonConfig] = None,
    runner: Optional[CommandRunner] = None,
) -> str:
    command_text = str(params.get("command") or "").strip()
    if not command_text:
        return _json({"error": "Missing required parameter: command"})

    args, parse_error = split_tlon_command(command_text)
    if parse_error:
        return _json({"error": f"Could not parse tlon command: {parse_error}"})
    args = normalize_global_command_args(args)

    cfg = config or TlonConfig.from_env()
    blocked = check_tlon_tool_command(
        args,
        session_platform=_get_session_env("HERMES_SESSION_PLATFORM", ""),
        session_user_id=_get_session_env("HERMES_SESSION_USER_ID", ""),
        session_chat_id=_get_session_env("HERMES_SESSION_CHAT_ID", ""),
        owner_ship=cfg.owner_ship,
        reaction_level=cfg.reaction_level,
    )
    if blocked:
        sub_idx = find_subcommand_index(args)
        command_args = args[sub_idx:] if sub_idx >= 0 else ()
        diary_nest = refused_diary_nest(command_args)
        if diary_nest:
            start_diary_migration_discovery(diary_nest)
        return _json({"error": blocked, "blocked": True})

    if not cfg.is_complete():
        return _json(
            {
                "error": (
                    "Tlon node URL/id/access code are not configured. Set "
                    "TLON_NODE_URL, TLON_NODE_ID, and TLON_ACCESS_CODE."
                )
            }
        )

    # Lazy import keeps this module importable standalone (no cycle at load).
    from .telemetry import cli_context, get_active_telemetry

    telemetry = get_active_telemetry()
    cli = TlonCLI(
        cfg,
        runner=runner,
        observer=telemetry.observe_cli if telemetry is not None else None,
        as_bot=True,
    )
    with cli_context(
        "model_tool",
        conversation=_get_session_env("HERMES_SESSION_CHAT_ID", ""),
    ):
        return _tool_result(await cli.run_command(args))


async def handle_tlon_tool(params: Mapping[str, Any], **_kwargs: Any) -> str:
    return await execute_tlon_tool(params)


def _cli_available(cli: str | None = None) -> bool:
    candidate = (cli or "tlon").strip()
    if not candidate:
        return False
    if os.path.sep in candidate:
        return Path(candidate).exists()
    return shutil.which(candidate) is not None


def check_tlon_tool_requirements() -> bool:
    cfg = TlonConfig.from_env()
    return cfg.is_complete() and _cli_available(cfg.cli)


def run_tlon_tool_sync(params: Mapping[str, Any], **kwargs: Any) -> str:
    return asyncio.run(handle_tlon_tool(params, **kwargs))


def resolve_tlon_skill_path(env: Mapping[str, str | None] | None = None) -> Optional[Path]:
    env = os.environ if env is None else env
    here = Path(__file__).resolve().parent
    candidates: list[Path] = []

    explicit = str(env.get("TLON_SKILL_PATH") or "").strip()
    if explicit:
        candidates.append(Path(explicit))

    skill_dir = str(env.get("TLON_SKILL_DIR") or "").strip()
    if skill_dir:
        candidates.append(Path(skill_dir) / "SKILL.md")

    candidates.append(here.parent / "tlon-skill" / "SKILL.md")

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None
