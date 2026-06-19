"""Hermes platform plugin for Tlon.

Inbound messages are read from Eyre SSE subscriptions. Outbound messages are
sent through the ``tlon`` CLI so this adapter reuses the same packaged Tlon API
surface as local/dev workflows.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import time
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping, Optional

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageType,
    SendResult,
)

from .approval import (
    DM_INVITE_PREVIEW,
    SETTINGS_KEY_DM_ALLOWLIST,
    SETTINGS_KEY_GROUP_INVITE_ALLOWLIST,
    SETTINGS_KEY_PENDING_APPROVALS,
    approval_group_flag,
    approval_id,
    approval_nest,
    approval_ship,
    approval_type,
    build_approval_card,
    create_pending_approval,
    find_approval,
    find_duplicate,
    format_approval_request,
    format_blocked_list,
    format_confirmation,
    format_pending_list,
    parse_approval_command,
    parse_dm_allowlist,
    parse_foreigns,
    parse_pending_approvals,
    prune_expired,
    remove_approval,
    serialize_blob,
)
from .attention import AttentionFacts, resolve_attention
from .channel_access import (
    SETTINGS_KEY_CHANNEL_RULES,
    add_channel_allowed_ship,
    apply_channel_access_command,
    channel_access_command_args,
    channel_allowed_ships,
    is_channel_access_command,
    is_channel_open,
    parse_channel_rules,
)
from .history import (
    build_channel_context,
    build_thread_context,
    fetch_channel_history,
    fetch_thread_context,
)
from .mention import (
    BotMentionMatcher,
    build_bot_mention_terms,
    extract_profile_nickname,
)
from .owner_listen import (
    SETTINGS_DESK,
    SETTINGS_KEY_GROUP_CHANNELS,
    OwnerListenState,
    apply_owner_listen_command,
    apply_owner_listen_group_command,
    apply_owner_listen_settings_event,
    canonical_nest_set,
    is_owner_listen_command,
    owner_listen_active,
    owner_listen_command_args,
    owner_listen_group_target,
    owner_listen_state_from_settings,
    parse_settings_bucket,
    parse_settings_event,
    settings_group_channels,
    settings_put_entry,
)
from .image_search import (
    IMAGE_SEARCH_TOOL_DESCRIPTION,
    IMAGE_SEARCH_TOOL_SCHEMA,
    check_image_search_requirements,
    handle_image_search_tool,
)
from .telemetry import (
    TlonTelemetry,
    clear_active_telemetry,
    cli_context,
    handle_post_api_request_telemetry,
    handle_post_tool_call_telemetry,
    set_active_telemetry,
)
from .version import (
    content_fingerprint,
    format_version_reply,
    git_source,
    is_tlon_version_command,
    plugin_version,
)
from .tlon_api import (
    DEFAULT_CONTEXT_MESSAGES,
    MAX_MESSAGE_LENGTH,
    TlonCLI,
    TlonConfig,
    TlonGatewayStatus,
    TlonIncomingMessage,
    TlonSSEClient,
    normalize_ship,
    parse_channel_message,
    parse_dm_message,
)
from .presence import (
    TlonComputingPresenceReporter,
    TlonComputingPresenceTracker,
    clear_active_computing_presence_tracker,
    handle_post_api_request,
    handle_pre_tool_call,
    set_active_computing_presence_tracker,
)
from .tlon_tool import (
    TLON_TOOL_DESCRIPTION,
    TLON_TOOL_SCHEMA,
    check_tlon_tool_requirements,
    handle_tlon_tool,
    resolve_tlon_skill_path,
)

logger = logging.getLogger(__name__)

RECONNECT_BACKOFF_SECONDS = (2, 5, 10, 30, 60)
RENOTIFY_COOLDOWN_MS = 10 * 60 * 1000
REQUIRED_ENV = [
    "TLON_NODE_URL",
    "TLON_NODE_ID",
    "TLON_ACCESS_CODE",
    "TLON_OWNER_SHIP",
]
OWNER_ONLY_TLON_TOOLS = frozenset(
    {
        "tlon",
        "cronjob",
        "read",
        "read_file",
        "write_file",
        "patch",
        "search_files",
    }
)
OWNER_ONLY_TLON_TOOLSETS = frozenset({"file"})
OPTIONAL_ENV = [
    "TLON_CHANNELS",
    "TLON_AUTO_DISCOVER",
    "TLON_ALLOWED_USERS",
    "TLON_ALLOW_ALL_USERS",
    "TLON_DM_ALLOWLIST",
    "TLON_HOME_CHANNEL",
    "TLON_BOT_MENTIONS",
    "TLON_FREE_RESPONSE_CHANNELS",
    "TLON_REQUIRE_MENTION",
    "TLON_KNOWN_BOT_USERS",
    "TLON_MAX_CONSECUTIVE_BOT_RESPONSES",
    "TLON_OWNER_LISTEN",
    "TLON_OWNER_LISTEN_DEFAULT",
    "TLON_OWNER_LISTEN_DISABLED_CHANNELS",
    "TLON_OWNER_LISTEN_ENABLED_CHANNELS",
    "TLON_CONTEXT_MESSAGES",
    "TLON_TELEMETRY",
    "TLON_TELEMETRY_API_KEY",
    "TLON_TELEMETRY_HOST",
    "TLON_TELEMETRY_DEBUG",
    "TLON_CLI",
    "TLON_SSE_READ_TIMEOUT_SECONDS",
    "TLON_GATEWAY_STATUS",
    "TLON_GATEWAY_STATUS_OWNER",
    "BRAVE_SEARCH_API_KEY",
    "BRAVE_API_KEY",
]
_TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}

try:
    import aiohttp as _aiohttp  # noqa: F401

    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False


def _is_dm_chat_id(chat_id: str) -> bool:
    chat = str(chat_id or "").strip()
    return bool(chat.startswith("~") and normalize_ship(chat) == chat)


# `/tlon ...` debug namespace. Does not match `/tlon-version` (legacy alias)
# because "-" is neither whitespace nor end-of-string after "tlon".
_TLON_COMMAND_RE = re.compile(r"^/tlon(?:\s|$)", re.IGNORECASE)
_HOSTED_URL_SUFFIXES = ("tlon.network", ".test.tlon.systems")


def is_tlon_command(text: str) -> bool:
    return bool(_TLON_COMMAND_RE.match(str(text or "").strip()))


def tlon_command_args(text: str) -> list[str]:
    return _TLON_COMMAND_RE.sub("", str(text or "").strip(), count=1).split()


def _env_flag_enabled(name: str, env: Mapping[str, str] | None = None) -> bool:
    source_env = os.environ if env is None else env
    value = source_env.get(name, "")
    return str(value).strip().lower() in _TRUTHY_ENV_VALUES


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _config_flag_enabled(value: Any, *, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if not text:
        return default
    if text in _TRUTHY_ENV_VALUES:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _hermes_tool_permission_snapshot(
    env: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Content-free startup snapshot of Hermes tool gates for this process."""
    source_env = os.environ if env is None else env
    interactive = _env_flag_enabled("HERMES_INTERACTIVE", source_env)
    gateway_session = _env_flag_enabled("HERMES_GATEWAY_SESSION", source_env)
    exec_ask = _env_flag_enabled("HERMES_EXEC_ASK", source_env)
    runtime_allowed = interactive or gateway_session or exec_ask

    snapshot: dict[str, Any] = {
        "hermesCronjobEnvInteractive": interactive,
        "hermesCronjobEnvGatewaySession": gateway_session,
        "hermesCronjobEnvExecAsk": exec_ask,
        "hermesCronjobRuntimeAllowed": runtime_allowed,
        "hermesCronDeliveryHomeChannelConfigured": bool(
            str(source_env.get("TLON_HOME_CHANNEL", "")).strip()
        ),
    }

    try:
        from hermes_cli.config import load_config  # type: ignore
        from hermes_cli.tools_config import _get_platform_tools  # type: ignore

        config = load_config()
        platform_toolsets = config.get("platform_toolsets") or {}
        tlon_toolsets = (
            _string_list(platform_toolsets.get("tlon"))
            if isinstance(platform_toolsets, dict)
            else []
        )
        explicit_tlon_toolsets = (
            isinstance(platform_toolsets, dict)
            and isinstance(platform_toolsets.get("tlon"), list)
        )
        configured_tlon_toolsets = (
            tlon_toolsets if explicit_tlon_toolsets else _string_list(config.get("toolsets"))
        )
        enabled_toolsets = sorted(
            str(name)
            for name in _get_platform_tools(
                config,
                "tlon",
            )
        )
        agent_config = config.get("agent") or {}
        disabled_toolsets = _string_list(
            agent_config.get("disabled_toolsets") if isinstance(agent_config, dict) else []
        )
        mcp_servers = config.get("mcp_servers")
        if not isinstance(mcp_servers, dict):
            mcp_servers = {}
        configured_mcp_servers = sorted(str(name) for name in mcp_servers)
        enabled_mcp_servers = sorted(
            str(name)
            for name, server_config in mcp_servers.items()
            if isinstance(server_config, dict)
            and _config_flag_enabled(server_config.get("enabled"), default=True)
        )
        explicit_mcp_servers = sorted(
            set(configured_tlon_toolsets) & set(enabled_mcp_servers)
        )
        resolved_mcp_servers = set(enabled_toolsets) & set(enabled_mcp_servers)
        cronjob_toolset_enabled = "cronjob" in enabled_toolsets
        cronjob_disabled = "cronjob" in disabled_toolsets
        snapshot.update(
            {
                "hermesTlonPlatformToolsetsExplicit": explicit_tlon_toolsets,
                "hermesTlonToolsetsResolved": enabled_toolsets[:80],
                "hermesTlonToolsetsCount": len(enabled_toolsets),
                "hermesMcpServersConfigured": configured_mcp_servers[:80],
                "hermesMcpServersConfiguredCount": len(configured_mcp_servers),
                "hermesMcpServersEnabled": enabled_mcp_servers[:80],
                "hermesMcpServersEnabledCount": len(enabled_mcp_servers),
                "hermesMcpExplicitServerAllowlist": explicit_mcp_servers[:80],
                "hermesMcpExplicitServerAllowlistCount": len(explicit_mcp_servers),
                "hermesMcpDefaultServerSetEnabled": bool(
                    resolved_mcp_servers
                    and not explicit_mcp_servers
                    and "no_mcp" not in configured_tlon_toolsets
                ),
                "hermesCronjobToolsetEnabled": cronjob_toolset_enabled,
                "hermesCronjobDisabledByAgentConfig": cronjob_disabled,
                "hermesCronjobAvailableAtStartup": (
                    runtime_allowed and cronjob_toolset_enabled and not cronjob_disabled
                ),
            }
        )
        try:
            from tools.registry import registry  # type: ignore
            from toolsets import resolve_toolset  # type: ignore

            tool_to_toolset = registry.get_tool_to_toolset_map()
            registered_mcp_tools = {
                tool: toolset
                for tool, toolset in tool_to_toolset.items()
                if str(toolset).startswith("mcp-")
            }
            registered_mcp_toolsets = sorted(set(registered_mcp_tools.values()))
            resolved_tool_names: set[str] = set()
            for toolset in enabled_toolsets:
                resolved_tool_names.update(str(name) for name in resolve_toolset(toolset))
            visible_mcp_tools = {
                tool: toolset
                for tool, toolset in registered_mcp_tools.items()
                if tool in resolved_tool_names
            }
            snapshot.update(
                {
                    "hermesMcpRegisteredToolsets": registered_mcp_toolsets[:80],
                    "hermesMcpRegisteredToolsetsCount": len(registered_mcp_toolsets),
                    "hermesMcpRegisteredToolsCount": len(registered_mcp_tools),
                    "hermesMcpRegisteredToolsEnabledForTlonCount": len(visible_mcp_tools),
                }
            )
        except Exception as exc:
            snapshot.update(
                {
                    "hermesMcpRegisteredToolsets": None,
                    "hermesMcpRegisteredToolsetsCount": None,
                    "hermesMcpRegisteredToolsCount": None,
                    "hermesMcpRegisteredToolsEnabledForTlonCount": None,
                    "hermesMcpRegistryErrorType": type(exc).__name__,
                }
            )
    except Exception as exc:
        snapshot.update(
            {
                "hermesTlonPlatformToolsetsExplicit": None,
                "hermesTlonToolsetsResolved": None,
                "hermesTlonToolsetsCount": None,
                "hermesMcpServersConfigured": None,
                "hermesMcpServersConfiguredCount": None,
                "hermesMcpServersEnabled": None,
                "hermesMcpServersEnabledCount": None,
                "hermesMcpExplicitServerAllowlist": None,
                "hermesMcpExplicitServerAllowlistCount": None,
                "hermesMcpDefaultServerSetEnabled": None,
                "hermesMcpRegisteredToolsets": None,
                "hermesMcpRegisteredToolsetsCount": None,
                "hermesMcpRegisteredToolsCount": None,
                "hermesMcpRegisteredToolsEnabledForTlonCount": None,
                "hermesCronjobToolsetEnabled": None,
                "hermesCronjobDisabledByAgentConfig": None,
                "hermesCronjobAvailableAtStartup": None,
                "hermesToolsetConfigErrorType": type(exc).__name__,
            }
        )

    return snapshot


def node_url_is_hosted(url: str) -> bool:
    """Mirror @tloncorp/api nodeUrlIsHosted for the storage diagnostic."""
    trimmed = str(url or "").strip().rstrip("/")
    return any(trimmed.endswith(suffix) for suffix in _HOSTED_URL_SUFFIXES)


def _hash_binary(path: str) -> tuple[str, int, str]:
    """sha256 (first 12 hex), byte size, and mtime of a file. Blocking — run
    off the event loop. Lets us pin the exact `tlon` build, since the semver
    alone can't distinguish two builds of the same version."""
    digest = hashlib.sha256()
    size = 0
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
            size += len(chunk)
    mtime = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
    return digest.hexdigest()[:12], size, mtime.isoformat(timespec="seconds")


def format_storage_status(
    *,
    node_url: str,
    url_hosted: bool,
    hosting_forced: bool,
    service: str,
    has_s3_creds: bool,
    genuine_reachable: bool,
) -> str:
    """Diagnostic for image uploads — mirrors the decision in
    @tloncorp/api uploadFile so an operator can see why a push would route
    where it does."""
    is_hosted = hosting_forced or url_hosted
    use_memex = is_hosted and (service == "presigned-url" or not has_s3_creds)
    if use_memex:
        path = (
            "memex (hosted)"
            if genuine_reachable
            else "memex — would FAIL: no %genuine token"
        )
    elif has_s3_creds:
        path = "S3 (custom credentials)"
    else:
        path = "would FAIL: no storage credentials configured"
    rows = [
        ("Node URL", node_url or "unknown"),
        ("URL looks hosted", "yes" if url_hosted else "no"),
        ("TLON_HOSTING", "set" if hosting_forced else "unset"),
        ("Storage service", service or "unknown"),
        ("Custom S3 creds", "yes" if has_s3_creds else "no"),
        ("%genuine token", "reachable" if genuine_reachable else "unavailable"),
        ("Upload path", path),
    ]
    return "\n".join(f"*{key}*: **{value}**" for key, value in rows)


_PATP_RE = re.compile(r"^~[a-z][a-z-]*$")


def _is_patp(ship: str) -> bool:
    """True for single-ship ids; excludes club ids like ~0v4..."""
    return bool(_PATP_RE.match(normalize_ship(ship)))


def _processing_outcome_value(outcome: Any) -> Optional[str]:
    """Normalize Hermes' ProcessingOutcome enum (success/failure/cancelled)."""
    value = getattr(outcome, "value", outcome)
    if isinstance(value, str) and value.strip():
        return value.strip().lower()
    return None


def _cli_available(cli: str | None = None) -> bool:
    candidate = cli or os.getenv("TLON_CLI", "tlon")
    if not candidate:
        return False
    if Path(candidate).expanduser().exists():
        return True
    return shutil.which(candidate) is not None


def check_requirements() -> bool:
    return AIOHTTP_AVAILABLE and _cli_available()


def validate_config(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    tlon = TlonConfig.from_env(extra)
    return tlon.is_complete() and _cli_available(tlon.cli)


def is_connected(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    return TlonConfig.from_env(extra).is_complete()


class TlonAdapter(BasePlatformAdapter):
    MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH

    # The adapter implements the full inbound access policy itself
    # (deny-by-default, owner/env allowlists, settings-store grants, approval
    # queue, channel rules), so a message that reaches Hermes core has already
    # been authorized. Core honors this instead of running its env-allowlist /
    # pairing gate — which cannot represent settings-store grants or open
    # channels. The platform registration deliberately does not export
    # allowed_users_env/allow_all_env: core's trust shortcut only applies when
    # it sees no env allowlist for the platform. Newer Hermes cores also look
    # for these allowlist policy hints before trusting an own-policy adapter.
    enforces_own_access_policy = True
    _dm_policy = "allowlist"
    _group_policy = "allowlist"

    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform("tlon"))
        self.tlon_config = TlonConfig.from_env(config.extra or {})
        self._telemetry = TlonTelemetry(self.tlon_config, extra=config.extra or {})
        self._cli = TlonCLI(self.tlon_config, observer=self._telemetry.observe_cli)
        self._connected_at = 0.0
        self._sse: Optional[TlonSSEClient] = None
        self._stream_task: Optional[asyncio.Task] = None
        self._gateway_status = TlonGatewayStatus(
            self.tlon_config,
            on_error=lambda operation, exc: self._telemetry.error(
                "gateway_status", exc, operation=operation
            ),
        )
        self._computing_presence = TlonComputingPresenceTracker(
            reporter=TlonComputingPresenceReporter(self.tlon_config),
            on_error=lambda action, exc: self._telemetry.error(
                "presence", exc, operation=action
            ),
        )
        self._seen_ids: set[str] = set()
        self._seen_order: list[str] = []
        self._monitored_channels = set(self.tlon_config.channels)
        self._mention_matcher = self._build_mention_matcher()
        self._participated_threads: set[str] = set()
        self._known_bot_consecutive_by_channel: dict[str, int] = {}
        self._owner_listen = self._owner_listen_env_defaults()
        self._settings_group_channels: set[str] = set()
        self._settings_loaded = False
        self._pending_approvals: list[dict[str, Any]] = []
        self._settings_dm_allowlist: set[str] = set()
        self._settings_group_invite_allowlist: set[str] = set(
            self.tlon_config.group_invite_allowlist
        )
        self._channel_rules: dict[str, dict[str, Any]] = {}
        self._processed_dm_invites: set[str] = set()
        self._processed_group_invites: set[str] = set()

    async def connect(self) -> bool:
        if not AIOHTTP_AVAILABLE:
            logger.warning("[tlon] aiohttp is not installed")
            return False
        if not self.tlon_config.is_complete():
            logger.warning("[tlon] TLON node URL/id/access code is not configured")
            return False
        if not _cli_available(self.tlon_config.cli):
            logger.warning("[tlon] tlon CLI is not available: %s", self.tlon_config.cli)
            return False

        try:
            await self._connect_sse()
            adapter_version = plugin_version()
            source = await git_source()
            fingerprint = content_fingerprint()
            cli_version = await self._cli_version()
            logger.info(
                "[tlon] version: %s",
                format_version_reply(
                    adapter_version=adapter_version,
                    source=source,
                    fingerprint=fingerprint,
                    cli_version=cli_version,
                    markdown=False,
                ).replace("\n", " | "),
            )
            self._telemetry.set_common(
                {"adapterVersion": adapter_version, "adapterFingerprint": fingerprint}
            )
            set_active_telemetry(self._telemetry)
            await self._load_bot_nickname()
            await self._load_settings_state()
            await self._process_pending_dm_invites()
            await self._process_pending_group_invites()
            await self._start_gateway_status()
            self._stream_task = asyncio.create_task(self._run_stream())
            self._computing_presence.bind_loop(asyncio.get_running_loop())
            set_active_computing_presence_tracker(self._computing_presence)
            self._mark_connected()
            self._connected_at = time.monotonic()
            hermes_permissions = _hermes_tool_permission_snapshot()
            logger.info(
                "[tlon] Hermes permissions: cronjob available=%s toolset=%s runtime=%s "
                "disabled=%s flags(interactive=%s gateway=%s exec_ask=%s) home_channel=%s "
                "mcp_servers=%s mcp_enabled=%s mcp_registered_toolsets=%s "
                "mcp_registered_tools=%s mcp_visible_tools=%s",
                hermes_permissions.get("hermesCronjobAvailableAtStartup"),
                hermes_permissions.get("hermesCronjobToolsetEnabled"),
                hermes_permissions.get("hermesCronjobRuntimeAllowed"),
                hermes_permissions.get("hermesCronjobDisabledByAgentConfig"),
                hermes_permissions.get("hermesCronjobEnvInteractive"),
                hermes_permissions.get("hermesCronjobEnvGatewaySession"),
                hermes_permissions.get("hermesCronjobEnvExecAsk"),
                hermes_permissions.get("hermesCronDeliveryHomeChannelConfigured"),
                hermes_permissions.get("hermesMcpServersConfiguredCount"),
                hermes_permissions.get("hermesMcpServersEnabledCount"),
                hermes_permissions.get("hermesMcpRegisteredToolsetsCount"),
                hermes_permissions.get("hermesMcpRegisteredToolsCount"),
                hermes_permissions.get("hermesMcpRegisteredToolsEnabledForTlonCount"),
            )
            self._telemetry.gateway_connected(
                {
                    "source": source,
                    "cliVersion": cli_version,
                    "monitoredChannels": len(self._monitored_channels),
                    "pendingApprovals": len(self._pending_approvals),
                    "channelRules": len(self._channel_rules),
                    "approvedDms": len(self._settings_dm_allowlist),
                    "settingsLoaded": self._settings_loaded,
                    **hermes_permissions,
                }
            )
            logger.info("[tlon] connected to %s as %s", self.tlon_config.ship_url, self.tlon_config.ship_name)
            return True
        except Exception as exc:
            logger.error("[tlon] connect failed: %s", exc, exc_info=True)
            self._telemetry.error("connect", exc)
            await self._close_sse(graceful=False)
            return False

    async def disconnect(self) -> None:
        self._mark_disconnected()
        if self._connected_at:
            self._telemetry.gateway_disconnected(
                uptime_seconds=int(time.monotonic() - self._connected_at),
                reason="shutdown",
            )
            self._connected_at = 0.0
        clear_active_telemetry(self._telemetry)
        clear_active_computing_presence_tracker(self._computing_presence)
        await self._computing_presence.close()
        await self._stop_gateway_status("shutdown")
        if self._stream_task is not None:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
            self._stream_task = None
        await self._close_sse()
        self._seen_ids.clear()
        self._seen_order.clear()
        self._participated_threads.clear()
        self._known_bot_consecutive_by_channel.clear()
        self._processed_dm_invites.clear()
        self._processed_group_invites.clear()
        self._telemetry.flush()

    def _build_mention_matcher(self, *, nickname: str = "") -> BotMentionMatcher:
        return BotMentionMatcher(
            build_bot_mention_terms(
                self.tlon_config.ship_name,
                aliases=self.tlon_config.bot_mentions,
                nickname=nickname,
            )
        )

    def _owner_listen_env_defaults(self) -> OwnerListenState:
        return OwnerListenState(
            enabled=self.tlon_config.owner_listen,
            disabled_channels=canonical_nest_set(
                self.tlon_config.owner_listen_disabled_channels
            ),
            enabled_channels=canonical_nest_set(
                self.tlon_config.owner_listen_enabled_channels
            ),
            default_all=self.tlon_config.owner_listen_default == "all",
        )

    def _is_owner(self, ship: str) -> bool:
        owner = self.tlon_config.owner_ship
        return bool(owner) and normalize_ship(ship) == owner

    async def _load_settings_state(self) -> None:
        """Load adapter state from the ship's %settings store.

        The settings store is the durable source of truth (owner-listen
        toggles, channel rules, approved DM senders, pending approvals) so
        state survives gateway reboots and carries over from OpenClaw
        deployments. Env config only provides per-key defaults when the store
        has no entry.
        """
        if self._sse is None:
            return
        defaults = self._owner_listen_env_defaults()
        try:
            payload = await self._sse.scry("/settings/all")
        except Exception as exc:
            # Keep the current snapshot (env defaults at boot, plus any toggles
            # applied since) rather than resetting it.
            logger.warning("[tlon] settings load failed; keeping current state: %s", exc)
            self._telemetry.error("settings", exc, operation="load")
            return
        bucket = parse_settings_bucket(payload)
        self._owner_listen = owner_listen_state_from_settings(bucket, defaults=defaults)
        new_group_channels = settings_group_channels(bucket)
        removed_group_channels = (
            self._settings_group_channels
            - new_group_channels
            - set(self.tlon_config.channels)
        )
        self._monitored_channels.difference_update(removed_group_channels)
        self._monitored_channels.update(new_group_channels)
        self._settings_group_channels = new_group_channels
        self._pending_approvals = prune_expired(
            parse_pending_approvals(bucket.get(SETTINGS_KEY_PENDING_APPROVALS)),
            time.time() * 1000.0,
        )
        self._settings_dm_allowlist = parse_dm_allowlist(
            bucket.get(SETTINGS_KEY_DM_ALLOWLIST)
        )
        if SETTINGS_KEY_GROUP_INVITE_ALLOWLIST in bucket:
            self._settings_group_invite_allowlist = parse_dm_allowlist(
                bucket.get(SETTINGS_KEY_GROUP_INVITE_ALLOWLIST)
            )
        self._channel_rules = parse_channel_rules(bucket.get(SETTINGS_KEY_CHANNEL_RULES))
        self._settings_loaded = True
        logger.info(
            "[tlon] settings loaded: owner-listen=%s muted=%s enabled-channels=%s "
            "pending-approvals=%d approved-dms=%d channel-rules=%d",
            self._owner_listen.enabled,
            sorted(self._owner_listen.disabled_channels),
            sorted(self._owner_listen.enabled_channels),
            len(self._pending_approvals),
            len(self._settings_dm_allowlist),
            len(self._channel_rules),
        )

    async def _persist_settings_entry(self, key: str, value: Any) -> bool:
        if self._sse is None:
            logger.warning("[tlon] cannot persist settings %s: not connected", key)
            return False
        try:
            await self._sse.poke("settings", "settings-event", settings_put_entry(key, value))
            return True
        except Exception as exc:
            logger.warning("[tlon] failed to persist settings %s: %s", key, exc)
            self._telemetry.error("settings", exc, operation="persist", key=key)
            return False

    def _handle_settings_event(self, raw: Any) -> None:
        """Hot-reload owner-listen state from live %settings updates.

        Covers writes from outside this process (Landscape, an OpenClaw
        instance sharing the store). Our own pokes echo back here too, which
        is a no-op since the state already matches.
        """
        event = parse_settings_event(raw)
        if event is None:
            return
        if event.key == SETTINGS_KEY_GROUP_CHANNELS:
            new_channels = (
                canonical_nest_set(event.value)
                if isinstance(event.value, (list, tuple))
                else set()
            )
            removed = (
                self._settings_group_channels
                - new_channels
                - set(self.tlon_config.channels)
            )
            if removed or new_channels - self._settings_group_channels:
                logger.info(
                    "[tlon] settings groupChannels update: +%s -%s",
                    sorted(new_channels - self._settings_group_channels),
                    sorted(removed),
                )
            self._monitored_channels.difference_update(removed)
            self._monitored_channels.update(new_channels)
            self._settings_group_channels = new_channels
            return
        if event.key == SETTINGS_KEY_PENDING_APPROVALS:
            self._pending_approvals = prune_expired(
                parse_pending_approvals(event.value), time.time() * 1000.0
            )
            return
        if event.key == SETTINGS_KEY_DM_ALLOWLIST:
            self._settings_dm_allowlist = parse_dm_allowlist(event.value)
            return
        if event.key == SETTINGS_KEY_GROUP_INVITE_ALLOWLIST:
            self._settings_group_invite_allowlist = parse_dm_allowlist(event.value)
            return
        if event.key == SETTINGS_KEY_CHANNEL_RULES:
            self._channel_rules = parse_channel_rules(event.value)
            return
        changed = apply_owner_listen_settings_event(
            self._owner_listen,
            event,
            defaults=self._owner_listen_env_defaults(),
        )
        if changed:
            logger.info(
                "[tlon] owner-listen settings update: %s (enabled=%s muted=%s enabled-channels=%s)",
                event.key,
                self._owner_listen.enabled,
                sorted(self._owner_listen.disabled_channels),
                sorted(self._owner_listen.enabled_channels),
            )

    def _user_authorized(self, ship: str, *, is_dm: bool, nest: str = "") -> bool:
        """Env/owner authorization plus settings-store grants.

        DMs: the approved-senders set (``dmAllowlist``). Channels: an *open*
        channel admits any ship, and per-channel ``allowedShips`` admit
        approved mentioners.
        """
        if self.tlon_config.user_allowed(ship, is_dm=is_dm):
            return True
        normalized = normalize_ship(ship)
        if is_dm:
            return normalized in self._settings_dm_allowlist
        if nest:
            if is_channel_open(self._channel_rules, nest):
                return True
            if normalized in channel_allowed_ships(self._channel_rules, nest):
                return True
        return False

    @staticmethod
    def _original_message_payload(message: TlonIncomingMessage) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messageId": message.message_id,
            "messageText": message.text,
            "timestamp": int(message.sent_at.timestamp() * 1000),
        }
        if message.reply_to_message_id:
            payload["parentId"] = message.reply_to_message_id
            payload["isThreadReply"] = True
        return payload

    async def _queue_dm_approval(self, message: TlonIncomingMessage) -> None:
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        await self._queue_approval(
            approval_kind="dm",
            requesting_ship=message.user_id,
            message_preview=message.text,
            original_message=self._original_message_payload(message),
        )

    async def _queue_channel_approval(
        self, message: TlonIncomingMessage, clean_text: str
    ) -> None:
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        original = self._original_message_payload(message)
        original["messageText"] = clean_text
        await self._queue_approval(
            approval_kind="channel",
            requesting_ship=message.user_id,
            channel_nest=message.chat_id,
            message_preview=clean_text,
            original_message=original,
        )

    async def _queue_approval(
        self,
        *,
        approval_kind: str,
        requesting_ship: str,
        channel_nest: Optional[str] = None,
        group_flag: Optional[str] = None,
        group_title: Optional[str] = None,
        message_preview: Optional[str] = None,
        original_message: Optional[dict[str, Any]] = None,
    ) -> None:
        if not self._settings_loaded:
            await self._load_settings_state()
        now_ms = time.time() * 1000.0
        self._pending_approvals = prune_expired(self._pending_approvals, now_ms)
        if await self._is_ship_blocked(requesting_ship):
            logger.info(
                "[tlon] ignoring request from blocked ship %s", requesting_ship
            )
            return
        candidate = create_pending_approval(
            approval_kind=approval_kind,
            requesting_ship=requesting_ship,
            now_ms=now_ms,
            existing_ids=[approval_id(item) for item in self._pending_approvals],
            channel_nest=channel_nest,
            group_flag=group_flag,
            group_title=group_title,
            message_preview=message_preview,
            original_message=original_message,
        )
        existing = find_duplicate(self._pending_approvals, candidate)
        if existing is not None:
            new_preview = str(candidate.get("messagePreview") or "")
            old_preview = str(existing.get("messagePreview") or "")
            if (
                not new_preview
                or new_preview == old_preview
                or new_preview == DM_INVITE_PREVIEW
            ):
                # Nothing new to tell the owner (also avoids re-notifying for
                # still-pending invites on every reboot).
                return
            updated = dict(existing)
            updated["messagePreview"] = candidate["messagePreview"]
            if candidate.get("originalMessage"):
                updated["originalMessage"] = candidate["originalMessage"]
            # Keep the freshest message but rate-limit re-notifications so a
            # chatty unapproved sender cannot spam the owner.
            try:
                last_notified = float(existing.get("lastNotifiedAt"))
            except (TypeError, ValueError):
                last_notified = 0.0
            if now_ms - last_notified >= RENOTIFY_COOLDOWN_MS:
                updated["lastNotifiedAt"] = int(now_ms)
                await self._notify_owner_approval(updated)
                self._telemetry.approval_event("renotified", approval_kind)
            self._pending_approvals = [
                updated if approval_id(item) == approval_id(existing) else item
                for item in self._pending_approvals
            ]
            await self._persist_pending_approvals()
            return
        candidate["lastNotifiedAt"] = int(now_ms)
        self._pending_approvals.append(candidate)
        await self._notify_owner_approval(candidate)
        await self._persist_pending_approvals()
        self._telemetry.approval_event("queued", approval_kind)
        logger.info(
            "[tlon] queued approval %s (%s from %s)",
            approval_id(candidate),
            approval_kind,
            normalize_ship(requesting_ship),
        )

    async def _notify_owner_approval(self, approval: dict[str, Any]) -> None:
        owner = self.tlon_config.owner_ship
        if not owner:
            return
        text = format_approval_request(approval)
        blob = serialize_blob(build_approval_card(approval))
        with cli_context("owner_notification"):
            result = await self._cli.run_command(
                ("posts", "send", owner, text, "--blob", blob)
            )
        if not result.success:
            logger.warning(
                "[tlon] approval notification to %s failed: %s", owner, result.error
            )
            self._telemetry.error(
                "approval",
                result.error or "notification send failed",
                requestType=approval_type(approval),
            )

    async def _persist_pending_approvals(self) -> None:
        # JSON string, not a raw list of dicts: %settings values cannot hold
        # objects (the poke would be nacked). Matches OpenClaw's encoding.
        await self._persist_settings_entry(
            SETTINGS_KEY_PENDING_APPROVALS, json.dumps(self._pending_approvals)
        )

    async def _persist_channel_rules(self) -> bool:
        return await self._persist_settings_entry(
            SETTINGS_KEY_CHANNEL_RULES, json.dumps(self._channel_rules)
        )

    async def _is_ship_blocked(self, ship: str) -> bool:
        blocked = await self._blocked_ships_list()
        return normalize_ship(ship) in blocked

    async def _blocked_ships_list(self) -> set[str]:
        if self._sse is None:
            return set()
        try:
            blocked = await self._sse.scry("/chat/blocked")
        except Exception as exc:
            logger.debug("[tlon] blocked-ships scry failed: %s", exc)
            return set()
        if not isinstance(blocked, list):
            return set()
        return {
            normalize_ship(str(ship or ""))
            for ship in blocked
            if str(ship or "").strip()
        }

    async def _block_ship(self, ship: str) -> bool:
        if self._sse is None:
            return False
        try:
            await self._sse.poke("chat", "chat-block-ship", {"ship": normalize_ship(ship)})
            return True
        except Exception as exc:
            logger.warning("[tlon] failed to block %s: %s", ship, exc)
            self._telemetry.error("moderation", exc, operation="block")
            return False

    async def _unblock_ship(self, ship: str) -> bool:
        if self._sse is None:
            return False
        try:
            await self._sse.poke(
                "chat", "chat-unblock-ship", {"ship": normalize_ship(ship)}
            )
            return True
        except Exception as exc:
            logger.warning("[tlon] failed to unblock %s: %s", ship, exc)
            self._telemetry.error("moderation", exc, operation="unblock")
            return False

    async def _add_to_dm_allowlist(self, ship: str) -> None:
        ship = normalize_ship(ship)
        if ship in self._settings_dm_allowlist:
            return
        self._settings_dm_allowlist.add(ship)
        await self._persist_settings_entry(
            SETTINGS_KEY_DM_ALLOWLIST, sorted(self._settings_dm_allowlist)
        )

    async def _remove_from_dm_allowlist(self, ship: str) -> None:
        ship = normalize_ship(ship)
        if ship not in self._settings_dm_allowlist:
            return
        self._settings_dm_allowlist.discard(ship)
        await self._persist_settings_entry(
            SETTINGS_KEY_DM_ALLOWLIST, sorted(self._settings_dm_allowlist)
        )

    async def _handle_approval_command(
        self,
        action: str,
        arg: str,
        *,
        reply_chat_id: str,
        reply_parent_id: Optional[str],
    ) -> None:
        if not self._settings_loaded:
            await self._load_settings_state()
        before = len(self._pending_approvals)
        self._pending_approvals = prune_expired(
            self._pending_approvals, time.time() * 1000.0
        )
        pruned = len(self._pending_approvals) != before

        if action == "pending":
            reply = format_pending_list(self._pending_approvals)
        elif action == "banned":
            reply = format_blocked_list(await self._blocked_ships_list())
        elif action == "unban":
            reply = await self._execute_unban(arg)
        elif action == "ban" and arg.startswith("~"):
            reply = await self._execute_ban_ship(normalize_ship(arg))
        elif not arg:
            reply = f"Usage: /{action} <id>"
        else:
            approval = find_approval(self._pending_approvals, arg)
            if approval is None:
                reply = f"No pending approval found for ID: #{arg.lstrip('#')}"
            else:
                reply = await self._execute_approval_action(approval, action)

        if pruned:
            await self._persist_pending_approvals()
        await self._send_control_reply(reply_chat_id, reply_parent_id, reply)

    async def _execute_approval_action(
        self, approval: dict[str, Any], action: str
    ) -> str:
        ship = approval_ship(approval)
        if action == "allow":
            if approval_type(approval) == "dm":
                if str(approval.get("messagePreview") or "") == DM_INVITE_PREVIEW:
                    with cli_context("invite_rsvp"):
                        accept = await self._cli.run_command(("dms", "accept", ship))
                    if not accept.success:
                        self._telemetry.error(
                            "approval",
                            accept.error or "dms accept failed",
                            operation="invite_accept",
                        )
                        return (
                            f"Could not accept the DM invite from {ship}: "
                            f"{accept.error or 'tlon CLI failed'}. Request stays pending."
                        )
                await self._add_to_dm_allowlist(ship)
            elif approval_type(approval) == "channel":
                nest = approval_nest(approval)
                if nest:
                    self._channel_rules = add_channel_allowed_ship(
                        self._channel_rules, nest, ship
                    )
                    await self._persist_channel_rules()
            elif approval_type(approval) == "group":
                flag = approval_group_flag(approval)
                if flag and not await self._accept_group_invite(flag):
                    return (
                        f"Could not join {flag}: invite accept failed. "
                        "Request stays pending."
                    )
        elif action == "ban":
            await self._block_ship(ship)
            await self._remove_from_dm_allowlist(ship)

        self._pending_approvals = remove_approval(
            self._pending_approvals, approval_id(approval)
        )
        await self._persist_pending_approvals()
        self._telemetry.approval_event(
            {"allow": "allowed", "reject": "rejected", "ban": "banned"}.get(action, action),
            approval_type(approval),
        )
        if action == "allow":
            await self._replay_approved_message(approval)
        reply = format_confirmation(approval, action)
        if action == "allow" and approval_type(approval) == "group":
            flag = approval_group_flag(approval)
            host = normalize_ship(flag.split("/", 1)[0]) if flag else ""
            already_listening = self._owner_listen.default_all or host in {
                self.tlon_config.owner_ship,
                self.tlon_config.ship_name,
            }
            if flag and not already_listening:
                reply += (
                    f" Reply /owner-listen on {flag} to be heard in its "
                    "channels without a mention."
                )
        return reply

    async def _replay_approved_message(self, approval: dict[str, Any]) -> None:
        """Dispatch the message that triggered an approval so it gets answered."""
        original = approval.get("originalMessage")
        if not isinstance(original, dict):
            return
        text = str(original.get("messageText") or "")
        if not text.strip():
            return
        ship = approval_ship(approval)
        is_dm = approval_type(approval) == "dm"
        chat_id = ship if is_dm else approval_nest(approval)
        if not chat_id:
            return
        try:
            sent_at = datetime.fromtimestamp(
                float(original.get("timestamp")) / 1000.0, tz=timezone.utc
            )
        except (TypeError, ValueError, OSError):
            sent_at = datetime.now(tz=timezone.utc)
        parent_id = str(original.get("parentId") or "") or None
        message = TlonIncomingMessage(
            chat_id=chat_id,
            chat_name=chat_id,
            chat_type="dm" if is_dm else "group",
            user_id=ship,
            user_name=ship,
            text=text,
            message_id=str(original.get("messageId") or approval_id(approval)),
            reply_to_message_id=parent_id,
            sent_at=sent_at,
            raw={"approvalReplay": approval_id(approval)},
        )
        if is_dm:
            await self._dispatch_message(message, is_dm=True, dispatch_reason="approved")
            return
        dispatch_text = await self._with_group_context(message, text, "approved")
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=False,
            dispatch_reason="approved",
        )

    async def _execute_ban_ship(self, ship: str) -> str:
        if not _is_patp(ship):
            return f"{ship} is not a valid ship."
        if not await self._block_ship(ship):
            return f"Could not block {ship}."
        await self._remove_from_dm_allowlist(ship)
        removed = [
            item
            for item in self._pending_approvals
            if approval_ship(item) == ship
        ]
        if removed:
            self._pending_approvals = [
                item
                for item in self._pending_approvals
                if approval_ship(item) != ship
            ]
            await self._persist_pending_approvals()
        suffix = f" Removed {len(removed)} pending request(s)." if removed else ""
        self._telemetry.approval_event("banned", "ship")
        return f"Blocked {ship}.{suffix}"

    async def _execute_unban(self, arg: str) -> str:
        ship = normalize_ship(arg)
        if not _is_patp(ship):
            return "Usage: /unban ~ship"
        if not await self._unblock_ship(ship):
            return f"Could not unblock {ship}."
        self._telemetry.approval_event("unbanned", "ship")
        return f"Unblocked {ship}."

    async def _handle_channel_access_command(
        self,
        raw_args: str,
        *,
        ctx_nest: Optional[str],
        reply_chat_id: str,
        reply_parent_id: Optional[str],
    ) -> None:
        if not self._settings_loaded:
            await self._load_settings_state()
        outcome = apply_channel_access_command(
            self._channel_rules, raw_args, ctx_nest=ctx_nest
        )
        reply = outcome.reply
        if outcome.new_rules is not None:
            self._channel_rules = outcome.new_rules
            if not await self._persist_channel_rules():
                reply += (
                    " Warning: could not save channelRules to %settings; this "
                    "change applies now but will revert when the gateway restarts."
                )
        if outcome.opened_nest and outcome.opened_nest not in self._monitored_channels:
            self._monitored_channels.add(outcome.opened_nest)
            self._settings_group_channels.add(outcome.opened_nest)
            await self._persist_settings_entry(
                SETTINGS_KEY_GROUP_CHANNELS, sorted(self._settings_group_channels)
            )
            reply += " Now monitoring this channel."
        await self._send_control_reply(reply_chat_id, reply_parent_id, reply)

    async def _handle_owner_listen_command(
        self,
        command_text: str,
        *,
        ctx_nest: Optional[str],
        reply_chat_id: str,
        reply_parent_id: Optional[str],
    ) -> None:
        # List-valued settings writes replace the whole entry, so base them on
        # store truth when the boot-time load failed.
        if not self._settings_loaded:
            await self._load_settings_state()
        raw_args = owner_listen_command_args(command_text)
        group_target = owner_listen_group_target(raw_args)
        if group_target is not None:
            action, flag = group_target
            channels = await self._fetch_group_channels(flag)
            if channels is None:
                await self._send_control_reply(
                    reply_chat_id,
                    reply_parent_id,
                    f"Could not look up channels for {flag}; try again shortly.",
                )
                return
            outcome = apply_owner_listen_group_command(
                self._owner_listen,
                action,
                flag,
                channels,
                owner_ship=self.tlon_config.owner_ship,
                bot_ship=self.tlon_config.ship_name,
                monitored_channels=frozenset(self._monitored_channels),
            )
        else:
            outcome = apply_owner_listen_command(
                self._owner_listen,
                raw_args,
                ctx_nest=ctx_nest,
                owner_ship=self.tlon_config.owner_ship,
                bot_ship=self.tlon_config.ship_name,
                monitored_channels=frozenset(self._monitored_channels),
            )
        failed_keys: list[str] = []
        for key, value in outcome.settings_changes.items():
            if not await self._persist_settings_entry(key, value):
                failed_keys.append(key)
        if outcome.monitor_nests:
            self._monitored_channels.update(outcome.monitor_nests)
            self._settings_group_channels.update(outcome.monitor_nests)
            if not await self._persist_settings_entry(
                SETTINGS_KEY_GROUP_CHANNELS,
                sorted(self._settings_group_channels),
            ):
                failed_keys.append(SETTINGS_KEY_GROUP_CHANNELS)
        reply = outcome.reply
        if failed_keys:
            reply += (
                f" Warning: could not save {', '.join(failed_keys)} to %settings; "
                "this change applies now but will revert when the gateway restarts."
            )
        await self._send_control_reply(reply_chat_id, reply_parent_id, reply)

    async def _handle_tlon_version_command(
        self,
        *,
        reply_chat_id: str,
        reply_parent_id: Optional[str],
    ) -> None:
        await self._send_control_reply(
            reply_chat_id, reply_parent_id, await self._version_reply()
        )

    async def _version_reply(self) -> str:
        return format_version_reply(
            adapter_version=plugin_version(),
            source=await git_source(),
            fingerprint=content_fingerprint(),
            cli_version=await self._cli_version(),
        )

    async def _cli_version(self) -> str:
        with cli_context("version"):
            result = await self._cli.run_command(("--version",))
        if not result.success:
            return f"unavailable ({result.error or 'tlon CLI failed'})"
        lines = (result.stdout or "").strip().splitlines()
        return lines[0] if lines else "unknown"

    async def _handle_tlon_command(
        self,
        command_text: str,
        *,
        reply_chat_id: str,
        reply_parent_id: Optional[str],
    ) -> None:
        """Debug command namespace: `/tlon version`, `/tlon status storage`,
        `/tlon status telemetry [test]`, `/tlon status binary`."""
        args = tlon_command_args(command_text)
        sub = args[0].lower() if args else ""
        target = args[1].lower() if len(args) > 1 else ""
        usage = "Usage: /tlon [version | status storage | status telemetry | status binary]"

        if sub == "version":
            self._telemetry.control_command("tlon version")
            reply = await self._version_reply()
        elif sub == "status" and target == "storage":
            self._telemetry.control_command("tlon status storage")
            reply = await self._storage_status_reply()
        elif sub == "status" and target == "telemetry":
            self._telemetry.control_command("tlon status telemetry")
            if len(args) > 2 and args[2].lower() == "test":
                # Blocking PostHog round trip — keep it off the event loop.
                reply = await asyncio.to_thread(self._telemetry.delivery_test)
            else:
                reply = self._telemetry.status_report()
        elif sub == "status" and target == "binary":
            self._telemetry.control_command("tlon status binary")
            reply = await self._binary_status_reply()
        elif sub == "status":
            reply = "Usage: /tlon status [storage|telemetry|binary]"
        else:
            reply = usage
        await self._send_control_reply(reply_chat_id, reply_parent_id, reply)

    async def _binary_status_reply(self) -> str:
        """Identify the exact `tlon` binary the adapter is invoking: its
        version, a content hash (so two builds of the same version are
        distinguishable), size, and build time."""
        cli = self.tlon_config.cli
        path = shutil.which(cli) or cli
        version = await self._cli_version()
        rows = [("Tlon Skill", version), ("Path", path)]
        try:
            digest, size, mtime = await asyncio.to_thread(_hash_binary, path)
            rows.append(("Build", f"sha256:{digest}"))
            rows.append(("Size", f"{size:,} bytes"))
            rows.append(("Built", mtime))
        except OSError as exc:
            rows.append(("Build", f"unreadable ({exc.strerror or exc})"))
        return "\n".join(f"*{key}*: **{value}**" for key, value in rows)

    async def _storage_status_reply(self) -> str:
        service = "unknown"
        has_s3_creds = False
        genuine_reachable = False
        if self._sse is not None:
            try:
                config = await self._sse.scry("/storage/configuration")
                update = config.get("storage-update") if isinstance(config, dict) else None
                configuration = update.get("configuration") if isinstance(update, dict) else None
                if isinstance(configuration, dict):
                    service = str(configuration.get("service") or "unknown")
            except Exception as exc:
                logger.debug("[tlon] storage configuration scry failed: %s", exc)
            try:
                creds = await self._sse.scry("/storage/credentials")
                update = creds.get("storage-update") if isinstance(creds, dict) else None
                credentials = update.get("credentials") if isinstance(update, dict) else None
                has_s3_creds = bool(
                    isinstance(credentials, dict)
                    and credentials.get("accessKeyId")
                    and credentials.get("endpoint")
                    and credentials.get("secretAccessKey")
                )
            except Exception as exc:
                logger.debug("[tlon] storage credentials scry failed: %s", exc)
            try:
                token = await self._sse.scry("/genuine/secret")
                genuine_reachable = bool(token)
            except Exception as exc:
                logger.debug("[tlon] genuine token scry failed: %s", exc)
        return format_storage_status(
            node_url=self.tlon_config.ship_url,
            url_hosted=node_url_is_hosted(self.tlon_config.ship_url),
            hosting_forced=self.tlon_config.hosting,
            service=service,
            has_s3_creds=has_s3_creds,
            genuine_reachable=genuine_reachable,
        )

    async def _maybe_handle_control_command(
        self,
        message: TlonIncomingMessage,
        command_text: str,
        *,
        ctx_nest: Optional[str],
    ) -> bool:
        """Deterministic owner-only commands; True when the message is consumed.

        These run before the attention gate so they work with or without a
        mention, even when the bot would not otherwise respond. ``ctx_nest``
        is None for DMs.
        """
        if not self._is_owner(message.user_id):
            return False
        reply_parent_id = None if ctx_nest is None else message.reply_to_message_id
        if is_owner_listen_command(command_text):
            if self._mark_seen(message):
                self._telemetry.control_command("owner-listen")
                await self._handle_owner_listen_command(
                    command_text,
                    ctx_nest=ctx_nest,
                    reply_chat_id=message.chat_id,
                    reply_parent_id=reply_parent_id,
                )
            return True
        if is_tlon_command(command_text):
            if self._mark_seen(message):
                await self._handle_tlon_command(
                    command_text,
                    reply_chat_id=message.chat_id,
                    reply_parent_id=reply_parent_id,
                )
            return True
        if is_tlon_version_command(command_text):
            # Legacy alias, kept alongside `/tlon version`.
            if self._mark_seen(message):
                self._telemetry.control_command("tlon-version")
                await self._handle_tlon_version_command(
                    reply_chat_id=message.chat_id,
                    reply_parent_id=reply_parent_id,
                )
            return True
        approval_command = parse_approval_command(command_text)
        if approval_command is not None:
            if self._mark_seen(message):
                action, arg = approval_command
                self._telemetry.control_command(action)
                await self._handle_approval_command(
                    action,
                    arg,
                    reply_chat_id=message.chat_id,
                    reply_parent_id=reply_parent_id,
                )
            return True
        if is_channel_access_command(command_text):
            if self._mark_seen(message):
                self._telemetry.control_command("channel-access")
                await self._handle_channel_access_command(
                    channel_access_command_args(command_text),
                    ctx_nest=ctx_nest,
                    reply_chat_id=message.chat_id,
                    reply_parent_id=reply_parent_id,
                )
            return True
        return False

    async def _send_control_reply(
        self,
        chat_id: str,
        parent_id: Optional[str],
        text: str,
    ) -> None:
        with cli_context("control_plane"):
            if parent_id and not _is_dm_chat_id(chat_id):
                result = await self._cli.send_reply(chat_id, parent_id, text)
            else:
                result = await self._cli.send_message(chat_id, text)
        if not result.success:
            logger.warning("[tlon] control command reply failed: %s", result.error)

    async def _load_bot_nickname(self) -> None:
        if self._sse is None:
            return
        try:
            profile = await self._sse.scry("/contacts/v1/self.json")
            nickname = extract_profile_nickname(profile)
        except Exception as exc:
            logger.debug("[tlon] could not fetch self profile nickname: %s", exc)
            return
        if not nickname:
            logger.debug("[tlon] self profile nickname is empty")
            return
        self._mention_matcher = self._build_mention_matcher(nickname=nickname)
        logger.info("[tlon] loaded bot nickname for wake detection: %s", nickname)

    async def _start_gateway_status(self) -> None:
        try:
            await self._gateway_status.start()
        except Exception as exc:
            logger.warning("[tlon] gateway-status activation failed: %s", exc)
            self._telemetry.error("gateway_status", exc, operation="start")

    async def _stop_gateway_status(self, reason: str) -> None:
        try:
            await self._gateway_status.stop(reason)
        except Exception as exc:
            logger.warning("[tlon] gateway-status shutdown failed: %s", exc)

    async def _connect_sse(self) -> None:
        await self._close_sse()
        self._sse = TlonSSEClient(self.tlon_config)
        await self._sse.authenticate()
        await self._sse.open()
        await self._sse.subscribe("channels", "/v2")
        await self._sse.subscribe("chat", "/v3")
        await self._sse.subscribe("settings", f"/desk/{SETTINGS_DESK}")
        await self._sse.subscribe("groups", "/v1/foreigns")

    async def _close_sse(self, *, graceful: bool = True) -> None:
        if self._sse is not None:
            try:
                await self._sse.close(graceful=graceful)
            finally:
                self._sse = None

    async def _run_stream(self) -> None:
        backoff_idx = 0
        while self._running:
            try:
                if self._sse is None:
                    await self._connect_sse()
                    # Settings events do not replay, so re-sync owner-listen
                    # state after every reconnect.
                    await self._load_settings_state()
                assert self._sse is not None
                async for event in self._sse.events():
                    if not self._running:
                        return
                    backoff_idx = 0
                    await self._route_stream_event(event)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                if not self._running:
                    return
                logger.warning("[tlon] SSE stream error: %s", exc)
                await self._close_sse(graceful=False)
                delay = RECONNECT_BACKOFF_SECONDS[min(backoff_idx, len(RECONNECT_BACKOFF_SECONDS) - 1)]
                backoff_idx += 1
                self._telemetry.sse_reconnect(
                    attempt=backoff_idx, delay_seconds=delay, error=exc
                )
                await asyncio.sleep(delay)

    async def _route_stream_event(self, event: Any) -> None:
        """Dispatch one SSE event; a handler bug must not masquerade as a
        stream error (which would trigger a spurious reconnect). The bad event
        is reported and skipped, and the stream keeps flowing."""
        try:
            if event.app == "channels":
                await self._handle_channel_event(event.json)
            elif event.app == "chat":
                await self._handle_dm_event(event.json)
            elif event.app == "settings":
                self._handle_settings_event(event.json)
            elif event.app == "groups":
                await self._handle_foreigns(event.json)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("[tlon] %s event handler failed", event.app)
            self._telemetry.error("event_handler", exc, app=event.app)

    async def _handle_channel_event(self, raw: Any) -> None:
        if not isinstance(raw, dict):
            return
        nest = raw.get("nest")
        if not isinstance(nest, str) or not nest:
            return
        if nest not in self._monitored_channels:
            if self.tlon_config.auto_discover and (nest.startswith("chat/") or nest.startswith("heap/")):
                self._monitored_channels.add(nest)
                logger.info("[tlon] auto-discovered channel %s", nest)
            else:
                return

        message = parse_channel_message(raw, self_ship=self.tlon_config.ship_name)
        if message is None:
            return

        is_mentioned = self._mention_matcher.mentioned(message.text)
        clean_text = (
            self._mention_matcher.strip_leading(message.text)
            if is_mentioned
            else message.text.strip()
        )

        if await self._maybe_handle_control_command(
            message, clean_text, ctx_nest=message.chat_id
        ):
            return

        is_authorized = self._user_authorized(
            message.user_id, is_dm=False, nest=message.chat_id
        )
        is_owner_listen = self._is_owner(message.user_id) and owner_listen_active(
            self._owner_listen,
            message.chat_id,
            owner_ship=self.tlon_config.owner_ship,
            bot_ship=self.tlon_config.ship_name,
        )
        is_participated_thread = self._is_participated_thread(message)
        is_free_response = self.tlon_config.group_free_response_enabled(message.chat_id)
        decision = resolve_attention(
            AttentionFacts(
                is_dm=False,
                is_authorized=is_authorized,
                has_text=bool(clean_text),
                is_mentioned=is_mentioned,
                is_owner_listen=is_owner_listen,
                is_free_response=is_free_response,
                is_participated_thread=is_participated_thread,
            )
        )
        if not decision.dispatch:
            if decision.reason == "unauthorized":
                if is_mentioned and _is_patp(message.user_id):
                    await self._queue_channel_approval(message, clean_text)
                else:
                    logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if not self._mark_seen(message):
            return
        if not self._passes_group_loop_safety(message):
            return
        dispatch_text = await self._with_group_context(message, clean_text, decision.reason)
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=False,
            mark_seen=False,
            dispatch_reason=decision.reason,
        )

    async def _handle_dm_event(self, raw: Any) -> None:
        if isinstance(raw, list):
            await self._handle_dm_invites(raw)
            return
        message = parse_dm_message(raw, self_ship=self.tlon_config.ship_name)
        if message is None:
            return
        if await self._maybe_handle_control_command(
            message, message.text.strip(), ctx_nest=None
        ):
            return
        if not self._user_authorized(message.user_id, is_dm=True):
            if _is_patp(message.user_id):
                await self._queue_dm_approval(message)
            else:
                logger.info(
                    "[tlon] ignoring unauthorized message in %s", message.chat_id
                )
            return
        await self._dispatch_message(message, is_dm=True)

    async def _handle_dm_invites(self, ships: list) -> None:
        for raw_ship in ships:
            ship = normalize_ship(str(raw_ship or ""))
            if not _is_patp(ship) or ship == self.tlon_config.ship_name:
                continue
            if ship in self._processed_dm_invites:
                continue
            self._processed_dm_invites.add(ship)
            await self._handle_dm_invite(ship)

    async def _handle_dm_invite(self, ship: str) -> None:
        if self._user_authorized(ship, is_dm=True):
            with cli_context("invite_rsvp"):
                result = await self._cli.run_command(("dms", "accept", ship))
            if result.success:
                logger.info("[tlon] auto-accepted DM invite from %s", ship)
            else:
                logger.warning(
                    "[tlon] failed to accept DM invite from %s: %s", ship, result.error
                )
            return
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring DM invite from unauthorized %s", ship)
            return
        await self._queue_approval(
            approval_kind="dm",
            requesting_ship=ship,
            message_preview=DM_INVITE_PREVIEW,
        )

    async def _process_pending_dm_invites(self) -> None:
        """Catch DM invites that arrived while the gateway was down."""
        if self._sse is None:
            return
        try:
            invited = await self._sse.scry("/chat/dm/invited")
        except Exception as exc:
            logger.debug("[tlon] could not scry pending DM invites: %s", exc)
            return
        if isinstance(invited, list):
            await self._handle_dm_invites(invited)

    def _group_invite_authorized(self, inviter: str) -> bool:
        """Owner and the group-invite allowlist auto-accept; else queue."""
        ship = normalize_ship(inviter)
        if self.tlon_config.allow_all_users:
            return True
        if self.tlon_config.owner_ship and ship == self.tlon_config.owner_ship:
            return True
        return ship in self._settings_group_invite_allowlist

    async def _handle_foreigns(self, payload: Any) -> None:
        """Process the %groups foreigns map (live sub or catch-up scry)."""
        for invite in parse_foreigns(payload):
            flag = invite["groupFlag"]
            if flag in self._processed_group_invites:
                continue
            self._processed_group_invites.add(flag)
            await self._handle_group_invite(
                flag, inviter=invite["from"], title=invite["title"]
            )

    async def _handle_group_invite(self, flag: str, *, inviter: str, title: str) -> None:
        if self._group_invite_authorized(inviter):
            if await self._accept_group_invite(flag):
                logger.info("[tlon] auto-accepted group invite %s from %s", flag, inviter)
            return
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring group invite %s from unauthorized %s", flag, inviter)
            return
        await self._queue_approval(
            approval_kind="group",
            requesting_ship=inviter,
            group_flag=flag,
            group_title=title,
        )

    async def _accept_group_invite(self, flag: str) -> bool:
        with cli_context("invite_rsvp"):
            result = await self._cli.run_command(("groups", "accept-invite", flag))
        if not result.success:
            logger.warning("[tlon] failed to accept group invite %s: %s", flag, result.error)
            self._telemetry.error(
                "approval", result.error or "group accept failed", operation="group_accept"
            )
            return False
        await self._adopt_group_channels(flag)
        return True

    async def _fetch_group_channels(self, flag: str) -> Optional[set[str]]:
        """Channel nests of a group the bot belongs to; None when the lookup
        is unavailable."""
        if self._sse is None:
            return None
        try:
            init = await self._sse.scry("/groups-ui/v7/init")
        except Exception as exc:
            logger.debug("[tlon] could not scry group channels for %s: %s", flag, exc)
            return None
        groups = init.get("groups") if isinstance(init, dict) else None
        group = groups.get(flag) if isinstance(groups, dict) else None
        channels = group.get("channels") if isinstance(group, dict) else None
        if not isinstance(channels, dict):
            return set()
        return {
            nest
            for nest in channels
            if isinstance(nest, str)
            and nest.split("/", 1)[0] in ("chat", "heap", "diary")
        }

    async def _adopt_group_channels(self, flag: str) -> None:
        """Pull a newly-joined group's channels into the monitored set so the
        bot is addressable there, and persist them to groupChannels."""
        channels = await self._fetch_group_channels(flag)
        new_channels = (channels or set()) - self._monitored_channels
        if not new_channels:
            return
        self._monitored_channels.update(new_channels)
        self._settings_group_channels.update(new_channels)
        await self._persist_settings_entry(
            SETTINGS_KEY_GROUP_CHANNELS, sorted(self._settings_group_channels)
        )
        logger.info("[tlon] monitoring %d channel(s) from joined group %s", len(new_channels), flag)

    async def _process_pending_group_invites(self) -> None:
        """Catch group invites that arrived while the gateway was down."""
        if self._sse is None:
            return
        try:
            init = await self._sse.scry("/groups-ui/v7/init")
        except Exception as exc:
            logger.debug("[tlon] could not scry pending group invites: %s", exc)
            return
        foreigns = init.get("foreigns") if isinstance(init, dict) else None
        if foreigns is not None:
            await self._handle_foreigns(foreigns)

    async def _with_group_context(
        self,
        message: TlonIncomingMessage,
        clean_text: str,
        reason: str,
    ) -> str:
        """Prepend recent channel or thread history so group replies have context."""
        limit = self.tlon_config.context_messages
        if limit <= 0 or self._sse is None:
            return clean_text
        scry = self._sse.scry
        try:
            if message.reply_to_message_id:
                entries = await fetch_thread_context(
                    scry, message.chat_id, message.reply_to_message_id, limit
                )
                enriched = build_thread_context(
                    entries,
                    current_text=clean_text,
                    current_id=message.message_id,
                    limit=limit,
                )
            else:
                entries = await fetch_channel_history(scry, message.chat_id, limit)
                enriched = build_channel_context(
                    entries,
                    current_text=clean_text,
                    current_id=message.message_id,
                    is_mention=reason == "mention",
                    limit=limit,
                )
        except Exception as exc:
            logger.debug("[tlon] context fetch failed for %s: %s", message.chat_id, exc)
            self._telemetry.error(
                "context_fetch", exc, isThread=bool(message.reply_to_message_id)
            )
            return clean_text
        return enriched or clean_text

    def _is_participated_thread(self, message: TlonIncomingMessage) -> bool:
        if not message.reply_to_message_id:
            return False
        return self._thread_key(message.chat_id, message.reply_to_message_id) in self._participated_threads

    def _passes_group_loop_safety(self, message: TlonIncomingMessage) -> bool:
        known_bots = self.tlon_config.known_bot_users
        if not known_bots:
            return True

        channel = message.chat_id
        sender = normalize_ship(message.user_id)
        if sender in known_bots:
            count = self._known_bot_consecutive_by_channel.get(channel, 0) + 1
            self._known_bot_consecutive_by_channel[channel] = count
            if count > self.tlon_config.max_consecutive_bot_responses:
                logger.info(
                    "[tlon] dropping known-bot message from %s in %s after %s consecutive dispatch attempts",
                    sender,
                    channel,
                    count,
                )
                return False
            return True

        self._known_bot_consecutive_by_channel[channel] = 0
        return True

    async def _dispatch_message(
        self,
        message: TlonIncomingMessage,
        *,
        is_dm: bool,
        mark_seen: bool = True,
        dispatch_reason: str = "dm",
    ) -> None:
        if not self._user_authorized(
            message.user_id,
            is_dm=is_dm,
            nest="" if is_dm else message.chat_id,
        ):
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if mark_seen and not self._mark_seen(message):
            return

        self._telemetry.start_reply(
            message.chat_id,
            chat_type="dm" if is_dm else "groupChannel",
            is_thread=bool(message.reply_to_message_id),
            sender_role="owner" if self._is_owner(message.user_id) else "user",
            dispatch_reason=dispatch_reason,
        )
        # Thread context flows for DMs too, so the bot replies inside a DM
        # thread instead of the main conversation.
        reply_context = message.reply_to_message_id
        source = self.build_source(
            chat_id=message.chat_id,
            chat_name=message.chat_name,
            chat_type=message.chat_type,
            user_id=message.user_id,
            user_name=message.user_name,
            thread_id=reply_context,
            message_id=message.message_id,
        )
        event = MessageEvent(
            text=message.text,
            message_type=MessageType.TEXT,
            source=source,
            raw_message=message.raw,
            message_id=message.message_id,
            reply_to_message_id=reply_context,
            timestamp=message.sent_at,
        )
        await self.handle_message(event)

    async def on_processing_start(self, event: MessageEvent) -> None:
        await self._computing_presence.refresh_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )

    async def on_processing_complete(self, event: MessageEvent, outcome: Any) -> None:
        await self._computing_presence.stop_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )
        self._telemetry.finish_reply(
            event.source.chat_id,
            processing_outcome=_processing_outcome_value(outcome),
        )

    @staticmethod
    def _presence_run_id(event: MessageEvent) -> str:
        source = getattr(event, "source", None)
        return str(
            getattr(event, "message_id", None)
            or getattr(source, "message_id", None)
            or getattr(source, "thread_id", None)
            or getattr(source, "chat_id", None)
            or id(event)
        )

    def _mark_seen(self, message: TlonIncomingMessage) -> bool:
        key = f"{message.chat_type}:{message.chat_id}:{message.message_id}"
        if key in self._seen_ids:
            return False
        self._seen_ids.add(key)
        self._seen_order.append(key)
        if len(self._seen_order) > 1000:
            old = self._seen_order.pop(0)
            self._seen_ids.discard(old)
        return True

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        content = (content or "")[: self.MAX_MESSAGE_LENGTH]
        metadata = metadata or {}
        # Core anchors every reply to the triggering message (reply_to), but
        # Tlon conversations are linear: reply top-level unless the
        # conversation is already a thread (metadata.thread_id carries the
        # thread ROOT, which is what Tlon replies must attach to). This holds
        # for both group channels and DMs — DM threads thread too.
        # reply_in_thread=true restores always-thread-on-the-trigger.
        thread_parent = str(metadata.get("thread_id") or "") or None
        if thread_parent is None and self.tlon_config.reply_in_thread:
            thread_parent = reply_to
        is_thread_reply = bool(thread_parent)
        with cli_context("delivery", conversation=chat_id):
            if is_thread_reply:
                # parentAuthor: honor what Hermes passes; otherwise the CLI
                # attributes the reference to the bot. (We don't assume a DM
                # partner authored the thread root.)
                parent_author = metadata.get("parent_author") or None
                result = await self._cli.send_reply(
                    chat_id,
                    thread_parent,
                    content,
                    parent_author=parent_author,
                )
            else:
                result = await self._cli.send_message(chat_id, content)
        self._telemetry.record_delivery(chat_id, content=content, success=result.success)

        raw_response = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
        if result.success and is_thread_reply and thread_parent:
            self._participated_threads.add(self._thread_key(chat_id, thread_parent))
        return SendResult(
            success=result.success,
            message_id=result.message_id,
            error=result.error,
            raw_response=raw_response,
            retryable=result.returncode == 124,
        )

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        chat_type = "dm" if normalize_ship(chat_id) == chat_id and chat_id.startswith("~") else "group"
        return {"name": chat_id, "type": chat_type}

    @staticmethod
    def _thread_key(chat_id: str, post_id: str) -> str:
        return f"{chat_id}:{post_id}"


def _env_enablement() -> dict | None:
    tlon = TlonConfig.from_env()
    if not tlon.is_complete():
        return None
    seed: dict[str, Any] = {
        "node_url": tlon.ship_url,
        "node_id": tlon.ship_name,
        "cli": tlon.cli,
    }
    if tlon.ship_code:
        seed["access_code"] = tlon.ship_code
    if tlon.cookie:
        seed["cookie"] = tlon.cookie
    if tlon.channels:
        seed["channels"] = ",".join(tlon.channels)
    if tlon.auto_discover:
        seed["auto_discover"] = True
    if tlon.bot_mentions:
        seed["bot_mentions"] = ",".join(tlon.bot_mentions)
    if tlon.free_response_channels:
        seed["free_response_channels"] = ",".join(tlon.free_response_channels)
    if not tlon.require_mention:
        seed["require_mention"] = False
    if tlon.known_bot_users:
        seed["known_bot_users"] = ",".join(sorted(tlon.known_bot_users))
    if not tlon.owner_listen:
        seed["owner_listen"] = False
    if tlon.owner_listen_default != "owned":
        seed["owner_listen_default"] = tlon.owner_listen_default
    if tlon.owner_listen_disabled_channels:
        seed["owner_listen_disabled_channels"] = ",".join(tlon.owner_listen_disabled_channels)
    if tlon.owner_listen_enabled_channels:
        seed["owner_listen_enabled_channels"] = ",".join(tlon.owner_listen_enabled_channels)
    if tlon.context_messages != DEFAULT_CONTEXT_MESSAGES:
        seed["context_messages"] = tlon.context_messages
    if tlon.telemetry_enabled:
        seed["telemetry"] = True
    if tlon.telemetry_api_key:
        seed["telemetry_api_key"] = tlon.telemetry_api_key
    if tlon.telemetry_host:
        seed["telemetry_host"] = tlon.telemetry_host
    if tlon.telemetry_debug:
        seed["telemetry_debug"] = True
    if tlon.owner_ship:
        seed["owner_ship"] = tlon.owner_ship
    if tlon.gateway_status_owner:
        seed["gateway_status_owner"] = tlon.gateway_status_owner
    home = tlon.default_home_channel_id()
    if home:
        seed["home_channel"] = {"chat_id": home, "name": home}
    return seed


def _session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def _registered_toolset(tool_name: str) -> str:
    try:
        from model_tools import get_toolset_for_tool
    except Exception:
        return ""
    try:
        return str(get_toolset_for_tool(tool_name) or "").strip()
    except Exception:
        return ""


def _is_owner_only_tlon_tool(tool_name: str) -> bool:
    tool = str(tool_name or "").strip()
    tool_key = tool.casefold()
    if tool_key in OWNER_ONLY_TLON_TOOLS:
        return True

    toolset = _registered_toolset(tool)
    toolset_key = toolset.casefold()
    if toolset_key in OWNER_ONLY_TLON_TOOLSETS:
        return True
    return tool_key.startswith("mcp_") or toolset_key.startswith("mcp-")


def _tool_access_block(message: str) -> dict:
    return {"action": "block", "message": message}


def block_tlon_session_tool(tool_name: str, args: Optional[dict] = None, **_kwargs: Any) -> Optional[dict]:
    del args
    if _session_env("HERMES_SESSION_PLATFORM", "").lower() != "tlon":
        return None

    tool = str(tool_name or "").strip()
    owner = TlonConfig.from_env().owner_ship
    if not owner:
        return _tool_access_block(
            "Blocked: Tlon owner identity is not configured. Set TLON_OWNER_SHIP "
            "before allowing tool use from Tlon chat sessions."
        )

    if tool == "skill_manage":
        return _tool_access_block(
            "Blocked: Tlon chat sessions use the managed Tlon prompt and "
            "plugin-owned tlon skill. Do not create or modify Hermes skills "
            "while handling a Tlon message."
        )

    if not _is_owner_only_tlon_tool(tool):
        return None

    sender = normalize_ship(_session_env("HERMES_SESSION_USER_ID", ""))
    if not sender:
        return _tool_access_block(
            f"Blocked: {tool} is owner-only in Tlon chats and no Tlon sender "
            "identity is available."
        )
    if sender != owner:
        return _tool_access_block(f"Blocked: {tool} is owner-only in Tlon chats.")
    return None


async def _standalone_send(
    pconfig,
    chat_id: str,
    message: str,
    *,
    thread_id: Optional[str] = None,
    media_files: Optional[list[str]] = None,
    force_document: bool = False,
) -> Dict[str, Any]:
    del media_files, force_document
    extra = getattr(pconfig, "extra", {}) or {}
    tlon = TlonConfig.from_env(extra)
    if not tlon.is_complete():
        return {"error": "tlon standalone send: TLON node URL/id/access code not configured"}
    cli = TlonCLI(tlon)
    if thread_id:
        parent_author = chat_id if _is_dm_chat_id(chat_id) else None
        result = await cli.send_reply(chat_id, thread_id, message, parent_author=parent_author)
    else:
        result = await cli.send_message(chat_id, message)
    if not result.success:
        return {"error": result.error or "tlon standalone send failed"}
    return {
        "success": True,
        "platform": "tlon",
        "chat_id": chat_id,
        "message_id": result.message_id,
    }


def register(ctx) -> None:
    ctx.register_hook("pre_tool_call", handle_pre_tool_call)
    ctx.register_hook("pre_tool_call", block_tlon_session_tool)
    ctx.register_hook("post_api_request", handle_post_api_request)
    ctx.register_hook("post_api_request", handle_post_api_request_telemetry)
    ctx.register_hook("post_tool_call", handle_post_tool_call_telemetry)

    ctx.register_tool(
        name="tlon",
        toolset="tlon",
        schema=TLON_TOOL_SCHEMA,
        handler=handle_tlon_tool,
        check_fn=check_tlon_tool_requirements,
        is_async=True,
        description=TLON_TOOL_DESCRIPTION,
        emoji="T",
    )
    ctx.register_tool(
        name="image_search",
        toolset="tlon",
        schema=IMAGE_SEARCH_TOOL_SCHEMA,
        handler=handle_image_search_tool,
        check_fn=check_image_search_requirements,
        is_async=True,
        description=IMAGE_SEARCH_TOOL_DESCRIPTION,
        emoji="I",
    )

    skill_path = resolve_tlon_skill_path()
    if skill_path is not None:
        ctx.register_skill(
            "tlon",
            skill_path,
            description="Tlon CLI command guide for the Hermes tlon tool.",
        )

    ctx.register_platform(
        name="tlon",
        label="Tlon",
        adapter_factory=lambda cfg: TlonAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        is_connected=is_connected,
        required_env=REQUIRED_ENV,
        install_hint="pip install aiohttp && npm install -g @tloncorp/tlon-skill",
        env_enablement_fn=_env_enablement,
        cron_deliver_env_var="TLON_HOME_CHANNEL",
        standalone_sender_fn=_standalone_send,
        # Deliberately no allowed_users_env/allow_all_env: the adapter enforces
        # its own access policy (see TlonAdapter.enforces_own_access_policy),
        # and exporting an env allowlist would re-engage core's gate, which
        # cannot see settings-store grants (approved DMs, open channels).
        max_message_length=MAX_MESSAGE_LENGTH,
        emoji="T",
        pii_safe=False,
        allow_update_command=True,
        platform_hint=(
            "You are communicating through Tlon Messenger on Urbit. "
            "Users are identified by ship names such as ~sampel-palnet. "
            "You are an assistant running on the configured Tlon bot node; "
            "that node has its own Tlon profile, contacts, groups, channels, "
            "and settings. When the configured owner asks to change your "
            "Tlon nickname, avatar, bio, status, or cover image, use the tlon "
            "tool rather than saying an AI assistant has no profile. For "
            "avatars and covers, first upload a direct raster image URL or "
            "local image with tlon upload, then set the returned uploaded URL "
            "with contacts update-profile. If image_search is available, use "
            "it to find image URLs for user-requested avatars, covers, and "
            "other image media. Do not use SVG profile images. "
            "For Tlon reads and administration, use the tlon tool; if unsure, "
            "load skill_view(\"tlon-platform:tlon\") or run a tlon subcommand "
            "with --help. "
            "When a user asks you to create a Tlon group for them, use "
            "groups create-owned with --owner set to that user's ship so they "
            "are invited and made admin. "
            "To reply to the current conversation, just write your reply and "
            "Hermes delivers it. To post somewhere else (e.g. a channel of a "
            "group you host or a one-to-one DM), use the tlon tool's posts "
            "send with that target; reserve dms send for group-DM club IDs "
            "starting with 0v. Sending plain text to the current conversation "
            "that way is blocked. To send an image anywhere — including the "
            "current conversation — first 'tlon upload <direct-image-url>', then "
            "'tlon posts send <target> [caption] --image <uploaded-url>'. "
            "The platform adapter directly handles owner chat commands for "
            "access and configuration: /owner-listen (no-mention listening), "
            "/channel-access (per-channel open access), /pending, /allow, "
            "/reject, /ban, /unban, /banned (approvals for unknown ships), "
            "and /tlon (version, status storage, status telemetry, status "
            "binary — debug info). Point the owner at those commands when asked "
            "rather than changing configuration yourself. "
            "Use concise plain text and basic markdown."
        ),
    )
