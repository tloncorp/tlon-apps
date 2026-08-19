"""Small Tlon helpers for the Hermes platform plugin.

Writes go through the packaged ``tlon`` CLI. Reads use Eyre's SSE channel API.
This module deliberately has no Hermes imports so it can be tested in isolation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Awaitable, Callable, Mapping, Optional, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 10000
DEFAULT_CLI_TIMEOUT_SECONDS = 30.0
TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}
DEFAULT_GATEWAY_HEARTBEAT_SECONDS = 30.0
DEFAULT_GATEWAY_LEASE_SECONDS = 90.0
DEFAULT_GATEWAY_ACTIVE_WINDOW_SECONDS = 300
DEFAULT_GATEWAY_OFFLINE_REPLY_COOLDOWN_SECONDS = 300
DEFAULT_SSE_READ_TIMEOUT_SECONDS = 60.0
DEFAULT_SSE_STALE_THRESHOLD_SECONDS = 180.0
DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS = 30.0
# OpenClaw's 2^31-1 ms cap converted to seconds: an upward typo (999999999,
# 1e300) must not effectively disable the liveness machinery.
MAX_SSE_SECONDS = 2_147_483.647
# Eyre emits an SSE keepalive roughly every 20s; the silent-socket clamp
# must stay above that or a small stale threshold would tear down healthy
# streams between keepalives.
KEEPALIVE_SAFE_SECONDS = 30.0
ACTION_FLOOR_CAP = 4096
DEFAULT_MAX_CONSECUTIVE_BOT_RESPONSES = 3
DEFAULT_CONTEXT_MESSAGES = 20
REACTION_LEVELS = frozenset({"off", "ack", "minimal", "extensive"})
DEFAULT_REACTION_LEVEL = "minimal"

DEFAULT_NUDGE_TICK_INTERVAL_MS = 15 * 60 * 1000


class TlonTerminalActionError(ConnectionError):
    """A channel action rejected by Eyre, so retrying it cannot help.

    `status` is the rejecting HTTP status when known, so callers can tell an
    auth rejection (401/403) from a malformed action (400/422) without
    parsing the message.
    """

    def __init__(self, message: str, *, status: Optional[int] = None) -> None:
        super().__init__(message)
        self.status = status


def normalize_ship(ship: str) -> str:
    """Normalize a patp to ``~ship-name`` form."""
    ship = str(ship or "").strip()
    if not ship:
        return ""
    return ship if ship.startswith("~") else f"~{ship}"


def bare_ship(ship: str) -> str:
    return normalize_ship(ship).lstrip("~")


# @da (Urbit date) conversion, matching @urbit/aura's da.fromUnix so a post id
# we compute here round-trips through the client's da.toUnix.
_DA_UNIX_EPOCH = 170_141_184_475_152_167_957_503_069_145_530_368_000  # @ud ~1970.1.1
_DA_SECOND = 1 << 64  # @ud ~s1


def unix_ms_to_da(ms: int) -> int:
    return _DA_UNIX_EPOCH + (int(ms) * _DA_SECOND) // 1000


def _dotted_ud(value: int) -> str:
    """Render a bare @ud as Hoon's dotted decimal (groups of 3 from the right)."""
    digits = str(value)
    groups: list[str] = []
    while len(digits) > 3:
        groups.insert(0, digits[-3:])
        digits = digits[:-3]
    groups.insert(0, digits)
    return ".".join(groups)


def format_post_id(ship: str, sent_at_ms: int) -> str:
    """A post's id: ``~author/<@ud of da.fromUnix(sent)>``.

    Mirrors how the api stamps a post id and how the client resolves a message
    (by author + send time), computed from the exact ``sent`` the CLI used.
    """
    return f"{normalize_ship(ship)}/{_dotted_ud(unix_ms_to_da(sent_at_ms))}"


def parse_bool(value: Any) -> bool:
    return str(value or "").strip().lower() in TRUE_VALUES


def parse_bool_default(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    raw = str(value if value is not None else "").strip().lower()
    if not raw:
        return default
    if raw in TRUE_VALUES:
        return True
    if raw in FALSE_VALUES:
        return False
    return default


def parse_csv(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, (list, tuple, set)):
        return tuple(str(item).strip() for item in value if str(item).strip())
    return tuple(part.strip() for part in str(value).split(",") if part.strip())


def parse_ship_csv(value: Any) -> frozenset[str]:
    return frozenset(normalize_ship(part) for part in parse_csv(value) if part)


def parse_channel_nest(nest: str) -> Optional[dict[str, str]]:
    parts = str(nest or "").split("/", 2)
    if len(parts) != 3:
        return None
    return {"type": parts[0], "host": parts[1], "name": parts[2]}


def _env_first(
    env: Mapping[str, str | None],
    names: Sequence[str],
    extra: Mapping[str, Any],
    extra_names: Sequence[str],
    default: str = "",
) -> str:
    # Hermes declares process environment as its primary platform config;
    # PlatformConfig.extra is the fallback used by embedded/test deployments.
    for name in names:
        value = env.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    for name in extra_names:
        value = extra.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def _env_or_extra(
    env: Mapping[str, str | None],
    names: Sequence[str],
    extra: Mapping[str, Any],
    extra_names: Sequence[str],
    default: Any = "",
) -> Any:
    for name in names:
        value = env.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    for name in extra_names:
        if name not in extra:
            continue
        value = extra.get(name)
        if isinstance(value, str):
            if value.strip():
                return value.strip()
        elif value is not None:
            return value
    return default


def _parse_float(value: Any, default: float) -> float:
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _parse_bounded_float(
    value: Any, default: float, minimum: float, maximum: float
) -> float:
    """Strict positive-float knob parse: non-numeric, NaN, ±inf, non-positive,
    and out-of-band values all fall back to the default silently, so a typo
    can neither disable a liveness mechanism nor spin its loop."""
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return default
    if (
        not math.isfinite(parsed)
        or parsed <= 0
        or parsed < minimum
        or parsed > maximum
    ):
        return default
    return parsed


def _parse_sse_stale_threshold(value: Any, default: float) -> float:
    # Only the literal '0' disables staleness detection — checked before
    # numeric conversion so underflow spellings like '1e-9999' (which Python
    # silently parses to 0.0) cannot disable the watchdog.
    raw = str(value).strip()
    if raw == "0":
        return 0.0
    return _parse_bounded_float(raw, default, 1.0, MAX_SSE_SECONDS)


def _parse_int(value: Any, default: int) -> int:
    try:
        raw = float(str(value).strip())
        if not math.isfinite(raw):
            return default
        parsed = int(raw)
    except (TypeError, ValueError, OverflowError):
        return default
    return parsed if parsed > 0 else default


def _parse_non_negative_int(value: Any, default: int) -> int:
    try:
        parsed = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def _parse_strict_non_negative_int(value: Any, default: int) -> int:
    """Reject non-integral values instead of truncating them. Needed where 0
    is a meaningful sentinel: "0.5" must fall back to the default, not
    truncate to 0 (OpenClaw's schema likewise requires an integer)."""
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return default
    if not parsed.is_integer():
        return default
    return int(parsed) if parsed >= 0 else default


def _valid_timezone(value: str) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        return ""
    return value


def _format_da_from_unix_millis(value: float) -> str:
    dt = datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
    return f"~{dt.year}.{dt.month}.{dt.day}..{dt.hour:02d}.{dt.minute:02d}.{dt.second:02d}"


def _format_dr_seconds(seconds: int) -> str:
    return f"~s{int(seconds)}"


@dataclass(frozen=True)
class TlonConfig:
    ship_url: str
    ship_name: str
    ship_code: str = ""
    cookie: str = ""
    channels: tuple[str, ...] = ()
    auto_discover: bool = False
    home_channel: str = ""
    allowed_users: frozenset[str] = frozenset()
    dm_allowlist: frozenset[str] = frozenset()
    group_invite_allowlist: frozenset[str] = frozenset()
    allow_all_users: bool = False
    owner_ship: str = ""
    bot_mentions: tuple[str, ...] = ()
    free_response_channels: tuple[str, ...] = ()
    require_mention: bool = True
    known_bot_users: frozenset[str] = frozenset()
    max_consecutive_bot_responses: int = DEFAULT_MAX_CONSECUTIVE_BOT_RESPONSES
    reply_in_thread: bool = False
    owner_listen: bool = True
    owner_listen_default: str = "owned"
    owner_listen_disabled_channels: tuple[str, ...] = ()
    owner_listen_enabled_channels: tuple[str, ...] = ()
    context_messages: int = DEFAULT_CONTEXT_MESSAGES
    telemetry_enabled: bool = False
    telemetry_api_key: str = ""
    telemetry_host: str = ""
    telemetry_debug: bool = False
    cli: str = "tlon"
    cli_timeout: float = DEFAULT_CLI_TIMEOUT_SECONDS
    gateway_status_enabled: bool = True
    gateway_status_owner: str = ""
    gateway_status_heartbeat_seconds: float = DEFAULT_GATEWAY_HEARTBEAT_SECONDS
    gateway_status_lease_seconds: float = DEFAULT_GATEWAY_LEASE_SECONDS
    gateway_status_active_window_seconds: int = DEFAULT_GATEWAY_ACTIVE_WINDOW_SECONDS
    gateway_status_reply_cooldown_seconds: int = DEFAULT_GATEWAY_OFFLINE_REPLY_COOLDOWN_SECONDS
    reengagement_enabled: bool = False
    nudge_tick_interval_ms: int = DEFAULT_NUDGE_TICK_INTERVAL_MS
    nudge_active_hours_start: Optional[str] = None
    nudge_active_hours_end: Optional[str] = None
    nudge_active_hours_timezone: Optional[str] = None
    user_timezone: Optional[str] = None
    context_lens_enabled: bool = False
    context_lens_owner: str = ""
    context_lens_store_path: str = ""
    sse_read_timeout_seconds: float = DEFAULT_SSE_READ_TIMEOUT_SECONDS
    sse_stale_threshold_seconds: float = DEFAULT_SSE_STALE_THRESHOLD_SECONDS
    sse_watchdog_interval_seconds: float = DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS
    reaction_level: str = DEFAULT_REACTION_LEVEL
    # Force the hosted (memex) image-upload path. Opt-in: only true when the
    # operator sets TLON_HOSTING. Read once where the env is reliably present
    # (the adapter at startup) and carried via this field into CLI invocations,
    # since the env does not propagate into the model-tool subprocess.
    hosting: bool = False

    @classmethod
    def from_env(
        cls,
        extra: Mapping[str, Any] | None = None,
        env: Mapping[str, str | None] | None = None,
    ) -> "TlonConfig":
        extra = extra or {}
        env = os.environ if env is None else env

        ship_url = _env_first(
            env,
            ("TLON_NODE_URL", "TLON_SHIP_URL", "TLON_URL", "URBIT_URL"),
            extra,
            ("node_url", "ship_url", "url", "server"),
        ).rstrip("/")
        ship_name = normalize_ship(
            _env_first(
                env,
                ("TLON_NODE_ID", "TLON_SHIP_NAME", "TLON_SHIP", "URBIT_SHIP"),
                extra,
                ("node_id", "ship_name", "ship"),
            )
        )
        ship_code = _env_first(
            env,
            ("TLON_ACCESS_CODE", "TLON_SHIP_CODE", "TLON_CODE", "URBIT_CODE"),
            extra,
            ("access_code", "ship_code", "code"),
        )
        cookie = _env_first(
            env,
            ("TLON_COOKIE", "URBIT_COOKIE"),
            extra,
            ("cookie",),
        )
        channels = parse_csv(_env_or_extra(env, ("TLON_CHANNELS",), extra, ("channels",)))
        home_channel = _env_first(
            env,
            ("TLON_HOME_CHANNEL",),
            extra,
            ("home_channel",),
        )
        allowed_users = parse_ship_csv(
            _env_or_extra(
                env,
                ("TLON_ALLOWED_USERS",),
                extra,
                ("allowed_users",),
            )
        )
        dm_allowlist = parse_ship_csv(
            _env_or_extra(
                env,
                ("TLON_DM_ALLOWLIST",),
                extra,
                ("dm_allowlist",),
            )
        )
        group_invite_allowlist = parse_ship_csv(
            _env_or_extra(
                env,
                ("TLON_GROUP_INVITE_ALLOWLIST",),
                extra,
                ("group_invite_allowlist",),
            )
        )
        owner_ship = normalize_ship(
            _env_first(
                env,
                ("TLON_OWNER_SHIP", "TLON_OWNER"),
                extra,
                ("owner_ship", "owner"),
            )
        )
        bot_mentions = parse_csv(
            _env_or_extra(
                env,
                ("TLON_BOT_MENTIONS",),
                extra,
                ("bot_mentions",),
            )
        )
        free_response_channels = parse_csv(
            _env_or_extra(
                env,
                ("TLON_FREE_RESPONSE_CHANNELS",),
                extra,
                ("free_response_channels",),
            )
        )
        require_mention = parse_bool_default(
            _env_or_extra(
                env,
                ("TLON_REQUIRE_MENTION",),
                extra,
                ("require_mention",),
                "true",
            ),
            True,
        )
        known_bot_users = parse_ship_csv(
            _env_or_extra(
                env,
                ("TLON_KNOWN_BOT_USERS",),
                extra,
                ("known_bot_users",),
            )
        )
        max_consecutive_bot_responses = _parse_strict_non_negative_int(
            _env_or_extra(
                env,
                ("TLON_MAX_CONSECUTIVE_BOT_RESPONSES",),
                extra,
                ("max_consecutive_bot_responses",),
                DEFAULT_MAX_CONSECUTIVE_BOT_RESPONSES,
            ),
            DEFAULT_MAX_CONSECUTIVE_BOT_RESPONSES,
        )
        reply_in_thread = parse_bool(
            _env_or_extra(
                env,
                ("TLON_REPLY_IN_THREAD",),
                extra,
                ("reply_in_thread",),
            )
        )
        hosting = parse_bool(
            _env_or_extra(env, ("TLON_HOSTING",), extra, ("hosting",))
        )
        owner_listen = parse_bool_default(
            _env_or_extra(
                env,
                ("TLON_OWNER_LISTEN",),
                extra,
                ("owner_listen",),
                "true",
            ),
            True,
        )
        owner_listen_default = _env_first(
            env,
            ("TLON_OWNER_LISTEN_DEFAULT",),
            extra,
            ("owner_listen_default",),
            "owned",
        ).lower()
        if owner_listen_default not in ("owned", "all"):
            owner_listen_default = "owned"
        owner_listen_disabled_channels = parse_csv(
            _env_or_extra(
                env,
                ("TLON_OWNER_LISTEN_DISABLED_CHANNELS",),
                extra,
                ("owner_listen_disabled_channels",),
            )
        )
        owner_listen_enabled_channels = parse_csv(
            _env_or_extra(
                env,
                ("TLON_OWNER_LISTEN_ENABLED_CHANNELS",),
                extra,
                ("owner_listen_enabled_channels",),
            )
        )
        context_messages = _parse_non_negative_int(
            _env_or_extra(
                env,
                ("TLON_CONTEXT_MESSAGES",),
                extra,
                ("context_messages",),
                DEFAULT_CONTEXT_MESSAGES,
            ),
            DEFAULT_CONTEXT_MESSAGES,
        )
        telemetry_enabled = parse_bool(
            _env_or_extra(
                env,
                ("TLON_TELEMETRY",),
                extra,
                ("telemetry", "telemetry_enabled"),
            )
        )
        telemetry_api_key = _env_first(
            env,
            ("TLON_TELEMETRY_API_KEY",),
            extra,
            ("telemetry_api_key",),
        )
        telemetry_host = _env_first(
            env,
            ("TLON_TELEMETRY_HOST",),
            extra,
            ("telemetry_host",),
        )
        telemetry_debug = parse_bool(
            _env_or_extra(
                env,
                ("TLON_TELEMETRY_DEBUG",),
                extra,
                ("telemetry_debug",),
            )
        )
        cli = _env_first(env, ("TLON_CLI",), extra, ("cli",), "tlon")
        timeout_raw = _env_first(
            env,
            ("TLON_CLI_TIMEOUT",),
            extra,
            ("cli_timeout",),
            str(DEFAULT_CLI_TIMEOUT_SECONDS),
        )
        try:
            cli_timeout = float(timeout_raw)
        except (TypeError, ValueError):
            cli_timeout = DEFAULT_CLI_TIMEOUT_SECONDS
        gateway_status_enabled = parse_bool_default(
            _env_or_extra(
                env,
                ("TLON_GATEWAY_STATUS", "TLON_GATEWAY_STATUS_ENABLED"),
                extra,
                ("gateway_status", "gateway_status_enabled"),
                "true",
            ),
            True,
        )
        gateway_status_owner = normalize_ship(
            _env_first(
                env,
                ("TLON_GATEWAY_STATUS_OWNER",),
                extra,
                ("gateway_status_owner",),
            )
        )
        gateway_status_heartbeat_seconds = _parse_float(
            _env_or_extra(
                env,
                ("TLON_GATEWAY_STATUS_HEARTBEAT_SECONDS",),
                extra,
                ("gateway_status_heartbeat_seconds",),
                DEFAULT_GATEWAY_HEARTBEAT_SECONDS,
            ),
            DEFAULT_GATEWAY_HEARTBEAT_SECONDS,
        )
        gateway_status_lease_seconds = _parse_float(
            _env_or_extra(
                env,
                ("TLON_GATEWAY_STATUS_LEASE_SECONDS",),
                extra,
                ("gateway_status_lease_seconds",),
                DEFAULT_GATEWAY_LEASE_SECONDS,
            ),
            DEFAULT_GATEWAY_LEASE_SECONDS,
        )
        gateway_status_active_window_seconds = _parse_int(
            _env_or_extra(
                env,
                ("TLON_GATEWAY_STATUS_ACTIVE_WINDOW_SECONDS",),
                extra,
                ("gateway_status_active_window_seconds",),
                DEFAULT_GATEWAY_ACTIVE_WINDOW_SECONDS,
            ),
            DEFAULT_GATEWAY_ACTIVE_WINDOW_SECONDS,
        )
        gateway_status_reply_cooldown_seconds = _parse_int(
            _env_or_extra(
                env,
                ("TLON_GATEWAY_STATUS_REPLY_COOLDOWN_SECONDS",),
                extra,
                ("gateway_status_reply_cooldown_seconds",),
                DEFAULT_GATEWAY_OFFLINE_REPLY_COOLDOWN_SECONDS,
            ),
            DEFAULT_GATEWAY_OFFLINE_REPLY_COOLDOWN_SECONDS,
        )
        reengagement_enabled = parse_bool_default(
            _env_or_extra(
                env,
                ("TLON_REENGAGEMENT_ENABLED",),
                extra,
                ("reengagement_enabled",),
                "false",
            ),
            False,
        )
        nudge_tick_interval_ms = _parse_int(
            _env_or_extra(
                env,
                ("TLON_NUDGE_TICK_INTERVAL_MS",),
                extra,
                ("nudge_tick_interval_ms",),
                DEFAULT_NUDGE_TICK_INTERVAL_MS,
            ),
            DEFAULT_NUDGE_TICK_INTERVAL_MS,
        )
        nudge_active_hours_start = _env_first(
            env,
            ("TLON_NUDGE_ACTIVE_HOURS_START",),
            extra,
            ("nudge_active_hours_start",),
        ) or None
        nudge_active_hours_end = _env_first(
            env,
            ("TLON_NUDGE_ACTIVE_HOURS_END",),
            extra,
            ("nudge_active_hours_end",),
        ) or None
        nudge_active_hours_timezone = _env_first(
            env,
            ("TLON_NUDGE_ACTIVE_HOURS_TIMEZONE",),
            extra,
            ("nudge_active_hours_timezone",),
        ) or None
        user_timezone = _valid_timezone(
            _env_first(env, ("TLON_TIMEZONE",), extra, ("user_timezone",))
        ) or None
        context_lens_enabled = parse_bool(
            _env_or_extra(
                env,
                ("TLON_CONTEXT_LENS", "TLON_CONTEXT_LENS_ENABLED"),
                extra,
                ("context_lens", "context_lens_enabled"),
            )
        )
        context_lens_owner = normalize_ship(
            _env_first(
                env,
                ("TLON_CONTEXT_LENS_OWNER",),
                extra,
                ("context_lens_owner",),
            )
        )
        context_lens_store_path = _env_first(
            env,
            ("TLON_CONTEXT_LENS_STORE_PATH",),
            extra,
            ("context_lens_store_path",),
        )
        sse_read_timeout_seconds = _parse_bounded_float(
            _env_or_extra(
                env,
                ("TLON_SSE_READ_TIMEOUT_SECONDS",),
                extra,
                ("sse_read_timeout_seconds", "sse_read_timeout"),
                DEFAULT_SSE_READ_TIMEOUT_SECONDS,
            ),
            DEFAULT_SSE_READ_TIMEOUT_SECONDS,
            # A sub-second read timeout (or an underflow spelling like 1e-300)
            # would tear the stream down in a reconnect loop.
            1.0,
            MAX_SSE_SECONDS,
        )
        sse_stale_threshold_seconds = _parse_sse_stale_threshold(
            _env_or_extra(
                env,
                ("TLON_SSE_STALE_THRESHOLD_SECONDS",),
                extra,
                ("sse_stale_threshold_seconds",),
                DEFAULT_SSE_STALE_THRESHOLD_SECONDS,
            ),
            DEFAULT_SSE_STALE_THRESHOLD_SECONDS,
        )
        sse_watchdog_interval_seconds = _parse_bounded_float(
            _env_or_extra(
                env,
                ("TLON_SSE_WATCHDOG_INTERVAL_SECONDS",),
                extra,
                ("sse_watchdog_interval_seconds",),
                DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS,
            ),
            DEFAULT_SSE_WATCHDOG_INTERVAL_SECONDS,
            1.0,
            MAX_SSE_SECONDS,
        )
        reaction_level = _env_first(
            env,
            ("TLON_REACTION_LEVEL",),
            extra,
            ("reaction_level",),
            DEFAULT_REACTION_LEVEL,
        ).lower()
        if reaction_level not in REACTION_LEVELS:
            logger.warning(
                "[tlon] invalid TLON_REACTION_LEVEL=%r; using %s",
                reaction_level,
                DEFAULT_REACTION_LEVEL,
            )
            reaction_level = DEFAULT_REACTION_LEVEL

        auto_discover = parse_bool(
            _env_or_extra(env, ("TLON_AUTO_DISCOVER",), extra, ("auto_discover",))
        )
        allow_all_users = parse_bool(
            _env_or_extra(
                env,
                ("TLON_ALLOW_ALL_USERS",),
                extra,
                ("allow_all_users",),
            )
        )

        return cls(
            ship_url=ship_url,
            ship_name=ship_name,
            ship_code=ship_code,
            cookie=cookie,
            channels=channels,
            auto_discover=auto_discover,
            home_channel=home_channel,
            allowed_users=allowed_users,
            dm_allowlist=dm_allowlist,
            group_invite_allowlist=group_invite_allowlist,
            allow_all_users=allow_all_users,
            owner_ship=owner_ship,
            bot_mentions=bot_mentions,
            free_response_channels=free_response_channels,
            require_mention=require_mention,
            known_bot_users=known_bot_users,
            max_consecutive_bot_responses=max_consecutive_bot_responses,
            reply_in_thread=reply_in_thread,
            hosting=hosting,
            owner_listen=owner_listen,
            owner_listen_default=owner_listen_default,
            owner_listen_disabled_channels=owner_listen_disabled_channels,
            owner_listen_enabled_channels=owner_listen_enabled_channels,
            context_messages=context_messages,
            telemetry_enabled=telemetry_enabled,
            telemetry_api_key=telemetry_api_key,
            telemetry_host=telemetry_host,
            telemetry_debug=telemetry_debug,
            cli=cli,
            cli_timeout=cli_timeout,
            gateway_status_enabled=gateway_status_enabled,
            gateway_status_owner=gateway_status_owner,
            gateway_status_heartbeat_seconds=gateway_status_heartbeat_seconds,
            gateway_status_lease_seconds=gateway_status_lease_seconds,
            gateway_status_active_window_seconds=gateway_status_active_window_seconds,
            gateway_status_reply_cooldown_seconds=gateway_status_reply_cooldown_seconds,
            reengagement_enabled=reengagement_enabled,
            nudge_tick_interval_ms=nudge_tick_interval_ms,
            nudge_active_hours_start=nudge_active_hours_start,
            nudge_active_hours_end=nudge_active_hours_end,
            nudge_active_hours_timezone=nudge_active_hours_timezone,
            user_timezone=user_timezone,
            context_lens_enabled=context_lens_enabled,
            context_lens_owner=context_lens_owner,
            context_lens_store_path=context_lens_store_path,
            sse_read_timeout_seconds=sse_read_timeout_seconds,
            sse_stale_threshold_seconds=sse_stale_threshold_seconds,
            sse_watchdog_interval_seconds=sse_watchdog_interval_seconds,
            reaction_level=reaction_level,
        )

    def is_complete(self) -> bool:
        return bool(self.ship_url and self.ship_name and (self.ship_code or self.cookie))

    def cli_env(self, base: Mapping[str, str] | None = None) -> dict[str, str]:
        env = dict(base or os.environ)
        for key in (
            "TLON_CONFIG_FILE",
            "URBIT_COOKIE",
            "TLON_COOKIE",
            "URBIT_URL",
            "TLON_URL",
            "URBIT_SHIP",
            "TLON_SHIP",
            "URBIT_CODE",
            "TLON_CODE",
        ):
            env.pop(key, None)
        if self.ship_url:
            env["TLON_NODE_URL"] = self.ship_url
            env["TLON_SHIP_URL"] = self.ship_url
            env["TLON_URL"] = self.ship_url
            env["URBIT_URL"] = self.ship_url
        if self.ship_name:
            env["TLON_NODE_ID"] = self.ship_name
            env["TLON_SHIP_NAME"] = self.ship_name
            env["TLON_SHIP"] = self.ship_name
            env["URBIT_SHIP"] = self.ship_name
        if self.ship_code:
            env["TLON_ACCESS_CODE"] = self.ship_code
            env["TLON_SHIP_CODE"] = self.ship_code
            env["TLON_CODE"] = self.ship_code
            env["URBIT_CODE"] = self.ship_code
        if self.cookie:
            env["TLON_COOKIE"] = self.cookie
            env["URBIT_COOKIE"] = self.cookie
        # Explicitly carry the hosted-upload flag into the subprocess. The
        # ambient env does not reach the model-tool subprocess, so injecting it
        # from the config field (resolved where the env is present) is the only
        # reliable channel — same pattern as the creds above.
        if self.hosting:
            env["TLON_HOSTING"] = "true"
        return env

    def user_allowed(self, ship: str, *, is_dm: bool = False) -> bool:
        """Deny by default: only the owner, configured allowlists, or the
        explicit allow-all override authorize a ship. Settings-store grants
        (approved DMs, channel rules) are layered on by the adapter."""
        ship = normalize_ship(ship)
        if not ship:
            return False
        if self.allow_all_users:
            return True
        if self.owner_ship and ship == self.owner_ship:
            return True
        if ship in self.allowed_users:
            return True
        if is_dm and self.dm_allowlist and ship in self.dm_allowlist:
            return True
        return False

    def group_free_response_allowed(self) -> bool:
        return bool(self.allow_all_users or self.owner_ship or self.allowed_users)

    def group_free_response_enabled(self, channel_nest: str) -> bool:
        if not self.group_free_response_allowed():
            return False
        return not self.require_mention or channel_nest in self.free_response_channels

    def default_home_channel_id(self) -> str:
        return self.home_channel or self.owner_ship or self.gateway_status_owner

    def gateway_status_owner_ship(self) -> str:
        return self.gateway_status_owner or self.owner_ship

    def context_lens_owner_ship(self) -> str:
        return self.context_lens_owner or self.owner_ship


@dataclass(frozen=True)
class TlonProcessResult:
    returncode: int
    stdout: str = ""
    stderr: str = ""


@dataclass(frozen=True)
class TlonSendResult:
    success: bool
    command: tuple[str, ...]
    stdout: str = ""
    stderr: str = ""
    returncode: int = 0
    message_id: Optional[str] = None
    error: Optional[str] = None
    timed_out: bool = False


class TlonProcessTimeout(asyncio.TimeoutError):
    """A killed CLI process with the output captured before termination."""

    def __init__(self, stdout: str = "", stderr: str = "") -> None:
        super().__init__()
        self.stdout = stdout
        self.stderr = stderr


@dataclass(frozen=True)
class TlonDeadlineOutput:
    stdout: str
    stderr: str


TlonDeadlineCallback = Callable[[TlonDeadlineOutput], Awaitable[None]]
CommandRunner = Callable[
    [
        Sequence[str],
        Mapping[str, str],
        float,
        Optional[TlonDeadlineCallback],
    ],
    Awaitable[TlonProcessResult],
]

# Called after every CLI invocation with (args, duration_ms, result).
CliObserver = Callable[[Sequence[str], int, "TlonSendResult"], None]

# `posts|dms send|reply`: the CLI invocations that author a message, and so the
# ones that take the bot-author flags.
SEND_OPERATIONS = frozenset(
    {
        ("posts", "send"),
        ("posts", "reply"),
        ("dms", "send"),
        ("dms", "reply"),
    }
)

CREDENTIAL_FLAGS_WITH_VALUE = frozenset(
    {"--config", "--url", "--ship", "--code", "--cookie"}
)


def find_subcommand_index(args: Sequence[str]) -> int:
    """Index of the command family, skipping leading global credential flags."""
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


# The adapter is git-refreshed on every container start while the `tlon` CLI is
# a baked image binary, so a newer adapter routinely runs against a CLI that
# does not know the bot-author flags. That CLI would fold `--bot` into the
# message text, so capability is probed once per CLI instance off its own help
# output (cheap, no network, no credentials) and decoration is skipped when the
# flag is absent — degrading to bare-ship authors rather than corrupting sends.
BOT_FLAG_PROBE_ARGS = ("posts", "send", "--help")
# The probe prints local help, so seconds are already generous. The cap exists
# so a hung CLI cannot spend the caller's whole timeout before the real command
# starts: the send that pays for it is delayed by at most this, once per
# process, instead of being doubled. Deliberately a flat cap and not a deduction
# from the caller's budget — billing it back means bounding the wait on another
# task's in-flight probe too, and that lock-and-deadline bookkeeping is more
# failure-prone than the doubling it prevents.
BOT_FLAG_PROBE_TIMEOUT_SECONDS = 5.0
BOT_FLAG = "--bot"
# `--bot` as its own token: bracketed/comma'd in usage lines, but never matched
# inside a longer flag such as `--bottle`, which says nothing about `--bot`.
_BOT_FLAG_TOKEN = re.compile(r"(?<![\w-])--bot(?![\w-])")


def _is_bot_flag_token(arg: str) -> bool:
    """`--bot` and the joined form the CLI rejects as a usage error. Both have
    to be recognized here: an older CLI has no bot-flag parser to reject them,
    so anything left behind is folded into the outbound message instead."""
    return arg == BOT_FLAG or arg.startswith(f"{BOT_FLAG}=")


def _without_bot_flags(args: Sequence[str]) -> tuple[str, ...]:
    """Strip bot-flag syntax for a CLI that cannot parse it. `--bot` takes no
    value, so a bare token following it is a stray the caller mistyped, not
    message text — leaving it behind would post it."""
    kept: list[str] = []
    skip_next_bare = False
    for arg in args:
        if _is_bot_flag_token(arg):
            skip_next_bare = arg == BOT_FLAG
            continue
        if skip_next_bare and not arg.startswith("--"):
            skip_next_bare = False
            continue
        skip_next_bare = False
        kept.append(arg)
    return tuple(kept)


class TlonCLI:
    def __init__(
        self,
        config: TlonConfig,
        *,
        runner: CommandRunner | None = None,
        observer: CliObserver | None = None,
        as_bot: bool = False,
    ) -> None:
        self.config = config
        self._runner = runner or self._run_subprocess
        self._observer = observer
        self.as_bot = as_bot
        self._bot_flags_supported: bool | None = None
        # Created on first use so the lock binds to the loop that probes.
        self._bot_flag_probe_lock: asyncio.Lock | None = None

    def _bot_flags(self) -> list[str]:
        # Bare `--bot` only: display names come from contact sync, so the CLI
        # takes no per-message profile values.
        return [BOT_FLAG]

    async def _supports_bot_flags(self) -> bool:
        """Whether the installed CLI knows the bot-author flags. Probed once per
        instance; an unsupported or unreachable CLI degrades to undecorated
        sends (bare-ship authors) rather than posting `--bot` as message text.
        A probe that outruns the cap is one of those unreachable CLIs."""
        if self._bot_flags_supported is not None:
            return self._bot_flags_supported

        if self._bot_flag_probe_lock is None:
            self._bot_flag_probe_lock = asyncio.Lock()
        async with self._bot_flag_probe_lock:
            # Concurrent first sends queue here; the winner's answer serves all
            # of them, so the CLI is probed — and the error logged — only once.
            if self._bot_flags_supported is not None:
                return self._bot_flags_supported

            # Unobserved so a help invocation never lands in CLI telemetry.
            result = await self._run_unobserved(
                BOT_FLAG_PROBE_ARGS, timeout=BOT_FLAG_PROBE_TIMEOUT_SECONDS
            )
            # A probe that did not run cleanly says nothing about support: only
            # a successful help listing `--bot` as its own token counts.
            supported = bool(result.success) and bool(
                _BOT_FLAG_TOKEN.search(f"{result.stdout}\n{result.stderr}")
            )
            self._bot_flags_supported = supported
            if not supported:
                logger.error(
                    "[tlon] installed tlon CLI (%s) does not support %s "
                    "(probe rc=%s) — sending with bare ship authors, so "
                    "messages will NOT carry the bot profile or render the Bot "
                    "tag. Rebuild the image with a tlon CLI that has the "
                    "bot-author flags.",
                    self.config.cli,
                    BOT_FLAG,
                    result.returncode,
                )
            return supported

    async def _decorate(self, args: Sequence[str]) -> tuple[str, ...]:
        """Append the bot-author flags to every message-authoring invocation.
        Centralized here so raw `run_command` tuples are covered too; the flags
        are registered CLI options, so trailing them never eats message text."""
        if not self.as_bot:
            return tuple(args)
        idx = find_subcommand_index(args)
        if idx < 0 or idx + 1 >= len(args):
            return tuple(args)
        if (args[idx], args[idx + 1]) not in SEND_OPERATIONS:
            return tuple(args)
        # Probed only here, so non-send usage never pays for it.
        supported = await self._supports_bot_flags()
        # A caller that already passed the flag has said what decoration would
        # say, so appending is skipped: `--bot --bot` is a repeat the CLI
        # rejects, failing a send the model asked for correctly. The probe still
        # gates it, because a CLI without the flag has no option to consume it
        # and folds the token into the message body instead — passing a caller's
        # flag through unprobed would corrupt the post rather than degrade it.
        if any(_is_bot_flag_token(arg) for arg in args):
            return tuple(args) if supported else _without_bot_flags(args)
        if not supported:
            return tuple(args)
        return (*args, *self._bot_flags())

    async def send_message(
        self,
        chat_id: str,
        text: str,
        *,
        blob: str | None = None,
        sent_at: int | None = None,
    ) -> TlonSendResult:
        args: list[str] = ["posts", "send", chat_id, text]
        if blob:
            args.extend(["--blob", blob])
        if sent_at is not None:
            args.extend(["--sent-at", str(sent_at)])
        return await self._run(tuple(args))

    async def send_reply(
        self,
        chat_id: str,
        post_id: str,
        text: str,
        *,
        parent_author: str | None = None,
        blob: str | None = None,
        sent_at: int | None = None,
    ) -> TlonSendResult:
        args: list[str] = ["posts", "reply", chat_id, post_id, text]
        if parent_author:
            args.extend(["--author", normalize_ship(parent_author)])
        if blob:
            args.extend(["--blob", blob])
        if sent_at is not None:
            args.extend(["--sent-at", str(sent_at)])
        return await self._run(tuple(args))

    async def run_command(
        self,
        args: Sequence[str],
        *,
        timeout: float | None = None,
        on_deadline: TlonDeadlineCallback | None = None,
    ) -> TlonSendResult:
        return await self._run(
            tuple(args), timeout=timeout, on_deadline=on_deadline
        )

    async def _run(
        self,
        args: Sequence[str],
        *,
        timeout: float | None = None,
        on_deadline: TlonDeadlineCallback | None = None,
    ) -> TlonSendResult:
        args = await self._decorate(args)
        # Timed after decoration so the one-time capability probe is not
        # reported as this invocation's latency.
        started = time.monotonic()
        result = await self._run_unobserved(
            args, timeout=timeout, on_deadline=on_deadline
        )
        if self._observer is not None:
            try:
                self._observer(args, int((time.monotonic() - started) * 1000), result)
            except Exception as exc:
                logger.debug("[tlon] CLI observer failed: %s", exc)
        return result

    async def _run_unobserved(
        self,
        args: Sequence[str],
        *,
        timeout: float | None = None,
        on_deadline: TlonDeadlineCallback | None = None,
    ) -> TlonSendResult:
        command = (self.config.cli, *args)
        effective_timeout = (
            self.config.cli_timeout if timeout is None else float(timeout)
        )
        try:
            proc = await self._runner(
                command,
                self.config.cli_env(),
                effective_timeout,
                on_deadline,
            )
        except asyncio.TimeoutError as exc:
            return TlonSendResult(
                success=False,
                command=command,
                stdout=str(getattr(exc, "stdout", "") or ""),
                stderr=str(getattr(exc, "stderr", "") or ""),
                error=f"tlon CLI timed out after {effective_timeout:g}s",
                returncode=124,
                timed_out=True,
            )
        except FileNotFoundError:
            return TlonSendResult(
                success=False,
                command=command,
                error=f"tlon CLI not found: {self.config.cli}",
                returncode=127,
            )
        except Exception as exc:
            return TlonSendResult(
                success=False,
                command=command,
                error=f"tlon CLI failed: {exc}",
                returncode=1,
            )

        message_id = self._extract_message_id(proc.stdout)
        if proc.returncode != 0:
            return TlonSendResult(
                success=False,
                command=command,
                stdout=proc.stdout,
                stderr=proc.stderr,
                returncode=proc.returncode,
                error=proc.stderr.strip() or proc.stdout.strip() or "tlon CLI failed",
            )
        return TlonSendResult(
            success=True,
            command=command,
            stdout=proc.stdout,
            stderr=proc.stderr,
            returncode=proc.returncode,
            message_id=message_id,
        )

    @staticmethod
    async def _run_subprocess(
        command: Sequence[str],
        env: Mapping[str, str],
        timeout: float,
        on_deadline: TlonDeadlineCallback | None = None,
    ) -> TlonProcessResult:
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=dict(env),
        )
        assert proc.stdout is not None
        assert proc.stderr is not None
        stdout_buffer = bytearray()
        stderr_buffer = bytearray()

        async def drain(
            stream: asyncio.StreamReader, buffer: bytearray
        ) -> None:
            while True:
                chunk = await stream.read(64 * 1024)
                if not chunk:
                    return
                buffer.extend(chunk)

        def decode(buffer: bytearray) -> str:
            return bytes(buffer).decode("utf-8", errors="replace")

        stdout_task = asyncio.create_task(drain(proc.stdout, stdout_buffer))
        stderr_task = asyncio.create_task(drain(proc.stderr, stderr_buffer))
        wait_task = asyncio.create_task(proc.wait())
        try:
            await asyncio.wait_for(asyncio.shield(wait_task), timeout=timeout)
        except asyncio.TimeoutError:
            if on_deadline is not None:
                try:
                    await on_deadline(
                        TlonDeadlineOutput(
                            stdout=decode(stdout_buffer),
                            stderr=decode(stderr_buffer),
                        )
                    )
                except Exception:
                    logger.exception("[tlon] CLI deadline callback failed")
                await wait_task
            else:
                proc.kill()
                await wait_task
                await asyncio.gather(stdout_task, stderr_task)
                raise TlonProcessTimeout(
                    decode(stdout_buffer),
                    decode(stderr_buffer),
                )
        await asyncio.gather(stdout_task, stderr_task)
        return TlonProcessResult(
            returncode=proc.returncode or 0,
            stdout=decode(stdout_buffer),
            stderr=decode(stderr_buffer),
        )

    @staticmethod
    def _extract_message_id(stdout: str) -> Optional[str]:
        match = re.search(r"\b(?:postId|replyId|messageId)=([^\s]+)", stdout or "")
        return match.group(1) if match else None


@dataclass(frozen=True)
class TlonSSEEvent:
    app: str
    path: str
    subscription_id: Optional[int]
    event_id: Optional[int]
    json: Any
    raw: dict[str, Any]


class TlonAuthError(ConnectionError):
    """The ship rejected our credentials (bad access code) — unrecoverable."""


class TlonChannelError(ConnectionError):
    """The Eyre channel or one of its subscriptions is gone; the caller must
    rebuild the channel rather than resume it.

    `status` is the HTTP status when the fault came from the channel GET, and
    None when it came from a subscription nack/quit.
    """

    def __init__(self, message: str, *, status: Optional[int] = None) -> None:
        super().__init__(message)
        self.status = status


class TlonStreamStaleError(ConnectionError):
    """The stream watchdog judged the channel stale; the caller should resume
    the same channel rather than rebuild it."""


class TlonSSEClient:
    """Eyre SSE channel client for subscriptions."""

    def __init__(self, config: TlonConfig, *, reap_detection: bool = False) -> None:
        self.config = config
        self.url = config.ship_url.rstrip("/")
        self.ship = normalize_ship(config.ship_name)
        self.channel_id: Optional[str] = None
        self.channel_url: Optional[str] = None
        self._session: Any = None
        self._action_counter = 0
        self._subscriptions: dict[int, tuple[str, str]] = {}
        # Optional subscriptions may be unavailable (e.g. an agent that isn't
        # installed). Their nacks/quits are logged and skipped rather than
        # raised, so one dead optional sub can't tear down the whole stream.
        self._optional_subscriptions: set[int] = set()
        self._last_heard_event_id = -1
        self._last_acked_event_id = -1
        self._ack_threshold = 20
        # Reap/revival detection is opt-in: gateway-status, lens, and presence
        # use poke-only clients that never consume events(), and their ledgers
        # would grow to the cap with no consumer to drain or act on them.
        self._reap_detection = reap_detection
        self._last_confirmed_ack_event_id = -1
        self._confirmed_floor_at_stream_bind = -1
        self._action_floors: dict[int, int] = {}
        self._genesis_action_id: Optional[int] = None
        self._last_event_frame_at: Optional[float] = None
        self._stream_bound = False
        self._condemned: Optional[BaseException] = None
        self._closed = False
        self._ack_tasks: set[asyncio.Task] = set()

    @property
    def last_heard_event_id(self) -> int:
        return self._last_heard_event_id

    @property
    def last_event_frame_at(self) -> Optional[float]:
        return self._last_event_frame_at

    @property
    def stream_bound(self) -> bool:
        return self._stream_bound

    async def authenticate(self) -> str:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        import aiohttp

        if self._session is None:
            self._session = aiohttp.ClientSession()

        if self.config.cookie:
            self._session.cookie_jar.update_cookies(
                self._cookie_mapping(self.config.cookie)
            )
            return self.config.cookie

        async with self._session.post(
            f"{self.url}/~/login",
            data={"password": self.config.ship_code},
            allow_redirects=False,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status in (400, 401, 403):
                # The ship rejected the access code itself — retrying with the
                # same credentials can never succeed (5xx / timeouts stay
                # transient: the ship may just be down).
                raise TlonAuthError(f"Tlon auth rejected: HTTP {resp.status}")
            if resp.status not in (200, 204, 302, 303, 307):
                raise ConnectionError(f"Tlon auth failed: HTTP {resp.status}")
            cookie = resp.headers.get("set-cookie", "")
            if not cookie:
                for item in self._session.cookie_jar:
                    if item.key.startswith("urbauth"):
                        cookie = f"{item.key}={item.value}"
                        break
            if not cookie:
                raise ConnectionError("Tlon auth did not return an urbauth cookie")
            return cookie

    async def open(self) -> None:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        if self._session is None:
            await self.authenticate()
        self.channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
        self.channel_url = f"{self.url}/~/channel/{self.channel_id}"
        self._last_heard_event_id = -1
        self._last_acked_event_id = -1
        self._subscriptions.clear()
        self._optional_subscriptions.clear()
        self._last_confirmed_ack_event_id = -1
        self._confirmed_floor_at_stream_bind = -1
        self._action_floors.clear()
        self._genesis_action_id = None
        self._last_event_frame_at = None
        action_id = self._next_action_id()
        # Every path to a fresh channel goes through open() first, so on a
        # healthy generation event 0 is always this helm-hi's ack; any other
        # action acked at event 0 on a virgin cursor proves the channel was
        # silently re-created by that action's PUT.
        self._genesis_action_id = action_id
        self._record_action_floor(action_id)
        await self._send_actions(
            [
                {
                    "id": action_id,
                    "action": "poke",
                    "ship": bare_ship(self.ship),
                    "app": "hood",
                    "mark": "helm-hi",
                    "json": "Opening Hermes Tlon channel",
                }
            ]
        )

    async def subscribe(self, app: str, path: str, *, optional: bool = False) -> int:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        if self.channel_url is None:
            await self.open()
        sub_id = self._next_action_id()
        self._subscriptions[sub_id] = (app, path)
        if optional:
            self._optional_subscriptions.add(sub_id)
        self._record_action_floor(sub_id)
        await self._send_actions(
            [
                {
                    "id": sub_id,
                    "action": "subscribe",
                    "ship": bare_ship(self.ship),
                    "app": app,
                    "path": path,
                }
            ]
        )
        return sub_id

    async def poke(self, app: str, mark: str, json_payload: Any) -> int:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        if self.channel_url is None:
            await self.open()
        poke_id = self._next_action_id()
        self._record_action_floor(poke_id)
        await self._send_actions(
            [
                {
                    "id": poke_id,
                    "action": "poke",
                    "ship": bare_ship(self.ship),
                    "app": app,
                    "mark": mark,
                    "json": json_payload,
                }
            ]
        )
        return poke_id

    async def scry(self, path: str) -> Any:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        import aiohttp

        if self._session is None:
            await self.authenticate()

        full_path = str(path or "").strip()
        if full_path.startswith("/~/scry/"):
            full_path = full_path[len("/~/scry") :]
        elif full_path.startswith("~/scry/"):
            full_path = "/" + full_path[len("~/scry/") :]
        if not full_path.startswith("/"):
            full_path = f"/{full_path}"
        if not full_path.endswith(".json"):
            full_path = f"{full_path}.json"

        assert self._session is not None
        async with self._session.get(
            f"{self.url}/~/scry{full_path}",
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise ConnectionError(f"Tlon scry failed: HTTP {resp.status} {text[:200]}")
            return await resp.json()

    async def events(
        self, *, on_open: Optional[Callable[[], None]] = None
    ) -> AsyncIterator[TlonSSEEvent]:
        if self._closed:
            raise ConnectionError("Tlon SSE client closed")
        import aiohttp

        if self.channel_url is None:
            await self.open()
        assert self._session is not None
        assert self.channel_url is not None

        headers = {"Accept": "text/event-stream"}
        if self._last_heard_event_id >= 0:
            headers["Last-Event-ID"] = str(self._last_heard_event_id)
        # Snapshot the confirmed-ack floor immediately before the GET, not
        # after the 200: Eyre binds the replay before pruning, so an ack
        # confirmed during the handshake may legitimately reappear in it.
        self._confirmed_floor_at_stream_bind = self._last_confirmed_ack_event_id
        read_timeout = self.config.sse_read_timeout_seconds
        stale_threshold = self.config.sse_stale_threshold_seconds
        if stale_threshold > 0:
            # A totally silent socket must fault within the stale threshold
            # even when the read-timeout knob was raised above it (the
            # in-band condemn latch needs payloads to raise); floored at the
            # keepalive interval so a small threshold cannot tear down a
            # healthy stream between keepalives.
            read_timeout = min(
                read_timeout, max(stale_threshold, KEEPALIVE_SAFE_SECONDS)
            )
        async with self._session.get(
            self.channel_url,
            headers=headers,
            timeout=aiohttp.ClientTimeout(
                total=None,
                sock_read=read_timeout,
                connect=60,
            ),
        ) as resp:
            if resp.status in (404, 410):
                # _send_actions already treats 404/410 as a stale, reaped
                # channel; the SSE GET must agree, or a 410 would be
                # classified as a resumable transport fault and the adapter
                # would re-GET a dead channel forever.
                raise TlonChannelError("Tlon channel reaped", status=resp.status)
            if resp.status in (401, 403):
                raise TlonChannelError(
                    f"Tlon channel unauthorized: HTTP {resp.status}", status=resp.status
                )
            if resp.status == 500:
                # Eyre answers 500 for a channel it can no longer serve.
                # Resuming would re-GET the same dead channel forever, leaving
                # the bot deaf; @tloncorp/api's client resets the channel on
                # this status too (packages/api/src/http-api/Urbit.ts:491-494).
                # Raise before touching the body: a stalled or truncated 500
                # body would make resp.text() raise a non-channel error, which
                # falls through to the resume path and defeats the recovery.
                raise TlonChannelError("Tlon SSE failed: HTTP 500", status=500)
            if resp.status != 200:
                text = await resp.text()
                raise ConnectionError(f"Tlon SSE failed: HTTP {resp.status} {text[:200]}")
            self._stream_bound = True
            # Liveness baseline: without it, the first watchdog tick after a
            # resume following a long outage would condemn a healthy stream
            # off the ancient pre-outage timestamp.
            self._last_event_frame_at = time.monotonic()
            if isinstance(self._condemned, TlonStreamStaleError):
                # A stale condemnation demands a resume; this successful
                # re-bind IS that resume (the stream may have EOF'd and
                # reconnected on its own first). Raising it now would tear
                # down the recovered stream. Rebuild condemnations
                # (TlonChannelError) deliberately survive the bind.
                self._condemned = None
            try:
                opened = False
                buffer = ""
                async for chunk in resp.content.iter_any():
                    buffer += chunk.decode("utf-8", errors="replace")
                    while "\n\n" in buffer:
                        payload, buffer = buffer.split("\n\n", 1)
                        event = await self._parse_sse_payload(payload)
                        if not opened:
                            # Established only once the body demonstrably
                            # delivers (keepalives count): a 200 that EOFs
                            # with zero payloads must escalate backoff, not
                            # reset it.
                            opened = True
                            if on_open is not None:
                                on_open()
                        if event is not None:
                            yield event
                raise ConnectionError("Tlon SSE stream ended")
            finally:
                self._stream_bound = False

    async def close(self, *, graceful: bool = True) -> None:
        self._closed = True
        if self._ack_tasks:
            # An unretained task is garbage-collectable mid-flight; ack
            # success feeds the detection floor, so drain them here.
            tasks = list(self._ack_tasks)
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
        if graceful and self._session is not None and self.channel_url is not None:
            try:
                actions = [
                    {
                        "id": self._next_action_id(),
                        "action": "unsubscribe",
                        "subscription": sub_id,
                    }
                    for sub_id in self._subscriptions
                ]
                if actions:
                    await self._send_actions(actions)
            except Exception:
                pass
            try:
                import aiohttp

                await self._session.delete(
                    self.channel_url,
                    timeout=aiohttp.ClientTimeout(total=5),
                )
            except Exception:
                pass
        if self._session is not None:
            await self._session.close()
        self._session = None
        self.channel_url = None
        self.channel_id = None

    async def _send_actions(self, actions: list[dict[str, Any]]) -> None:
        import aiohttp

        if self.channel_url is None:
            await self.open()
        assert self._session is not None
        async with self._session.put(
            self.channel_url,
            json=actions,
            headers={"Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status not in (200, 204):
                status = resp.status
                # A malformed or unauthorized client action will not recover
                # by replaying it.  A 404/410 can be a stale, reaped channel
                # URL and recover after reconnect; rate limits,
                # request-timeout/too-early responses, server errors, and
                # other non-4xx responses may also recover.
                #
                # Classify from the status alone, BEFORE touching the body: a
                # stalled/truncated rejection body would otherwise make
                # resp.text() raise, downgrading a terminal 401/403 to a generic
                # error and defeating the fixed-cookie fatal handling upstream.
                terminal = 400 <= status < 500 and status not in (404, 408, 410, 425, 429)
                try:
                    text = await resp.text()
                except Exception:
                    text = ""
                message = f"Tlon channel action failed: HTTP {status} {text[:200]}"
                if terminal:
                    raise TlonTerminalActionError(message, status=status)
                raise ConnectionError(message)

    def condemn(self, exc: BaseException) -> None:
        # A rebuild condemnation (TlonChannelError) outranks a resume one
        # (TlonStreamStaleError) and is never downgraded; the latch is
        # consumed only when raised, never cleared at bind, so it survives an
        # interleaved fault/resume cycle.
        if self._condemned is None or (
            isinstance(exc, TlonChannelError)
            and not isinstance(self._condemned, TlonChannelError)
        ):
            self._condemned = exc

    def _record_action_floor(self, action_id: int) -> None:
        if not self._reap_detection:
            return
        if len(self._action_floors) >= ACTION_FLOOR_CAP:
            # Fail closed: an untracked action must not be the undetectable
            # reviving one — the forced rebuild clears the world. The action
            # itself still sends.
            logger.error(
                "[tlon] action-floor ledger full (%d); forcing channel rebuild",
                ACTION_FLOOR_CAP,
            )
            self.condemn(
                TlonChannelError(
                    "Tlon action-floor ledger full; forcing channel rebuild"
                )
            )
            return
        # Set-only-if-absent so a same-id retry can't overwrite the original
        # floor. A failed PUT keeps its entry: delivery is ambiguous, and the
        # action may have landed and revived a reaped channel.
        self._action_floors.setdefault(action_id, self._last_heard_event_id)

    async def _parse_sse_payload(self, payload: str) -> Optional[TlonSSEEvent]:
        if isinstance(self._condemned, TlonChannelError):
            exc, self._condemned = self._condemned, None
            raise exc

        event_id: Optional[int] = None
        data_parts: list[str] = []
        for line in payload.splitlines():
            if line.startswith("id:"):
                raw_id = line.split(":", 1)[1].strip()
                # Strict ASCII digits: int() also accepts signs, underscores,
                # and unicode digits, and a malformed id must not be able to
                # fake a regression against the detection floors. The length
                # bound matters too: CPython's int-str conversion limit makes
                # int() RAISE on ~4300+ digit strings that pass isdigit(),
                # and that ValueError would kill the stream in a resume loop
                # that replays the same frame forever.
                event_id = (
                    int(raw_id)
                    if raw_id.isascii() and raw_id.isdigit() and len(raw_id) <= 18
                    else None
                )
            elif line.startswith("data:"):
                data_parts.append(line.split(":", 1)[1].lstrip())

        if event_id is not None or data_parts:
            # Event frames only — a keepalive-only payload must not quiet the
            # staleness clock (deliberate divergence from OpenClaw, whose
            # clock is keepalive-fed and therefore cannot see an
            # alive-but-eventless stream).
            self._last_event_frame_at = time.monotonic()

        if (
            self._reap_detection
            and event_id is not None
            and self._confirmed_floor_at_stream_bind >= 0
            and event_id <= self._confirmed_floor_at_stream_bind
        ):
            raise TlonChannelError(
                f"Tlon event-id regression (heard {event_id}, confirmed floor "
                f"{self._confirmed_floor_at_stream_bind}): channel silently recreated"
            )

        raw: Any = None
        if data_parts:
            try:
                raw = json.loads("\n".join(data_parts))
            except json.JSONDecodeError:
                raw = None

        if (
            self._reap_detection
            and event_id is not None
            and isinstance(raw, dict)
            and raw.get("response") in ("poke", "subscribe")
        ):
            action_id = raw.get("id")
            # type() (not isinstance) so a JSON boolean cannot pose as an id.
            if type(action_id) is int:
                floor = self._action_floors.get(action_id)
                if floor is not None and event_id <= floor:
                    raise TlonChannelError(
                        f"Tlon action ack regressed (event {event_id} <= floor "
                        f"{floor}): channel silently recreated"
                    )
                if (
                    event_id == 0
                    and self._last_heard_event_id == -1
                    and action_id != self._genesis_action_id
                ):
                    raise TlonChannelError(
                        "Tlon non-genesis action acked at event 0 on a virgin "
                        "cursor: channel silently recreated"
                    )
                # The generation is proven for this action — resolve its entry
                # whether the frame is an ack or a nack.
                self._action_floors.pop(action_id, None)

        if self._condemned is not None:
            # A held resume condemnation raises only after the detectors: this
            # frame may carry rebuild evidence, and rebuild outranks resume.
            # Raising before the cursor advance is lossless — the frame was
            # not acked, so the resume GET redelivers it.
            exc, self._condemned = self._condemned, None
            raise exc

        if event_id is not None:
            if event_id <= self._last_heard_event_id:
                return None
            self._last_heard_event_id = event_id
            if event_id - self._last_acked_event_id > self._ack_threshold:
                self._last_acked_event_id = event_id
                task = asyncio.create_task(self._ack(event_id))
                self._ack_tasks.add(task)
                task.add_done_callback(self._ack_tasks.discard)

        if raw is None:
            return None

        response = raw.get("response")
        sub_id = raw.get("id")
        if not isinstance(sub_id, int):
            sub_id = None

        if response == "subscribe":
            if sub_id in self._subscriptions and "err" in raw:
                app, path = self._subscriptions[sub_id]
                if sub_id in self._optional_subscriptions:
                    logger.warning(
                        "[tlon] optional subscription unavailable for %s %s: %s",
                        app,
                        path,
                        str(raw.get("err"))[:200],
                    )
                    self._subscriptions.pop(sub_id, None)
                    self._optional_subscriptions.discard(sub_id)
                    return None
                raise TlonChannelError(
                    f"Tlon subscription failed for {app} {path}: {str(raw.get('err'))[:200]}"
                )
            return None

        if response == "quit":
            if sub_id in self._subscriptions:
                app, path = self._subscriptions[sub_id]
                # `optional` only suppresses the *initial* unavailability (the
                # subscribe-nack branch above). A quit means the subscription
                # WAS established and has now dropped (e.g. an agent/desk
                # reload), so force the reconnect path to re-subscribe rather
                # than silently going deaf to future facts.
                raise TlonChannelError(f"Tlon subscription quit for {app} {path}")
            return None

        if response == "poke":
            # Pokes are fire-and-forget on the HTTP layer; the ack/nack arrives
            # here. A nack means the agent REJECTED the poke (e.g. a settings
            # value the mark cannot represent) — surface it loudly instead of
            # letting "successful" writes silently vanish.
            if "err" in raw:
                logger.warning(
                    "[tlon] poke nacked (id=%s): %s",
                    sub_id,
                    str(raw.get("err"))[:300],
                )
            return None

        if response != "diff":
            return None

        payload_json = raw.get("json")
        if payload_json is None:
            return None

        app, path = self._subscriptions.get(sub_id, ("", ""))
        return TlonSSEEvent(
            app=app,
            path=path,
            subscription_id=sub_id if isinstance(sub_id, int) else None,
            event_id=event_id,
            json=payload_json,
            raw=raw,
        )

    async def _ack(self, event_id: int) -> None:
        channel_url = self.channel_url
        try:
            await self._send_actions(
                [
                    {
                        "id": self._next_action_id(),
                        "action": "ack",
                        "event-id": event_id,
                    }
                ]
            )
        except Exception as exc:
            logger.debug("[tlon] SSE ack failed: %s", exc)
            return
        # Only a confirmed-ok ack advances the regression floor, and a stale
        # ack from a pre-rebuild channel must not repopulate it.
        if (
            self._reap_detection
            and channel_url is not None
            and self.channel_url == channel_url
        ):
            self._last_confirmed_ack_event_id = max(
                self._last_confirmed_ack_event_id, event_id
            )

    def _next_action_id(self) -> int:
        self._action_counter += 1
        return self._action_counter

    @staticmethod
    def _cookie_mapping(cookie: str) -> dict[str, str]:
        name, _, value = cookie.partition("=")
        if not name or not value:
            return {}
        return {name.strip(): value.split(";", 1)[0].strip()}


ClientFactory = Callable[[TlonConfig], TlonSSEClient]


class TlonGatewayStatus:
    """Heartbeat bridge for the desk %steward agent's gateway module."""

    def __init__(
        self,
        config: TlonConfig,
        *,
        client_factory: ClientFactory = TlonSSEClient,
        on_error: Callable[[str, BaseException], None] | None = None,
    ) -> None:
        self.config = config
        self.owner = config.gateway_status_owner_ship()
        self.boot_id = f"hermes-{uuid.uuid4()}"
        self._client_factory = client_factory
        self._client: Optional[TlonSSEClient] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._active = False
        self._on_error = on_error

    def _report_error(self, operation: str, exc: BaseException) -> None:
        if self._on_error is None:
            return
        try:
            self._on_error(operation, exc)
        except Exception as report_exc:
            logger.debug("[tlon] gateway-status error reporter failed: %s", report_exc)

    @property
    def enabled(self) -> bool:
        return bool(self.config.gateway_status_enabled and self.owner)

    async def start(self) -> bool:
        if not self.config.gateway_status_enabled:
            logger.info("[tlon] gateway-status disabled")
            return False
        if not self.owner:
            logger.info("[tlon] gateway-status skipped: no owner configured")
            return False

        client = self._client_factory(self.config)
        self._client = client
        try:
            await client.authenticate()
            await client.open()
            await self._configure()
            await self._gateway_start()
        except Exception:
            await self._safe_close_client()
            self._active = False
            self._client = None
            raise

        self._active = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info(
            "[tlon] gateway-status activated (boot_id=%s owner=%s)",
            self.boot_id,
            self.owner,
        )
        return True

    async def stop(self, reason: str = "shutdown") -> None:
        task = self._heartbeat_task
        self._heartbeat_task = None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        if self._active and self._client is not None:
            try:
                await self._gateway_stop(reason)
            except Exception as exc:
                logger.warning("[tlon] gateway-status stop failed: %s", exc)
                self._report_error("stop", exc)
        self._active = False
        await self._safe_close_client()
        self._client = None

    async def _heartbeat_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self.config.gateway_status_heartbeat_seconds)
                await self._gateway_heartbeat()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("[tlon] gateway-status heartbeat failed: %s", exc)
                self._report_error("heartbeat", exc)

    async def _configure(self) -> None:
        # The owner is shared across all of %steward's modules, so it rides the
        # core mark; only the timings belong to the gateway module. Owner first:
        # the module refuses start/heartbeat/stop until the core owner is set.
        await self._poke_core({"configure": {"owner": self.owner}})
        await self._poke(
            {
                "configure": {
                    "active-window": _format_dr_seconds(
                        self.config.gateway_status_active_window_seconds
                    ),
                    "offline-reply-cooldown": _format_dr_seconds(
                        self.config.gateway_status_reply_cooldown_seconds
                    ),
                }
            }
        )

    async def _gateway_start(self) -> None:
        await self._poke(
            {
                "gateway-start": {
                    "boot-id": self.boot_id,
                    "lease-until": self._lease_until_da(),
                }
            }
        )

    async def _gateway_heartbeat(self) -> None:
        await self._poke(
            {
                "gateway-heartbeat": {
                    "boot-id": self.boot_id,
                    "lease-until": self._lease_until_da(),
                }
            }
        )

    async def _gateway_stop(self, reason: str) -> None:
        await self._poke({"gateway-stop": {"boot-id": self.boot_id, "reason": reason}})

    async def _poke(self, json_payload: Any) -> None:
        if self._client is None:
            raise RuntimeError("gateway-status client is not started")
        await self._client.poke("steward", "steward-gateway-action-1", json_payload)

    async def _poke_core(self, json_payload: Any) -> None:
        if self._client is None:
            raise RuntimeError("gateway-status client is not started")
        await self._client.poke("steward", "steward-action-1", json_payload)

    def _lease_until_da(self) -> str:
        lease_until = (time.time() + self.config.gateway_status_lease_seconds) * 1000.0
        return _format_da_from_unix_millis(lease_until)

    async def _safe_close_client(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass


@dataclass(frozen=True)
class TlonIncomingMessage:
    chat_id: str
    chat_name: str
    chat_type: str
    user_id: str
    user_name: str
    text: str
    message_id: str
    reply_to_message_id: Optional[str]
    sent_at: datetime
    raw: Any
    content: Any = None
    blob: Optional[str] = None
    author_is_bot: bool = False
    # The essay author is distinct from user_id for self echoes in DMs: the
    # conversation/user remains the partner while this identifies the sender.
    author_id: str = ""
    # Set for a synthetic reaction event so its visible id is the actual
    # reacted post rather than the synthetic event identity.
    reactable_target_id: Optional[str] = None


@dataclass(frozen=True)
class TlonReaction:
    """One decoded reaction transition or snapshot entry.

    ``wire_key`` remains the serialized identity used for state comparisons;
    ``reactor`` is the ship used for authorization and loop protection.
    """

    chat_type: str
    chat_id: str
    post_id: str
    parent_id: Optional[str]
    wire_key: str
    reactor: str
    reactor_is_bot: bool
    emoji: str
    added: bool
    raw: Any


@dataclass(frozen=True)
class ChannelReactsSnapshot:
    chat_id: str
    post_id: str
    parent_id: Optional[str]
    # wire key -> (exact decoded emoji, normalized ship, is bot identity)
    entries: dict[str, tuple[str, str, bool]]
    raw: Any


def extract_message_text(content: Any) -> str:
    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if "inline" in block:
                    parts.append(_extract_inline_text(block["inline"]))
                elif "block" in block and isinstance(block["block"], dict):
                    parts.append(_extract_block_text(block["block"]))
        return " ".join(part for part in parts if part).strip()
    return str(content)


def extract_message_title(content: Any) -> str:
    """Return a user-visible essay title when the wire payload has one."""
    if not isinstance(content, Mapping):
        return ""
    meta = content.get("meta")
    if not isinstance(meta, Mapping):
        return ""
    title = meta.get("title")
    return title.strip() if isinstance(title, str) else ""


def _extract_inline_text(inlines: Any) -> str:
    if isinstance(inlines, str):
        return inlines
    if not isinstance(inlines, list):
        return ""

    parts: list[str] = []
    for item in inlines:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            if "ship" in item:
                parts.append(normalize_ship(item["ship"]))
            elif "link" in item and isinstance(item["link"], dict):
                link = item["link"]
                parts.append(str(link.get("content") or link.get("href") or ""))
            elif "bold" in item:
                parts.append(_extract_inline_text(item["bold"]))
            elif "italics" in item:
                parts.append(_extract_inline_text(item["italics"]))
            elif "strike" in item:
                parts.append(_extract_inline_text(item["strike"]))
            elif "blockquote" in item:
                parts.append(_extract_inline_text(item["blockquote"]))
            elif "inline-code" in item:
                parts.append(str(item["inline-code"]))
            elif "code" in item:
                parts.append(str(item["code"]))
            elif "task" in item and isinstance(item["task"], Mapping):
                task = item["task"]
                marker = "[x] " if task.get("checked") else "[ ] "
                parts.append(marker + _extract_inline_text(task.get("content")))
            elif "break" in item:
                parts.append("\n")
            elif "tag" in item:
                parts.append(f"#{item['tag']}")
    return "".join(parts)


def _extract_listing_text(listing: Any) -> str:
    """Extract all text carried by recursive story listing nodes."""
    if not isinstance(listing, Mapping):
        return ""
    item = listing.get("item")
    if isinstance(item, list):
        return _extract_inline_text(item)
    list_node = listing.get("list")
    if not isinstance(list_node, Mapping):
        return ""
    parts = [_extract_inline_text(list_node.get("contents"))]
    items = list_node.get("items")
    if isinstance(items, list):
        parts.extend(_extract_listing_text(child) for child in items)
    return "\n".join(part for part in parts if part)


def _extract_block_text(block: dict[str, Any]) -> str:
    if "image" in block and isinstance(block["image"], dict):
        image = block["image"]
        return f"[image: {image.get('alt') or image.get('src') or ''}]"
    if "cite" in block:
        return "[quoted message]"
    if "link" in block and isinstance(block["link"], Mapping):
        link = block["link"]
        url = str(link.get("url") or "").strip()
        meta = link.get("meta")
        title = ""
        if isinstance(meta, Mapping):
            title = str(meta.get("title") or meta.get("description") or "").strip()
        if title and url:
            return f"[link: {title} — {url}]"
        return f"[link: {url}]" if url else "[link]"
    if "header" in block and isinstance(block["header"], Mapping):
        return _extract_inline_text(block["header"].get("content"))
    if "listing" in block:
        return _extract_listing_text(block["listing"])
    if "code" in block and isinstance(block["code"], dict):
        code = block["code"]
        lang = code.get("lang") or ""
        body = code.get("code") or ""
        return f"```{lang}\n{body}\n```"
    return ""


def extract_author_ship(author: Any) -> str:
    """Extract a normalized ship from a string or BotProfile-shaped author."""
    if isinstance(author, Mapping):
        return normalize_ship(str(author.get("ship") or ""))
    return normalize_ship(str(author or ""))


def author_is_bot_meta(author: Any) -> bool:
    """True when the author field is a BotProfile-shaped mapping."""
    return isinstance(author, Mapping) and bool(author.get("ship"))


def _decode_react_value(value: Any) -> str:
    """Decode Tlon's ``$react`` JSON without silently accepting bad values."""
    if isinstance(value, str):
        return value
    if isinstance(value, Mapping) and isinstance(value.get("any"), str):
        return str(value["any"])
    raise ValueError("reaction value is not a string or {any: string}")


def _reaction_author(author: Any) -> tuple[str, str, bool]:
    """Return (wire_key, normalized_ship, is_bot) for a reaction author."""
    if isinstance(author, str) and author.strip():
        return author, normalize_ship(author), False
    if isinstance(author, Mapping):
        ship = normalize_ship(str(author.get("ship") or ""))
        if not ship:
            raise ValueError("bot reaction author is missing ship")
        # nickname is wire type `(unit @t)`: null/missing is legal for bot
        # profiles without a nickname, so fall back to an empty suffix.
        nickname = author.get("nickname")
        suffix = nickname if isinstance(nickname, str) else ""
        return f"{author.get('ship')}/{suffix}", ship, True
    raise ValueError("reaction author is not a ship or bot identity")


def parse_channel_reacts_snapshot(event: Any) -> Optional[ChannelReactsSnapshot]:
    """Decode a complete channels /v2 reaction map without applying a diff."""
    if not isinstance(event, dict):
        return None
    nest = event.get("nest")
    response = event.get("response")
    if not isinstance(nest, str) or not nest or not isinstance(response, dict):
        return None
    post = response.get("post")
    r_post = post.get("r-post") if isinstance(post, dict) else None
    if not isinstance(post, dict) or not isinstance(r_post, dict):
        return None

    post_id = post.get("id")
    parent_id: Optional[str] = None
    reacts = r_post.get("reacts")
    reply = r_post.get("reply")
    if isinstance(reply, dict):
        r_reply = reply.get("r-reply")
        if isinstance(r_reply, dict) and "reacts" in r_reply:
            reacts = r_reply.get("reacts")
            post_id = reply.get("id")
            parent_id = str(post.get("id") or "") or None

    if not isinstance(reacts, dict) or not post_id:
        return None

    try:
        entries: dict[str, tuple[str, str, bool]] = {}
        for wire_key, raw_value in reacts.items():
            if not isinstance(wire_key, str) or not wire_key:
                raise ValueError("reaction map key is not a non-empty string")
            if "/" in wire_key:
                if not isinstance(raw_value, Mapping):
                    raise ValueError("bot reaction map entry is not an object")
                reactor = normalize_ship(str(raw_value.get("ship") or ""))
                if not reactor:
                    raise ValueError("bot reaction map entry is missing ship")
                emoji = _decode_react_value(raw_value.get("react"))
                entries[wire_key] = (emoji, reactor, True)
            else:
                reactor = normalize_ship(wire_key)
                if not reactor:
                    raise ValueError("reaction map key is not a ship")
                entries[wire_key] = (_decode_react_value(raw_value), reactor, False)
    except (TypeError, ValueError) as exc:
        logger.warning("[tlon] ignoring malformed channel reaction snapshot: %s", exc)
        return None

    return ChannelReactsSnapshot(
        chat_id=nest,
        post_id=str(post_id),
        parent_id=parent_id,
        entries=entries,
        raw=event,
    )


def _is_plain_patp(ship: Any) -> bool:
    return bool(re.fullmatch(r"~[a-z][a-z-]*", normalize_ship(str(ship or ""))))


def parse_dm_reaction(event: Any, *, self_ship: str) -> Optional[TlonReaction]:
    """Decode one chat /v3 add-react or del-react transition.

    Legacy group-DM events share this subscription but cannot be delivered by
    the one-to-one DM send path, so they are intentionally excluded here.
    """
    if not isinstance(event, dict):
        return None
    whom = event.get("whom")
    response = event.get("response")
    if not isinstance(whom, str) or not _is_plain_patp(whom) or not isinstance(response, dict):
        return None
    root_id = event.get("id")
    if not root_id:
        return None

    delta: Any = response
    post_id: Any = root_id
    parent_id: Optional[str] = None
    reply = response.get("reply")
    if isinstance(reply, dict) and isinstance(reply.get("delta"), dict):
        delta = reply["delta"]
        post_id = reply.get("id")
        parent_id = str(root_id)
    if not isinstance(delta, dict) or not post_id:
        return None

    added = "add-react" in delta
    removed = "del-react" in delta
    if added == removed:
        return None
    try:
        if added:
            payload = delta.get("add-react")
            if not isinstance(payload, Mapping):
                raise ValueError("add-react is not an object")
            wire_key, reactor, reactor_is_bot = _reaction_author(payload.get("author"))
            emoji = _decode_react_value(payload.get("react"))
        else:
            wire_key, reactor, reactor_is_bot = _reaction_author(delta.get("del-react"))
            emoji = ""
    except (TypeError, ValueError) as exc:
        logger.warning("[tlon] ignoring malformed DM reaction: %s", exc)
        return None

    if reactor == normalize_ship(self_ship):
        return None
    return TlonReaction(
        chat_type="dm",
        chat_id=normalize_ship(whom),
        post_id=str(post_id),
        parent_id=parent_id,
        wire_key=wire_key,
        reactor=reactor,
        reactor_is_bot=reactor_is_bot,
        emoji=emoji,
        added=added,
        raw=event,
    )


def parse_channel_message(
    event: Any,
    *,
    self_ship: str,
    include_self: bool = False,
) -> Optional[TlonIncomingMessage]:
    if not isinstance(event, dict):
        return None
    nest = event.get("nest")
    if not isinstance(nest, str) or not nest:
        return None
    response = event.get("response")
    if not isinstance(response, dict):
        return None
    post = response.get("post")
    if not isinstance(post, dict):
        return None

    msg_id = post.get("id")
    r_post = post.get("r-post")
    if not isinstance(r_post, dict):
        return None

    post_set = r_post.get("set") if isinstance(r_post.get("set"), dict) else {}
    essay = post_set.get("essay") if isinstance(post_set, dict) else None

    reply = r_post.get("reply") if isinstance(r_post.get("reply"), dict) else None
    reply_set: dict[str, Any] = {}
    reply_content = None
    reply_id = None
    if isinstance(reply, dict):
        reply_id = reply.get("id")
        r_reply = reply.get("r-reply")
        if isinstance(r_reply, dict) and isinstance(r_reply.get("set"), dict):
            reply_set = r_reply["set"]
            reply_content = (
                reply_set.get("reply-essay")
                or reply_set.get("memo")
                or reply_set.get("essay")
            )

    content = reply_content or essay
    if not isinstance(content, dict):
        return None

    sender = extract_author_ship(content.get("author"))
    if not sender or (not include_self and sender == normalize_ship(self_ship)):
        return None

    story_content = content.get("content")
    text = extract_message_text(story_content)
    if nest.startswith("heap/"):
        title = extract_message_title(content)
        if title:
            text = "\n".join(part for part in (title, text) if part)
    raw_blob = content.get("blob")
    blob = raw_blob if isinstance(raw_blob, str) and raw_blob.strip() else None
    if not text.strip() and not blob:
        return None

    seal = reply_set.get("seal") if reply_set else post_set.get("seal")
    parent_id = None
    if isinstance(seal, dict):
        parent_id = seal.get("parent-id") or seal.get("parent")

    parsed = parse_channel_nest(nest)
    sent = _datetime_from_ms(content.get("sent"))
    effective_id = str(reply_id or msg_id or uuid.uuid4().hex)
    return TlonIncomingMessage(
        chat_id=nest,
        chat_name=parsed["name"] if parsed else nest,
        chat_type="group",
        user_id=sender,
        user_name=sender,
        text=text,
        message_id=effective_id,
        reply_to_message_id=str(parent_id) if parent_id else None,
        sent_at=sent,
        raw=event,
        content=story_content,
        blob=blob,
        author_is_bot=author_is_bot_meta(content.get("author")),
        author_id=sender,
    )


def parse_dm_message(
    event: Any,
    *,
    self_ship: str,
    include_self: bool = False,
) -> Optional[TlonIncomingMessage]:
    if not isinstance(event, dict):
        return None
    whom = event.get("whom")
    response = event.get("response")
    if whom is None or not isinstance(response, dict):
        return None

    msg_id = event.get("id")
    add = response.get("add") if isinstance(response.get("add"), dict) else {}
    essay = add.get("essay") if isinstance(add, dict) else None

    reply = response.get("reply") if isinstance(response.get("reply"), dict) else None
    reply_add: dict[str, Any] = {}
    reply_content = None
    reply_id = None
    if isinstance(reply, dict):
        reply_id = reply.get("id")
        delta = reply.get("delta") if isinstance(reply.get("delta"), dict) else {}
        reply_add = delta.get("add") if isinstance(delta.get("add"), dict) else {}
        reply_content = (
            reply_add.get("memo")
            or reply_add.get("essay")
            or reply_add.get("reply-essay")
        )

    content = reply_content or essay
    if not isinstance(content, dict):
        return None

    sender = extract_author_ship(content.get("author"))
    if not sender or (not include_self and sender == normalize_ship(self_ship)):
        return None

    partner = normalize_ship(str(whom)) if isinstance(whom, str) else ""
    effective_sender = partner or sender
    story_content = content.get("content")
    text = extract_message_text(story_content)
    raw_blob = content.get("blob")
    blob = raw_blob if isinstance(raw_blob, str) and raw_blob.strip() else None
    if not text.strip() and not blob:
        return None

    effective_id = str(reply_id or msg_id or uuid.uuid4().hex)
    return TlonIncomingMessage(
        chat_id=effective_sender,
        chat_name=effective_sender,
        chat_type="dm",
        user_id=effective_sender,
        user_name=effective_sender,
        text=text,
        message_id=effective_id,
        reply_to_message_id=str(msg_id) if reply_content and msg_id else None,
        sent_at=_datetime_from_ms(content.get("sent")),
        raw=event,
        content=story_content,
        blob=blob,
        author_is_bot=author_is_bot_meta(content.get("author")),
        author_id=sender,
    )


def _datetime_from_ms(value: Any) -> datetime:
    try:
        return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return datetime.now(tz=timezone.utc)
