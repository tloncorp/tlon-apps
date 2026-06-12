"""Hermes model tool wrapper for the packaged ``tlon`` CLI."""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import shutil
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from .tlon_api import CommandRunner, TlonCLI, TlonConfig, TlonSendResult

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
        "posts",
        "settings",
        "upload",
        "help",
        "version",
    }
)

CREDENTIAL_FLAGS_WITH_VALUE = frozenset(
    {"--config", "--url", "--ship", "--code", "--cookie"}
)

# Message-send operations. These are blocked only when they target the
# *current* conversation — those must go through Hermes' streaming reply path
# (TlonAdapter.send()). Sends to any other channel/DM are proactive and allowed
# through the tool, since "reply normally" can only reach the current chat.
SEND_OPERATIONS = {
    ("dms", "send"),
    ("dms", "reply"),
    ("posts", "send"),
    ("posts", "reply"),
}

TLON_TOOL_DESCRIPTION = (
    "Tlon/Urbit CLI for reading data and administration: activity, channels, "
    "contacts, groups, messages, posts, settings, upload, expose, hooks. "
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
    "posts/dms send here (that path is blocked so Hermes delivers replies). "
    "To post to a DIFFERENT channel or DM (a proactive send), use posts send / "
    "dms send with that target, e.g. posts send chat/~host/channel \"...\"."
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
                    "To post to a different channel/DM, use 'posts send "
                    "<channel> \"...\"' or 'dms send <ship> \"...\"'. Sending to "
                    "the CURRENT conversation is blocked (reply normally "
                    "instead); 'notebook' is also blocked."
                ),
            }
        },
        "required": ["command"],
    },
}


def _json(data: Mapping[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def find_subcommand_index(args: Sequence[str]) -> int:
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("--") and "=" in arg:
            flag = arg.split("=", 1)[0]
            if flag in CREDENTIAL_FLAGS_WITH_VALUE:
                i += 1
                continue
        if arg in CREDENTIAL_FLAGS_WITH_VALUE:
            i += 2
            continue
        return i
    return -1


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
) -> Optional[str]:
    lowered = [str(arg).lower() for arg in args]
    if lowered in (["--help"], ["--version"]):
        return None

    sub_idx = find_subcommand_index(args)
    subcommand = args[sub_idx].lower() if sub_idx >= 0 else ""
    if not subcommand or subcommand not in ALLOWED_TLON_COMMANDS:
        allowed = ", ".join(sorted(ALLOWED_TLON_COMMANDS))
        return f"Unknown tlon subcommand '{subcommand or '(none)'}'. Allowed: {allowed}"

    command_args = [str(arg).lower() for arg in args[sub_idx:]]
    action = command_args[1] if len(command_args) > 1 else ""
    if subcommand == "notebook":
        return (
            "Blocked: notebook posting is not available through this tool. Use "
            "channel posts instead."
        )
    if (subcommand, action) in SEND_OPERATIONS and _send_targets_current_conversation(
        args, sub_idx, session_chat_id
    ):
        return (
            "Blocked: don't deliver your reply to the current conversation with "
            "the tlon tool — reply normally so Hermes delivers it through "
            "TlonAdapter.send(). Sending to other channels or DMs with posts/dms "
            "send|reply is allowed."
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
    )
    if blocked:
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
