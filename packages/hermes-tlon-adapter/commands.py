"""Single source of truth for the adapter's owner control commands.

Every control command the adapter detects in chat is one row of
``COMMAND_REGISTRY``. The row encodes the command's detection shape (the
three shapes that exist today are reproduced exactly — they are
behavior-relevant: ``/pending 2`` must keep falling through to the model,
``/tlon-version please`` must keep matching), its usage text (the existing
module constants moved here verbatim), its telemetry token, and the fields
of the slash-command manifest the bot advertises in its own contact profile
under ``bot-commands`` (wire contract: docs/bot-command-manifests.md in
tlon-apps).

Feature modules (owner_listen, channel_access, migration, version,
approval, adapter) take their compiled detection regexes from
``command_detection_regex`` so the registry and the dispatch path cannot
drift; the dispatcher in adapter.py consumes the same predicates.

This module has no package-relative imports so it stays importable from any
context (the version fingerprint module delegates here with a fallback).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional

BOT_COMMANDS_CONTACT_KEY = "bot-commands"
BOT_COMMANDS_CONTACT_MARK = "contact-action-1"
# Client-side parse ceiling for the raw manifest; the backend's 10kB jam cap
# covers the whole profile, so a rejected poke is a real, non-fatal outcome
# regardless.
BOT_COMMANDS_MAX_MANIFEST_BYTES = 6000

# Usage strings moved here verbatim from their former homes; existing tests
# pin them literally.
OWNER_LISTEN_USAGE = (
    "Usage: /owner-listen [on|off|status|list] [<channel-nest>|<~host/group>] | "
    "/owner-listen all [on|off] | /owner-listen default [owned|all]"
)
CHANNEL_ACCESS_USAGE = (
    "Usage: /channel-access [open|restricted|status|list] [<channel-nest>]"
)
MIGRATE_USAGE = (
    "Usage: /migrate <diary-nest> [--allow-write-widening] | "
    "/migrate cleanup <notes-nest>"
)


class CommandShape(str, Enum):
    # ``/token`` followed by whitespace or end-of-string; arguments are free
    # form (``/tlon-version please`` matches).
    PREFIX = "prefix"
    # The whole message is the token plus at most one argument
    # (``/allow abc`` matches; ``/allow a b`` does not).
    ANCHORED_OPTIONAL_ARG = "anchored-optional-arg"
    # The whole message is exactly the token (``/pending 2`` falls through to
    # the model).
    STRICT_NO_ARG = "strict-no-arg"


@dataclass(frozen=True)
class CommandRow:
    token: str
    shape: CommandShape
    # Dispatcher/telemetry name (token without the leading slash).
    name: str
    title: str
    subtitle: str = ""
    keywords: tuple[str, ...] = field(default_factory=tuple)
    insert_text: str = ""
    usage: Optional[str] = None
    advertise: bool = True
    do_not_advertise_reason: str = ""
    # Dispatcher-level telemetry token; None where the dispatcher emits none
    # (``/tlon`` reports per-subcommand tokens from its handler instead).
    telemetry_token: Optional[str] = None


# Dispatcher order (adapter._maybe_handle_control_command). Array order in
# the advertised manifest is the client's ranking priority.
COMMAND_REGISTRY: tuple[CommandRow, ...] = (
    CommandRow(
        token="/owner-listen",
        shape=CommandShape.PREFIX,
        name="owner-listen",
        title="Owner listen",
        subtitle="Let the owner session listen in this channel",
        keywords=("owner", "listen", "agent"),
        usage=OWNER_LISTEN_USAGE,
        telemetry_token="owner-listen",
    ),
    CommandRow(
        token="/migrate",
        shape=CommandShape.PREFIX,
        name="migrate",
        title="Migrate diary to notes",
        subtitle="Run or clean up a diary-to-notes migration",
        keywords=("migrate", "diary", "notes", "migration"),
        usage=MIGRATE_USAGE,
        telemetry_token="migrate",
    ),
    CommandRow(
        token="/tlon",
        shape=CommandShape.PREFIX,
        name="tlon",
        title="Tlon diagnostics",
        subtitle="Tlon adapter diagnostics. Usage: /tlon version",
        keywords=("tlon", "diagnostics", "version", "status"),
        telemetry_token=None,
    ),
    CommandRow(
        token="/tlon-version",
        shape=CommandShape.PREFIX,
        name="tlon-version",
        title="Tlon adapter version",
        subtitle="Show the installed Hermes Tlon adapter version",
        keywords=("version", "adapter", "hermes"),
        advertise=False,
        do_not_advertise_reason="legacy alias of /tlon version",
        telemetry_token="tlon-version",
    ),
    CommandRow(
        token="/allow",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="allow",
        title="Allow request",
        subtitle="Approve a pending request by id",
        keywords=("approve", "approval", "request"),
        telemetry_token="allow",
    ),
    CommandRow(
        token="/reject",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="reject",
        title="Reject request",
        subtitle="Decline a pending request by id",
        keywords=("deny", "decline", "approval", "request"),
        telemetry_token="reject",
    ),
    CommandRow(
        token="/ban",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="ban",
        title="Ban request",
        subtitle="Block a ship and deny its pending request",
        keywords=("block", "deny", "ship", "approval"),
        telemetry_token="ban",
    ),
    CommandRow(
        token="/unban",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="unban",
        title="Unban ship",
        subtitle="Remove a ship from the ban list",
        keywords=("unblock", "ship", "allow"),
        telemetry_token="unban",
    ),
    CommandRow(
        token="/pending",
        shape=CommandShape.STRICT_NO_ARG,
        name="pending",
        title="Pending approvals",
        subtitle="List pending DM, channel, and group requests",
        keywords=("approval", "requests", "owner"),
        telemetry_token="pending",
    ),
    CommandRow(
        token="/banned",
        shape=CommandShape.STRICT_NO_ARG,
        name="banned",
        title="Banned ships",
        subtitle="List currently banned ships",
        keywords=("blocked", "ships", "list"),
        telemetry_token="banned",
    ),
    CommandRow(
        token="/channel-access",
        shape=CommandShape.PREFIX,
        name="channel-access",
        title="Channel access",
        subtitle="Open or restrict a channel, or show its access status",
        keywords=("channel", "access", "open", "restricted"),
        usage=CHANNEL_ACCESS_USAGE,
        telemetry_token="channel-access",
    ),
)

_REGISTRY_BY_NAME: dict[str, CommandRow] = {row.name: row for row in COMMAND_REGISTRY}


def get_command_row(name: str) -> CommandRow:
    return _REGISTRY_BY_NAME[name]


def detection_regex(row: CommandRow) -> re.Pattern[str]:
    """Compile the detection regex for a row, reproducing the three shapes
    that exist today exactly (case-insensitive, matched against the stripped
    message text)."""
    token = re.escape(row.token)
    if row.shape is CommandShape.PREFIX:
        pattern = rf"^{token}(?:\s|$)"
    elif row.shape is CommandShape.ANCHORED_OPTIONAL_ARG:
        pattern = rf"^{token}(?:\s+(?P<arg>\S+))?\s*$"
    elif row.shape is CommandShape.STRICT_NO_ARG:
        pattern = rf"^{token}\s*$"
    else:  # pragma: no cover - enum is closed
        raise ValueError(f"unknown command shape: {row.shape}")
    return re.compile(pattern, re.IGNORECASE)


# Compiled once; feature modules must take these exact objects so the
# registry and the dispatch path can never drift.
_DETECTION_REGEXES: dict[str, re.Pattern[str]] = {
    row.name: detection_regex(row) for row in COMMAND_REGISTRY
}


def command_detection_regex(name: str) -> re.Pattern[str]:
    return _DETECTION_REGEXES[name]


def advertised_command_rows() -> list[CommandRow]:
    return [row for row in COMMAND_REGISTRY if row.advertise]


def build_command_manifest_json() -> str:
    """Serialize the advertised manifest (wire format v:1). Stable ordering
    (registry order, sorted JSON keys) so compare-before-poke does not
    false-positive. Adapter commands only — hermes-core chat commands are
    not verifiable from this repo and are never advertised."""
    commands = []
    for row in advertised_command_rows():
        entry: dict[str, Any] = {"command": row.token, "title": row.title}
        if row.subtitle:
            entry["subtitle"] = row.subtitle
        if row.keywords:
            entry["keywords"] = list(row.keywords)
        if row.insert_text:
            entry["insertText"] = row.insert_text
        commands.append(entry)
    # ensure_ascii=False keeps non-ASCII literal, matching the TS builder's
    # JSON.stringify output and making the byte cap count real UTF-8 bytes
    # rather than \uXXXX escapes.
    value = json.dumps(
        {"v": 1, "commands": commands},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    size = len(value.encode("utf-8"))
    if size > BOT_COMMANDS_MAX_MANIFEST_BYTES:
        raise ValueError(
            f"bot command manifest exceeds {BOT_COMMANDS_MAX_MANIFEST_BYTES} "
            f"UTF-8 bytes: {size}"
        )
    return value


def extract_bot_commands_value(self_contact: Any) -> Optional[str]:
    """Runtime shape check for the ``bot-commands`` field on a self-contact
    map: only a %text field carrying a string is a published manifest."""
    if not isinstance(self_contact, Mapping):
        return None
    candidate = self_contact.get(BOT_COMMANDS_CONTACT_KEY)
    if not isinstance(candidate, Mapping):
        return None
    if candidate.get("type") != "text":
        return None
    value = candidate.get("value")
    return value if isinstance(value, str) else None


def build_bot_commands_poke(value: Optional[str]) -> dict[str, Any]:
    """The contact-action-1 self poke advertising (or, with None, clearing)
    the manifest. Keys die only by explicit null — see
    docs/bot-command-manifests.md for the rollback procedure."""
    return {
        "self": {
            BOT_COMMANDS_CONTACT_KEY: None
            if value is None
            else {"type": "text", "value": value}
        }
    }
