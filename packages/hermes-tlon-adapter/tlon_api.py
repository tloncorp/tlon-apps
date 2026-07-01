"""Small Tlon helpers for the Hermes platform plugin.

Writes go through the packaged ``tlon`` CLI. Reads use Eyre's SSE channel API.
This module deliberately has no Hermes imports so it can be tested in isolation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Awaitable, Callable, Mapping, Optional, Sequence

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
DEFAULT_MAX_CONSECUTIVE_BOT_RESPONSES = 2
DEFAULT_CONTEXT_MESSAGES = 20


def normalize_ship(ship: str) -> str:
    """Normalize a patp to ``~ship-name`` form."""
    ship = str(ship or "").strip()
    if not ship:
        return ""
    return ship if ship.startswith("~") else f"~{ship}"


def bare_ship(ship: str) -> str:
    return normalize_ship(ship).lstrip("~")


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


def _parse_int(value: Any, default: int) -> int:
    try:
        parsed = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _parse_non_negative_int(value: Any, default: int) -> int:
    try:
        parsed = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


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
    sse_read_timeout_seconds: float = DEFAULT_SSE_READ_TIMEOUT_SECONDS
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
        max_consecutive_bot_responses = _parse_int(
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
        sse_read_timeout_seconds = _parse_float(
            _env_or_extra(
                env,
                ("TLON_SSE_READ_TIMEOUT_SECONDS",),
                extra,
                ("sse_read_timeout_seconds", "sse_read_timeout"),
                DEFAULT_SSE_READ_TIMEOUT_SECONDS,
            ),
            DEFAULT_SSE_READ_TIMEOUT_SECONDS,
        )

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
            sse_read_timeout_seconds=sse_read_timeout_seconds,
        )

    def is_complete(self) -> bool:
        return bool(self.ship_url and self.ship_name and (self.ship_code or self.cookie))

    def cli_env(self, base: Mapping[str, str] | None = None) -> dict[str, str]:
        env = dict(base or os.environ)
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


CommandRunner = Callable[
    [Sequence[str], Mapping[str, str], float], Awaitable[TlonProcessResult]
]

# Called after every CLI invocation with (args, duration_ms, result).
CliObserver = Callable[[Sequence[str], int, "TlonSendResult"], None]


class TlonCLI:
    def __init__(
        self,
        config: TlonConfig,
        *,
        runner: CommandRunner | None = None,
        observer: CliObserver | None = None,
    ) -> None:
        self.config = config
        self._runner = runner or self._run_subprocess
        self._observer = observer

    async def send_message(self, chat_id: str, text: str) -> TlonSendResult:
        return await self._run(("posts", "send", chat_id, text))

    async def send_reply(
        self,
        chat_id: str,
        post_id: str,
        text: str,
        *,
        parent_author: str | None = None,
    ) -> TlonSendResult:
        args: list[str] = ["posts", "reply", chat_id, post_id, text]
        if parent_author:
            args.extend(["--author", normalize_ship(parent_author)])
        return await self._run(tuple(args))

    async def run_command(self, args: Sequence[str]) -> TlonSendResult:
        return await self._run(tuple(args))

    async def _run(self, args: Sequence[str]) -> TlonSendResult:
        started = time.monotonic()
        result = await self._run_unobserved(args)
        if self._observer is not None:
            try:
                self._observer(args, int((time.monotonic() - started) * 1000), result)
            except Exception as exc:
                logger.debug("[tlon] CLI observer failed: %s", exc)
        return result

    async def _run_unobserved(self, args: Sequence[str]) -> TlonSendResult:
        command = (self.config.cli, *args)
        try:
            proc = await self._runner(
                command,
                self.config.cli_env(),
                self.config.cli_timeout,
            )
        except asyncio.TimeoutError:
            return TlonSendResult(
                success=False,
                command=command,
                error=f"tlon CLI timed out after {self.config.cli_timeout:g}s",
                returncode=124,
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
    ) -> TlonProcessResult:
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=dict(env),
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise
        return TlonProcessResult(
            returncode=proc.returncode or 0,
            stdout=stdout_bytes.decode("utf-8", errors="replace"),
            stderr=stderr_bytes.decode("utf-8", errors="replace"),
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


class TlonSSEClient:
    """Eyre SSE channel client for subscriptions."""

    def __init__(self, config: TlonConfig) -> None:
        self.config = config
        self.url = config.ship_url.rstrip("/")
        self.ship = normalize_ship(config.ship_name)
        self.channel_id: Optional[str] = None
        self.channel_url: Optional[str] = None
        self._session: Any = None
        self._action_counter = 0
        self._subscriptions: dict[int, tuple[str, str]] = {}
        self._last_acked_event_id = -1
        self._ack_threshold = 20

    async def authenticate(self) -> str:
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
        if self._session is None:
            await self.authenticate()
        self.channel_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
        self.channel_url = f"{self.url}/~/channel/{self.channel_id}"
        await self._send_actions(
            [
                {
                    "id": self._next_action_id(),
                    "action": "poke",
                    "ship": bare_ship(self.ship),
                    "app": "hood",
                    "mark": "helm-hi",
                    "json": "Opening Hermes Tlon channel",
                }
            ]
        )

    async def subscribe(self, app: str, path: str) -> int:
        if self.channel_url is None:
            await self.open()
        sub_id = self._next_action_id()
        self._subscriptions[sub_id] = (app, path)
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
        if self.channel_url is None:
            await self.open()
        poke_id = self._next_action_id()
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

    async def events(self) -> AsyncIterator[TlonSSEEvent]:
        import aiohttp

        if self.channel_url is None:
            await self.open()
        assert self._session is not None
        assert self.channel_url is not None

        async with self._session.get(
            self.channel_url,
            headers={"Accept": "text/event-stream"},
            timeout=aiohttp.ClientTimeout(
                total=None,
                sock_read=self.config.sse_read_timeout_seconds,
                connect=60,
            ),
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise ConnectionError(f"Tlon SSE failed: HTTP {resp.status} {text[:200]}")

            buffer = ""
            async for chunk in resp.content.iter_any():
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n\n" in buffer:
                    payload, buffer = buffer.split("\n\n", 1)
                    event = await self._parse_sse_payload(payload)
                    if event is not None:
                        yield event
            raise ConnectionError("Tlon SSE stream ended")

    async def close(self, *, graceful: bool = True) -> None:
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
                text = await resp.text()
                raise ConnectionError(
                    f"Tlon channel action failed: HTTP {resp.status} {text[:200]}"
                )

    async def _parse_sse_payload(self, payload: str) -> Optional[TlonSSEEvent]:
        event_id: Optional[int] = None
        data_parts: list[str] = []
        for line in payload.splitlines():
            if line.startswith("id:"):
                try:
                    event_id = int(line.split(":", 1)[1].strip())
                except ValueError:
                    event_id = None
            elif line.startswith("data:"):
                data_parts.append(line.split(":", 1)[1].lstrip())

        if event_id is not None and event_id - self._last_acked_event_id > self._ack_threshold:
            self._last_acked_event_id = event_id
            asyncio.create_task(self._ack(event_id))

        if not data_parts:
            return None

        try:
            raw = json.loads("\n".join(data_parts))
        except json.JSONDecodeError:
            return None

        response = raw.get("response")
        sub_id = raw.get("id")
        if not isinstance(sub_id, int):
            sub_id = None

        if response == "subscribe":
            if sub_id in self._subscriptions and "err" in raw:
                app, path = self._subscriptions[sub_id]
                raise ConnectionError(
                    f"Tlon subscription failed for {app} {path}: {str(raw.get('err'))[:200]}"
                )
            return None

        if response == "quit":
            if sub_id in self._subscriptions:
                app, path = self._subscriptions[sub_id]
                raise ConnectionError(f"Tlon subscription quit for {app} {path}")
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
    """Heartbeat bridge for the desk %gateway-status agent."""

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
        await self._poke(
            {
                "configure": {
                    "owner": self.owner,
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
        await self._client.poke("gateway-status", "gateway-status-action-1", json_payload)

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
            elif "break" in item:
                parts.append("\n")
            elif "tag" in item:
                parts.append(f"#{item['tag']}")
    return "".join(parts)


def _extract_block_text(block: dict[str, Any]) -> str:
    if "image" in block and isinstance(block["image"], dict):
        image = block["image"]
        return f"[image: {image.get('alt') or image.get('src') or ''}]"
    if "cite" in block:
        return "[quoted message]"
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


def parse_channel_message(
    event: Any,
    *,
    self_ship: str,
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
            reply_content = reply_set.get("memo") or reply_set.get("essay")

    content = reply_content or essay
    if not isinstance(content, dict):
        return None

    sender = extract_author_ship(content.get("author"))
    if not sender or sender == normalize_ship(self_ship):
        return None

    story_content = content.get("content")
    text = extract_message_text(story_content)
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
    )


def parse_dm_message(
    event: Any,
    *,
    self_ship: str,
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
    if not sender or sender == normalize_ship(self_ship):
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
    )


def _datetime_from_ms(value: Any) -> datetime:
    try:
        return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return datetime.now(tz=timezone.utc)
