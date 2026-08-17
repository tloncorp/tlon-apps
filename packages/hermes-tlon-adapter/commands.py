"""Single source of truth for the adapter's owner control commands.

Every control command the adapter detects in chat is one row of
``COMMAND_REGISTRY``. The row encodes the command's detection shape (the
three shapes that exist today are reproduced exactly — they are
behavior-relevant: ``/pending 2`` must keep falling through to the model,
``/tlon-version please`` must keep matching), its usage text (the existing
module constants moved here verbatim), and its telemetry token.

It deliberately carries no popup metadata (titles, subtitles, icons,
keywords): the Tlon client owns the editorial surface, in its own static
per-harness lists. What this side owes the client is the token set, and only
that — which is what ``fixtures/commands.json`` holds and what the client's
drift contract (packages/shared/src/domain/runtimeCommandContract.test.ts)
pins against those lists.

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
from dataclasses import dataclass
from enum import Enum
from typing import Optional

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
    usage: Optional[str] = None
    # False means handled but never named to the client (the client's static
    # list must not suggest it); the reason is required alongside.
    advertise: bool = True
    do_not_advertise_reason: str = ""
    # Dispatcher-level telemetry token; None where the dispatcher emits none
    # (``/tlon`` reports per-subcommand tokens from its handler instead).
    telemetry_token: Optional[str] = None


# Dispatcher order (adapter._maybe_handle_control_command). Order is this
# side's own concern: the client sorts its popup by its own priorities.
COMMAND_REGISTRY: tuple[CommandRow, ...] = (
    CommandRow(
        token="/owner-listen",
        shape=CommandShape.PREFIX,
        name="owner-listen",
        usage=OWNER_LISTEN_USAGE,
        telemetry_token="owner-listen",
    ),
    CommandRow(
        token="/migrate",
        shape=CommandShape.PREFIX,
        name="migrate",
        usage=MIGRATE_USAGE,
        telemetry_token="migrate",
    ),
    CommandRow(
        token="/tlon",
        shape=CommandShape.PREFIX,
        name="tlon",
        telemetry_token=None,
    ),
    CommandRow(
        token="/tlon-version",
        shape=CommandShape.PREFIX,
        name="tlon-version",
        advertise=False,
        do_not_advertise_reason="legacy alias of /tlon version",
        telemetry_token="tlon-version",
    ),
    CommandRow(
        token="/allow",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="allow",
        telemetry_token="allow",
    ),
    CommandRow(
        token="/reject",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="reject",
        telemetry_token="reject",
    ),
    CommandRow(
        token="/ban",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="ban",
        telemetry_token="ban",
    ),
    CommandRow(
        token="/unban",
        shape=CommandShape.ANCHORED_OPTIONAL_ARG,
        name="unban",
        telemetry_token="unban",
    ),
    CommandRow(
        token="/pending",
        shape=CommandShape.STRICT_NO_ARG,
        name="pending",
        telemetry_token="pending",
    ),
    CommandRow(
        token="/banned",
        shape=CommandShape.STRICT_NO_ARG,
        name="banned",
        telemetry_token="banned",
    ),
    CommandRow(
        token="/channel-access",
        shape=CommandShape.PREFIX,
        name="channel-access",
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


def command_tokens() -> list[str]:
    return [row.token for row in advertised_command_rows()]


def build_command_tokens_json() -> str:
    """The committed fixture's exact bytes (fixtures/commands.json). Nothing
    sends this anywhere: it is the CI artifact the client's drift contract
    reads, so only its content and its stability matter. Matches the TS
    builder's ``JSON.stringify(tokens, null, 2)`` so both runtimes' fixtures
    look alike."""
    return json.dumps(command_tokens(), indent=2) + "\n"


# Hermes CORE commands the client's popup offers alongside the registry
# tokens. Audit-pinned constant mirroring the client's HERMES_CORE_COMMANDS,
# carrying the same audit citation (hermes-agent tag v2026.6.19, commit
# 2bd1977): each is defined in core's command registry
# (hermes_cli/commands.py) and dispatched by the gateway (gateway/run.py).
# The adapter neither registers nor dispatches them — core does, once the
# message passes the attention gate — but bare owner engagement
# (is_core_command) must let them through, so the popup's bare insertion
# works in any monitored channel.
CORE_COMMAND_TOKENS: tuple[str, ...] = (
    "/help",
    "/status",
    "/new",
    "/stop",
    "/usage",
    "/model",
)

# Same detection shape as the registry's PREFIX rows (token followed by
# whitespace or end-of-string, case-insensitive, matched against the
# stripped text), reusing that machinery so a bare core command is
# recognized exactly like a bare adapter command.
_CORE_COMMAND_REGEXES: tuple[re.Pattern[str], ...] = tuple(
    re.compile(rf"^{re.escape(token)}(?:\s|$)", re.IGNORECASE)
    for token in CORE_COMMAND_TOKENS
)


def is_core_command(text: str) -> bool:
    """Whether the (stripped) message text is a bare Hermes core command,
    optionally followed by arguments. Token-boundary safe: ``/new`` does
    not match ``/newish``."""
    stripped = str(text or "").strip()
    if not stripped:
        return False
    return any(regex.match(stripped) for regex in _CORE_COMMAND_REGEXES)


def engagement_tokens() -> list[str]:
    """Every token that engages bare from the owner in a monitored channel:
    all registry tokens (including the unadvertised /tlon-version, which the
    dispatcher still handles) plus the core tokens above."""
    return [row.token for row in COMMAND_REGISTRY] + list(CORE_COMMAND_TOKENS)


def build_engagement_tokens_json() -> str:
    """The committed fixture's exact bytes (fixtures/engagement-tokens.json).
    The CI artifact the client's parity contract reads: every token the
    client's popup can insert bare must appear here, or the popup would
    offer a command that is silently ignored in third-party-hosted group
    channels. Matches the TS builder's byte format."""
    return json.dumps(engagement_tokens(), indent=2) + "\n"
