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
import math
import os
import re
import shutil
import time
import unicodedata
import uuid
from collections import OrderedDict, deque
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageType,
    SendResult,
)

from .approval import (
    DM_INVITE_PREVIEW,
    SETTINGS_KEY_AUTO_ACCEPT_DM_INVITES,
    SETTINGS_KEY_DEFAULT_AUTHORIZED_SHIPS,
    SETTINGS_KEY_DM_ALLOWLIST,
    SETTINGS_KEY_GROUP_INVITE_ALLOWLIST,
    MAX_PENDING_APPROVALS_A2UI,
    SETTINGS_KEY_PENDING_APPROVALS,
    approval_group_flag,
    approval_id,
    approval_nest,
    approval_ship,
    approval_type,
    build_approval_card,
    build_pending_approvals_response,
    create_pending_approval,
    error_progress_flags,
    find_approval,
    find_duplicate,
    format_approval_request,
    format_blocked_list,
    format_confirmation,
    parse_approval_command,
    parse_dm_allowlist,
    parse_foreigns,
    parse_pending_approvals,
    parse_ship_list,
    prune_expired,
    remove_approval,
    serialize_blob,
    settings_bool,
    validate_a2ui_card,
)
from .attention import AttentionFacts, resolve_attention
from .channel_access import (
    SETTINGS_KEY_AUTO_DISCOVER_CHANNELS,
    SETTINGS_KEY_CHANNEL_RULES,
    add_channel_allowed_ship,
    apply_channel_access_command,
    channel_access_command_args,
    effective_allowed_ships,
    is_channel_access_command,
    is_channel_open,
    parse_channel_rules,
)
from .cite import resolve_cites
from .bot_info import (
    BOT_INFO_CONTACT_MARK,
    build_bot_info_json,
    build_bot_info_poke,
    extract_bot_info_value,
    resolve_harness_version,
)
from .commands import command_detection_regex, is_adapter_command, is_core_command
from .history import (
    MessageCache,
    build_channel_context,
    build_thread_context,
    fetch_channel_history,
    fetch_post,
    fetch_post_author,
    fetch_reply,
    fetch_thread_context,
)
from .media import (
    PreparedMedia,
    combine_blob_fields,
    prepare_inbound_media,
    render_content_with_blob,
)
from .mention import (
    BotMentionMatcher,
    build_bot_mention_terms,
    extract_profile_avatar,
    extract_profile_nickname,
)
from .migration import MigrationCommandController, is_migrate_command
from .owner_listen import (
    SETTINGS_DESK,
    SETTINGS_KEY_GROUP_CHANNELS,
    OwnerListenState,
    apply_owner_listen_command,
    apply_owner_listen_group_command,
    apply_owner_listen_settings_event,
    canonicalize_nest,
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
from .nudge import (
    ActiveHoursBaseline,
    NudgeSettingsSnapshot,
    OwnerActivityPersistence,
    PendingNudge,
    PendingNudgePersistence,
    SETTINGS_KEY_LAST_NUDGE_STAGE,
    SETTINGS_KEY_LAST_OWNER_MESSAGE_AT,
    SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE,
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_END,
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_START,
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_TIMEZONE,
    SETTINGS_KEY_PENDING_NUDGE,
    TlonNudgeScheduler,
    _valid_epoch_ms,
    is_nudge_eligible,
    owner_activity_from_snapshot,
    parse_last_nudge_stage,
    parse_pending_nudge,
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
from .lens import (
    LensOutput,
    LensRun,
    LensRunStore,
    RetryDispatch,
    TlonLensRecorder,
    TlonLensSync,
    build_retry_dispatch,
    clear_active_recorder,
    context_lens_reference_blob,
    default_lens_store_path,
    handle_post_api_request_lens,
    handle_post_tool_call_lens,
    handle_pre_tool_call_lens,
    set_active_recorder,
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
    TlonAuthError,
    TlonChannelError,
    TlonCLI,
    TlonConfig,
    TlonDeadlineCallback,
    TlonGatewayStatus,
    TlonIncomingMessage,
    TlonReaction,
    TlonSSEClient,
    TlonStreamStaleError,
    ChannelReactsSnapshot,
    TlonTerminalActionError,
    extract_inline_message_text,
    format_post_id,
    normalize_ship,
    parse_channel_reacts_snapshot,
    parse_channel_message,
    parse_dm_reaction,
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
from .sanitize import (
    ends_with_directive_prefix,
    find_executable_block_directives,
    find_block_directives,
    strip_block_directives,
    strip_trailing_directive_prefix,
)
from .tlon_tool import (
    CREDENTIAL_FLAGS_WITH_VALUE,
    TLON_TOOL_DESCRIPTION,
    TLON_TOOL_SCHEMA,
    clear_diary_migration_notification_sender,
    check_tlon_tool_requirements,
    diary_target_blocked_message,
    handle_tlon_tool,
    resolve_tlon_product_guide_path,
    resolve_tlon_skill_path,
    set_diary_migration_notification_sender,
    split_tlon_command,
    start_diary_migration_discovery,
    wait_for_pending_discovery,
)

logger = logging.getLogger(__name__)

RECONNECT_BACKOFF_SECONDS = (2, 5, 10, 30, 60)
# A transient poke failure would otherwise leave a healthy long-lived bot
# unidentified until an unrelated reconnect or a restart, so the write is
# retried in place. Reads are never retried: a failed read skips entirely.
BOT_INFO_PUBLISH_ATTEMPTS = 3
BOT_INFO_PUBLISH_BACKOFF_SECONDS = (2, 8)
# Distinguishes "not resolved yet" from a resolved-but-absent host version, so
# a missing version is looked up once rather than on every publish.
_UNSET_HARNESS_VERSION = object()
CITE_RESOLUTION_BUDGET_SECONDS = 5.0
RENOTIFY_COOLDOWN_MS = 10 * 60 * 1000
# Window in which a repeated retry request for the same lensId is a no-op
# (mirrors RETRY_DEDUP_MS in the gateway monitor).
RETRY_DEDUP_SECONDS = 60.0
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
    "TLON_REACTION_LEVEL",
    "TLON_TELEMETRY",
    "TLON_TELEMETRY_API_KEY",
    "TLON_TELEMETRY_HOST",
    "TLON_TELEMETRY_DEBUG",
    "TLON_CLI",
    "TLON_SSE_READ_TIMEOUT_SECONDS",
    "TLON_SSE_STALE_THRESHOLD_SECONDS",
    "TLON_SSE_WATCHDOG_INTERVAL_SECONDS",
    "TLON_GATEWAY_STATUS",
    "TLON_GATEWAY_STATUS_OWNER",
    "TLON_REENGAGEMENT_ENABLED",
    "TLON_NUDGE_TICK_INTERVAL_MS",
    "TLON_NUDGE_ACTIVE_HOURS_START",
    "TLON_NUDGE_ACTIVE_HOURS_END",
    "TLON_NUDGE_ACTIVE_HOURS_TIMEZONE",
    "TLON_TIMEZONE",
    "BRAVE_SEARCH_API_KEY",
    "BRAVE_API_KEY",
]
_TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class _NudgeHookResult:
    pending: Optional[PendingNudge] = None
    inject_context: bool = False


@dataclass(frozen=True)
class _StreamWorkItem:
    app: str
    raw: Any
    message: Optional[TlonIncomingMessage] = None
    nudge_hook: _NudgeHookResult = _NudgeHookResult()
    nudge_settings_handled: bool = False


_NUDGE_SNAPSHOT_FIELDS = {
    SETTINGS_KEY_LAST_OWNER_MESSAGE_AT: "last_owner_message_at",
    SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE: "last_owner_message_date",
    SETTINGS_KEY_PENDING_NUDGE: "pending_nudge_raw",
    SETTINGS_KEY_LAST_NUDGE_STAGE: "last_nudge_stage",
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_START: "active_hours_start",
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_END: "active_hours_end",
    SETTINGS_KEY_NUDGE_ACTIVE_HOURS_TIMEZONE: "active_hours_timezone",
}

# Absorb a normal slow dispatch without stalling SSE ingestion, but apply
# transport backpressure rather than accumulating unbounded work under
# sustained overload.
_STREAM_EVENT_QUEUE_MAXSIZE = 1024
_OWNER_BLOCK_REASON_MAX_CHARS = 500

try:
    import aiohttp as _aiohttp  # noqa: F401

    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False


def _is_dm_chat_id(chat_id: str) -> bool:
    chat = str(chat_id or "").strip()
    return bool(
        chat.startswith("~") and "/" not in chat and normalize_ship(chat) == chat
    )


# `/tlon ...` debug namespace. Does not match `/tlon-version` (legacy alias)
# because "-" is neither whitespace nor end-of-string after "tlon".
# Detection lives in the command registry (commands.py).
_TLON_COMMAND_RE = command_detection_regex("tlon")
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
    current_bucket: str,
    genuine_reachable: bool,
    config_known: bool = True,
) -> str:
    """Diagnostic for image uploads — mirrors the decision in
    @tloncorp/api uploadFile so an operator can see why a push would route
    where it does. ``config_known=False`` means the configuration scry
    failed: bucket/service facts are indeterminate, and the diagnostic must
    say so rather than render a confident false verdict."""
    is_hosted = hosting_forced or url_hosted
    use_memex = is_hosted and (service == "presigned-url" or not has_s3_creds)
    if use_memex:
        path = (
            "memex (hosted)"
            if genuine_reachable
            else "memex — would FAIL: no %genuine token"
        )
    elif has_s3_creds and current_bucket:
        path = "S3 (custom credentials)"
    elif has_s3_creds and not config_known:
        path = "unknown — storage configuration scry failed"
    elif has_s3_creds:
        # uploadFile does not check the bucket itself — it lets the S3 PUT
        # fail. The CLI pre-flight is deliberately stricter, so the diagnostic
        # names the missing bucket rather than promising a working upload.
        path = "would FAIL: no storage bucket selected"
    else:
        path = "would FAIL: no storage credentials configured"
    rows = [
        ("Node URL", node_url or "unknown"),
        ("URL looks hosted", "yes" if url_hosted else "no"),
        ("TLON_HOSTING", "set" if hosting_forced else "unset"),
        ("Storage service", service or "unknown"),
        ("Custom S3 creds", "yes" if has_s3_creds else "no"),
        ("Current bucket", current_bucket or ("unknown" if not config_known else "none")),
        ("%genuine token", "reachable" if genuine_reachable else "unavailable"),
        ("Upload path", path),
    ]
    return "\n".join(f"*{key}*: **{value}**" for key, value in rows)


_PATP_RE = re.compile(r"^~[a-z][a-z-]*$")


def _is_patp(ship: str) -> bool:
    """True for single-ship ids; excludes club ids like ~0v4..."""
    return bool(_PATP_RE.match(normalize_ship(ship)))


def _message_type_member(name: str) -> Any:
    return getattr(MessageType, str(name or "text").upper(), MessageType.TEXT)


def _processing_outcome_value(outcome: Any) -> Optional[str]:
    """Normalize Hermes' ProcessingOutcome enum (success/failure/cancelled)."""
    value = getattr(outcome, "value", outcome)
    if isinstance(value, str) and value.strip():
        return value.strip().lower()
    return None


# Maps the adapter's dispatch_reason (attention.py / approval flow) onto the
# ContextLensTrigger union the client renders (context-lens.ts).
_LENS_TRIGGER_MAP = {
    "dm": "dm",
    "reaction": "reaction",
    "mention": "mention",
    "owner-listen": "owner-listen",
    # Owner-initiated no-mention engagement, same class as owner-listen; the
    # shared taxonomy has no dedicated trigger for it (OpenClaw maps its
    # 'owner-command' engagement reason onto 'owner-listen' the same way).
    "owner-command": "owner-listen",
    "owner-blob": "owner-blob",
    "participated-thread": "thread",
    "retry": "retry",
    # A free (unprompted) channel response has no dedicated trigger in the
    # shared taxonomy; OpenClaw's channel path likewise falls through to
    # "unknown". Mapped explicitly so it reads as intentional, not an omission.
    "free-response": "unknown",
}


def _lens_trigger(dispatch_reason: str, *, is_dm: bool) -> str:
    # Approvals replay either a DM request or a group post, so resolve by
    # conversation kind rather than assuming DM.
    if dispatch_reason == "approved":
        return "dm" if is_dm else "mention"
    return _LENS_TRIGGER_MAP.get(dispatch_reason, "unknown")


def _lens_run_kind(dispatch_reason: str) -> str:
    if dispatch_reason in ("owner-listen", "owner-command", "owner-blob"):
        return "owner_listen"
    return "conversation"


def _lens_final_status(
    processing_outcome: Optional[str],
    *,
    delivered: bool,
    delivery_failed: bool = False,
) -> str:
    """Map (outcome, delivery) onto the terminal ContextLensStatus."""
    # A send that Hermes produced but the CLI failed to deliver is an error,
    # even if the processing outcome itself was a "success".
    if delivery_failed:
        return "error"
    if delivered:
        return "completed"
    if processing_outcome == "failure":
        return "error"
    if processing_outcome == "cancelled":
        return "aborted"
    return "no_reply"


def _epoch_ms(value: Any) -> Optional[int]:
    ts = getattr(value, "timestamp", None)
    if callable(ts):
        try:
            return int(value.timestamp() * 1000)
        except Exception:
            return None
    return None


def _nudge_reply_context(nudge: PendingNudge, text: str) -> str:
    sent_at = (
        datetime.fromtimestamp(nudge.sent_at / 1000, timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    content = (
        f"Message content:\n\n{nudge.content}\n\n" if nudge.content else ""
    )
    return (
        f"[Context: You recently sent {nudge.owner_ship} a stage-{nudge.stage} "
        f"re-engagement nudge at {sent_at}. {content}"
        "The owner's reply below may be responding to that nudge.]\n\n"
        f"{text}"
    )


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


def _reaction_state_value(emoji: str) -> str:
    """Bound comparison value for a wire react, preserving ordinary emojis."""
    value = str(emoji)
    if len(value) <= 256:
        return value
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def _reaction_wire_metadata(wire_key: str) -> tuple[str, bool]:
    """Recover actor metadata from the stable state key for removal events."""
    if "/" in wire_key:
        return normalize_ship(wire_key.split("/", 1)[0]), True
    return normalize_ship(wire_key), False


class ReactionState:
    """Bounded reaction state that turns snapshots/deltas into transitions."""

    def __init__(self, *, posts_per_conversation: int = 200, conversations: int = 64) -> None:
        self.posts_per_conversation = posts_per_conversation
        self.conversations = conversations
        # Values are exact short reacts / digests. None is a DM removal tombstone.
        self._conversations: OrderedDict[
            str, OrderedDict[str, dict[str, Optional[str]]]
        ] = OrderedDict()

    @staticmethod
    def _conversation_key(chat_type: str, chat_id: str) -> str:
        return f"{chat_type}:{chat_id}"

    def _post_entries(self, chat_type: str, chat_id: str, post_id: str) -> dict[str, Optional[str]]:
        key = self._conversation_key(chat_type, chat_id)
        posts = self._conversations.get(key)
        if posts is None:
            posts = OrderedDict()
            self._conversations[key] = posts
        self._conversations.move_to_end(key)
        entries = posts.get(str(post_id))
        if entries is None:
            entries = {}
            posts[str(post_id)] = entries
        posts.move_to_end(str(post_id))
        while len(posts) > self.posts_per_conversation:
            posts.popitem(last=False)
        while len(self._conversations) > self.conversations:
            self._conversations.popitem(last=False)
        return entries

    def apply_channel_snapshot(self, snapshot: ChannelReactsSnapshot) -> list[TlonReaction]:
        prior = dict(self._post_entries("group", snapshot.chat_id, snapshot.post_id))
        current = {
            key: _reaction_state_value(emoji)
            for key, (emoji, _reactor, _is_bot) in snapshot.entries.items()
        }
        transitions: list[TlonReaction] = []

        # A changed map value is a removal followed by a new add, preserving
        # the state-machine edge instead of treating snapshots as event deltas.
        for wire_key, prior_emoji in prior.items():
            if current.get(wire_key) == prior_emoji:
                continue
            reactor, reactor_is_bot = _reaction_wire_metadata(wire_key)
            transitions.append(
                TlonReaction(
                    chat_type="group",
                    chat_id=snapshot.chat_id,
                    post_id=snapshot.post_id,
                    parent_id=snapshot.parent_id,
                    wire_key=wire_key,
                    reactor=reactor,
                    reactor_is_bot=reactor_is_bot,
                    emoji=prior_emoji or "",
                    added=False,
                    raw=snapshot.raw,
                )
            )
        for wire_key, (emoji, reactor, reactor_is_bot) in snapshot.entries.items():
            if prior.get(wire_key) == current[wire_key]:
                continue
            transitions.append(
                TlonReaction(
                    chat_type="group",
                    chat_id=snapshot.chat_id,
                    post_id=snapshot.post_id,
                    parent_id=snapshot.parent_id,
                    wire_key=wire_key,
                    reactor=reactor,
                    reactor_is_bot=reactor_is_bot,
                    emoji=emoji,
                    added=True,
                    raw=snapshot.raw,
                )
            )

        entries = self._post_entries("group", snapshot.chat_id, snapshot.post_id)
        entries.clear()
        entries.update(current)
        return transitions

    def forget_entry(
        self, chat_type: str, chat_id: str, post_id: str, wire_key: str
    ) -> None:
        """Drop one committed entry so a later snapshot re-emits it as an add.

        Snapshots commit before their transitions are handled, so when an
        added reaction's target classification is unresolved (exact scry
        failure), the entry must be forgotten — otherwise a redelivered or
        later diff treats it as already-seen and a reaction on the bot's own
        post is permanently misfiled as a passive note.
        """
        posts = self._conversations.get(self._conversation_key(chat_type, chat_id))
        if not posts:
            return
        entries = posts.get(str(post_id))
        if entries:
            entries.pop(wire_key, None)

    def apply_dm_delta(self, reaction: TlonReaction) -> list[TlonReaction]:
        entries = self._post_entries("dm", reaction.chat_id, reaction.post_id)
        if reaction.added:
            value = _reaction_state_value(reaction.emoji)
            if reaction.wire_key in entries and entries[reaction.wire_key] == value:
                return []
            entries[reaction.wire_key] = value
            return [reaction]

        # An absent remove is real first-observed history, while a None entry
        # is a tombstone proving this exact delta was already surfaced.
        if reaction.wire_key in entries and entries[reaction.wire_key] is None:
            return []
        entries[reaction.wire_key] = None
        return [reaction]

    def clear(self) -> None:
        self._conversations.clear()


class TlonAdapter(BasePlatformAdapter):
    MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH
    SUPPORTS_MESSAGE_EDITING = False
    _DISPATCH_STATE_CAPACITY = 1000
    # Tell Hermes' DeliveryRouter not to truncate before calling send(); this
    # adapter preserves oversized replies by splitting them into Tlon posts.
    splits_long_messages = True

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
        self._cli = TlonCLI(
            self.tlon_config,
            observer=self._telemetry.observe_cli,
            as_bot=True,
        )
        self._migration = MigrationCommandController(
            run_command=self._run_migration_command,
            send_dm=self._send_migration_dm,
            emit_event=self._telemetry.migration_event,
        )
        self._diary_notification_sender = self._send_migration_dm
        self._connected_at = 0.0
        self._sse: Optional[TlonSSEClient] = None
        self._stream_task: Optional[asyncio.Task] = None
        self._event_queue: Optional[asyncio.Queue[_StreamWorkItem]] = None
        self._event_worker_task: Optional[asyncio.Task] = None
        self._sse_watchdog_task: Optional[asyncio.Task] = None
        self._sse_probe_task: Optional[asyncio.Task] = None
        # Delivered-probe state for the current silence: epoch_at is the
        # probe's START time (frame-order validity — its own ack can be parsed
        # before poke() returns), success_at is when the PUT completed (grace
        # runs from delivery), both set only on send success. Epoch validity
        # is a comparison, not bookkeeping: a probe only counts for
        # condemnation if it started after the last frame heard and was sent
        # on the current client.
        self._sse_probe_epoch_at: Optional[float] = None
        self._sse_probe_success_at: Optional[float] = None
        self._sse_probe_client: Optional[TlonSSEClient] = None
        # Set while the reader is parked on the bounded event queue; the
        # watchdog stands down during backpressure because stream liveness is
        # unknowable there.
        self._route_blocked = False
        self._nudge_snapshot = NudgeSettingsSnapshot()
        self._nudge_owner_activity: Optional[tuple[int, str]] = None
        self._nudge_stage_shadow = 0
        self._pending_nudge: Optional[PendingNudge] = None
        self._pending_nudge_rehydrated = False
        self._nudge_seen_ids: set[str] = set()
        self._nudge_seen_order: list[str] = []
        self._nudge_load_seeded = False
        self._nudge_settings_ready = False
        self._nudge_settings_retry_task: Optional[asyncio.Task] = None
        self._nudge_load_lock = asyncio.Lock()
        self._nudge_load_generation = 0
        self._nudge_activity_persistence = OwnerActivityPersistence(
            poke=self._nudge_poke,
            error=lambda message: logger.warning("%s", message),
        )
        self._pending_nudge_persistence = PendingNudgePersistence(
            poke=self._nudge_poke,
            error=lambda message: logger.warning("%s", message),
        )
        self._nudge_scheduler = TlonNudgeScheduler(
            enabled=self.tlon_config.reengagement_enabled,
            owner_ship=self.tlon_config.owner_ship,
            bot_ship=self.tlon_config.ship_name,
            interval_ms=self.tlon_config.nudge_tick_interval_ms,
            get_snapshot=lambda: self._nudge_snapshot,
            settings_ready=lambda: self._nudge_settings_ready,
            get_activity=lambda: self._nudge_owner_activity,
            set_activity=self._set_nudge_owner_activity,
            get_stage=lambda: self._nudge_stage_shadow,
            set_stage=self._set_nudge_stage,
            get_active_hours_baseline=self._nudge_active_hours_baseline,
            get_pending=lambda: self._pending_nudge,
            set_pending=self._set_pending_nudge,
            send_dm=self._send_nudge_dm,
            activity_persistence=self._nudge_activity_persistence,
            pending_persistence=self._pending_nudge_persistence,
            poke=self._nudge_poke,
            telemetry=self._telemetry,
            error=lambda message: logger.warning("%s", message),
        )
        self._gateway_status = TlonGatewayStatus(
            self.tlon_config,
            on_error=lambda operation, exc: self._telemetry.error(
                "gateway_status", exc, operation=operation
            ),
        )
        self._lens_sync = TlonLensSync(
            self.tlon_config,
            on_error=lambda operation, exc: self._telemetry.error(
                "context_lens", exc, operation=operation
            ),
        )
        self._lens = TlonLensRecorder(self._lens_sync, store=self._open_lens_store())
        # lensId -> monotonic timestamp of an in-flight/recent retry, so a
        # repeated %retry-requested fact for the same run is ignored.
        self._retry_dedup: dict[str, float] = {}
        self._computing_presence = TlonComputingPresenceTracker(
            reporter=TlonComputingPresenceReporter(self.tlon_config),
            on_error=lambda action, exc: self._telemetry.error(
                "presence", exc, operation=action
            ),
        )
        self._seen_ids: set[str] = set()
        self._seen_order: list[str] = []
        self._reaction_state = ReactionState()
        self._message_cache = MessageCache()
        # Channel nest -> owning group flag, rebuilt from `/groups-ui/v7/init`
        # the first time an approval card needs a `groupId` and on every miss.
        self._nest_to_group: dict[str, str] = {}
        self._pending_reaction_notes: OrderedDict[str, deque[str]] = OrderedDict()
        # Maps a top-level own-post reaction's synthetic `react/…` dispatch
        # id to the real reactable post it was about, so send()'s
        # reply_in_thread fallback (which otherwise threads on the trigger
        # id) can thread on the actual wire post instead of the synthetic,
        # nonexistent one. Retained until the bounded cache evicts it or the
        # adapter disconnects, so retries and additional sends stay anchored
        # to the real post.
        self._reaction_reply_targets: OrderedDict[str, str] = OrderedDict()
        self._monitored_channels = set(self.tlon_config.channels)
        self._mention_matcher = self._build_mention_matcher()
        self._bot_nickname: str = ""
        self._bot_avatar: str = ""
        self._harness_version_cache: Any = _UNSET_HARNESS_VERSION
        self._participated_threads: set[str] = set()
        self._known_bot_ships: set[str] = set()
        self._known_bot_consecutive_by_channel: dict[str, int] = {}
        self._pending_bot_cap_addendum: dict[str, tuple[str, str]] = {}
        self._inflight_senders: OrderedDict[tuple[str, str], str] = OrderedDict()
        self._executed_block_directives: OrderedDict[
            tuple[str, str, str], None
        ] = OrderedDict()
        # Lens output IDs derive from --sent-at. Reserve strictly increasing
        # values so quick consecutive sends cannot collide on the same post ID.
        self._last_lens_sent_at = 0
        self._owner_listen = self._owner_listen_env_defaults()
        self._settings_group_channels: set[str] = set()
        self._settings_loaded = False
        self._pending_approvals: list[dict[str, Any]] = []
        self._settings_dm_allowlist: set[str] = set()
        self._settings_group_invite_allowlist: set[str] = (
            self._env_group_invite_allowlist()
        )
        self._channel_rules: dict[str, dict[str, Any]] = {}
        self._processed_dm_invites: set[str] = set()
        self._processed_group_invites: set[str] = set()
        # defaultAuthorizedShips/autoAcceptDmInvites/autoDiscoverChannels: no
        # env equivalent for the ships default (store-only), env-seeded
        # default for auto-discover, and no env knob for auto-accept.
        self._settings_default_authorized_ships: set[str] = set()
        self._auto_accept_dm_invites: bool = False
        self._auto_discover: bool = self.tlon_config.auto_discover

    def _open_lens_store(self) -> Optional[LensRunStore]:
        """Durable lens-run store backing owner retries across restarts.

        Failure-tolerant like the gateway's initContextLensStore: a broken
        disk store degrades retry to the in-memory recent cache, it never
        blocks adapter startup.
        """
        if not self._lens_sync.enabled:
            return None
        path = self.tlon_config.context_lens_store_path or default_lens_store_path()
        try:
            return LensRunStore(path)
        except Exception as exc:
            logger.warning(
                "[tlon] lens store unavailable, continuing without durable history: %s",
                exc,
            )
            return None

    async def connect(self, *, is_reconnect: bool = False) -> bool:
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
                    harness_version=self._harness_version(),
                    markdown=False,
                ).replace("\n", " | "),
            )
            self._telemetry.set_common(
                {"adapterVersion": adapter_version, "adapterFingerprint": fingerprint}
            )
            set_active_telemetry(self._telemetry)
            self_contact = await self._load_bot_profile()
            # Publish the bot's identity claim now that the SSE client is live
            # and the current self-contact is in hand (enables
            # compare-before-poke idempotence).
            await self._publish_bot_info(self_contact)
            settings_loaded = await self._load_settings_state()
            self._nudge_settings_ready = settings_loaded
            if not settings_loaded:
                self._start_nudge_settings_retry()
            await self._process_pending_dm_invites()
            await self._process_pending_group_invites()
            await self._start_gateway_status()
            await self._start_lens()
            self._start_event_worker()
            self._nudge_scheduler.start()
            self._stream_task = asyncio.create_task(self._run_stream())
            self._computing_presence.bind_loop(asyncio.get_running_loop())
            set_active_computing_presence_tracker(self._computing_presence)
            set_diary_migration_notification_sender(
                self._diary_notification_sender,
                bot_ship=self.tlon_config.ship_name,
                owner_ship=self.tlon_config.owner_ship,
                title_lookup=self._lookup_diary_channel_title,
            )
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
        except TlonAuthError as exc:
            # Bad access code: fatal, not a transient connect failure — stops
            # the gateway from restart-looping against rejected credentials.
            logger.error("[tlon] connect failed, credentials rejected: %s", exc)
            self._telemetry.error("connect", exc, operation="authenticate")
            await self._close_sse(graceful=False)
            self._set_fatal_error("auth", str(exc), retryable=False)
            return False
        except Exception as exc:
            # A fixed cookie the ship rejects surfaces here at startup —
            # open()/subscribe() raise TlonTerminalActionError (401/403), which
            # is a ConnectionError subclass, not TlonAuthError, so it lands in
            # this generic handler rather than the fatal branch above. Without
            # this check the gateway would restart-loop against a dead cookie.
            fatal_auth = self._is_fatal_auth_rejection(exc)
            if fatal_auth:
                logger.error("[tlon] connect failed, credentials rejected: %s", exc)
                self._telemetry.error("connect", exc, operation="channel")
            else:
                logger.error("[tlon] connect failed: %s", exc, exc_info=True)
                self._telemetry.error("connect", exc)
            await self._stop_nudge_collaborators()
            await self._stop_event_worker()
            await self._close_sse(graceful=False)
            self._reset_nudge_state()
            if fatal_auth:
                self._set_fatal_error("auth", str(exc), retryable=False)
            return False

    async def disconnect(self) -> None:
        self._mark_disconnected()
        self._nudge_settings_ready = False
        self._nudge_load_generation += 1
        await self._stop_nudge_settings_retry()
        await self._nudge_scheduler.stop()
        if self._connected_at:
            self._telemetry.gateway_disconnected(
                uptime_seconds=int(time.monotonic() - self._connected_at),
                reason="shutdown",
            )
            self._connected_at = 0.0
        clear_active_telemetry(self._telemetry)
        clear_active_computing_presence_tracker(self._computing_presence)
        clear_active_recorder(self._lens)
        clear_diary_migration_notification_sender(
            self._diary_notification_sender
        )
        if self._stream_task is not None:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
            self._stream_task = None
        await self._stop_event_worker()
        await self._nudge_activity_persistence.flush(final=True)
        await self._pending_nudge_persistence.flush(final=True)
        await self._computing_presence.close()
        await self._stop_gateway_status("shutdown")
        await self._stop_lens()
        await self._close_sse()
        self._reset_nudge_state()
        self._seen_ids.clear()
        self._seen_order.clear()
        self._participated_threads.clear()
        self._known_bot_ships.clear()
        self._known_bot_consecutive_by_channel.clear()
        self._pending_bot_cap_addendum.clear()
        for message_key in list(self._inflight_senders):
            self._remove_dispatch_state(message_key)
        for directive_key in list(self._executed_block_directives):
            self._remove_dispatch_state(directive_key[:2])
        self._inflight_senders.clear()
        self._executed_block_directives.clear()
        self._reaction_state.clear()
        self._message_cache.clear()
        self._nest_to_group.clear()
        self._pending_reaction_notes.clear()
        self._reaction_reply_targets.clear()
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

    def _env_group_invite_allowlist(self) -> set[str]:
        return set(self.tlon_config.group_invite_allowlist)

    def _resolve_group_invite_allowlist(self, value: Any) -> set[str]:
        """Resolve a %settings groupInviteAllowlist value to the live set.

        A list — including an empty one — is an owner-authored override, parsed
        strictly so malformed entries cannot broaden authorization. Anything
        else (key absent, deleted, or malformed) is not an override and reverts
        to the env default, matching openclaw's
        ``settings.groupInviteAllowlist ?? account.groupInviteAllowlist``.
        """
        if not isinstance(value, list):
            return self._env_group_invite_allowlist()
        return parse_ship_list(value)

    def _is_owner(self, ship: str) -> bool:
        owner = self.tlon_config.owner_ship
        return bool(owner) and normalize_ship(ship) == owner

    def _nudge_active_hours_baseline(self) -> ActiveHoursBaseline:
        return ActiveHoursBaseline(
            start=self.tlon_config.nudge_active_hours_start,
            end=self.tlon_config.nudge_active_hours_end,
            timezone=self.tlon_config.nudge_active_hours_timezone,
            user_timezone=self.tlon_config.user_timezone,
        )

    def _set_nudge_owner_activity(
        self, activity: Optional[tuple[int, str]]
    ) -> None:
        self._nudge_owner_activity = activity

    def _set_nudge_stage(self, stage: int) -> None:
        self._nudge_stage_shadow = stage if stage in (1, 2, 3) else 0

    def _set_pending_nudge(self, nudge: Optional[PendingNudge]) -> None:
        self._pending_nudge = nudge
        self._pending_nudge_rehydrated = True

    async def _current_sse_poke(self, app: str, mark: str, payload: Any) -> Any:
        if self._sse is None:
            raise ConnectionError("Tlon SSE is unavailable")
        return await self._sse.poke(app, mark, payload)

    async def _nudge_poke(
        self,
        app: str,
        mark: str,
        payload: Any,
    ) -> Any:
        try:
            return await self._current_sse_poke(app, mark, payload)
        except TlonTerminalActionError:
            raise
        except (ConnectionError, OSError) as exc:
            raise ConnectionError(str(exc)) from exc
        except Exception as exc:
            if self._sse is None or type(exc).__module__.startswith("aiohttp"):
                raise ConnectionError(str(exc)) from exc
            raise

    async def _send_nudge_dm(self, text: str, sent_at_ms: int) -> Any:
        with cli_context("owner_notification"):
            return await self._cli.send_message(
                self.tlon_config.owner_ship, text, sent_at=sent_at_ms
            )

    def _reset_nudge_state(self) -> None:
        self._nudge_snapshot = NudgeSettingsSnapshot()
        self._nudge_owner_activity = None
        self._nudge_stage_shadow = 0
        self._pending_nudge = None
        self._pending_nudge_rehydrated = False
        self._nudge_seen_ids.clear()
        self._nudge_seen_order.clear()
        self._nudge_load_seeded = False
        self._nudge_settings_ready = False

    async def _load_settings_state(self) -> bool:
        """Load adapter state from the ship's %settings store.

        The settings store is the durable source of truth (owner-listen
        toggles, channel rules, approved DM senders, pending approvals) so
        state survives gateway reboots and carries over from OpenClaw
        deployments. Env config only provides per-key defaults when the store
        has no entry.
        """
        if self._sse is None:
            return False
        defaults = self._owner_listen_env_defaults()
        async with self._nudge_load_lock:
            generation = self._nudge_load_generation
            sse = self._sse
            if sse is None:
                return False
            try:
                payload = await sse.scry("/settings/all")
            except Exception as exc:
                # Keep the current snapshot (env defaults at boot, plus any toggles
                # applied since) rather than resetting it.
                logger.warning("[tlon] settings load failed; keeping current state: %s", exc)
                self._telemetry.error("settings", exc, operation="load")
                return False
            if generation != self._nudge_load_generation or sse is not self._sse:
                return False
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
            self._settings_group_invite_allowlist = (
                self._resolve_group_invite_allowlist(
                    bucket.get(SETTINGS_KEY_GROUP_INVITE_ALLOWLIST)
                )
            )
            self._channel_rules = parse_channel_rules(bucket.get(SETTINGS_KEY_CHANNEL_RULES))
            self._settings_default_authorized_ships = parse_ship_list(
                bucket.get(SETTINGS_KEY_DEFAULT_AUTHORIZED_SHIPS)
            )
            self._auto_accept_dm_invites = settings_bool(
                bucket.get(SETTINGS_KEY_AUTO_ACCEPT_DM_INVITES), False
            )
            self._auto_discover = settings_bool(
                bucket.get(SETTINGS_KEY_AUTO_DISCOVER_CHANNELS),
                self.tlon_config.auto_discover,
            )
            self._apply_nudge_settings_bucket(bucket)
            self._settings_loaded = True
        logger.info(
            "[tlon] settings loaded: owner-listen=%s muted=%s enabled-channels=%s "
            "pending-approvals=%d approved-dms=%d channel-rules=%d "
            "default-authorized-ships=%d auto-accept-dm-invites=%s auto-discover=%s",
            self._owner_listen.enabled,
            sorted(self._owner_listen.disabled_channels),
            sorted(self._owner_listen.enabled_channels),
            len(self._pending_approvals),
            len(self._settings_dm_allowlist),
            len(self._channel_rules),
            len(self._settings_default_authorized_ships),
            self._auto_accept_dm_invites,
            self._auto_discover,
        )
        return True

    async def _load_nudge_settings_only(self) -> bool:
        if self._sse is None:
            return False
        async with self._nudge_load_lock:
            generation = self._nudge_load_generation
            sse = self._sse
            if sse is None:
                return False
            try:
                payload = await sse.scry("/settings/all")
            except Exception as exc:
                logger.warning("[tlon] nudge settings reload failed: %s", exc)
                self._telemetry.error("settings", exc, operation="nudge_reload")
                return False
            if generation != self._nudge_load_generation or sse is not self._sse:
                return False
            self._apply_nudge_settings_bucket(parse_settings_bucket(payload))
        return True

    def _apply_nudge_settings_bucket(
        self,
        bucket: Mapping[str, Any],
    ) -> None:
        """Atomically load settings while keeping scheduler shadows monotonic.

        Scries can race our local settings pokes, so a seeded load only adopts
        a newer owner activity or a higher nudge stage. A snapshot with newer
        activity also adopts its stage wholesale; live subscription events
        remain authoritative in both directions and are handled separately
        below.
        """
        incoming = NudgeSettingsSnapshot.from_bucket(bucket)
        incoming_activity = owner_activity_from_snapshot(incoming)
        incoming_stage = parse_last_nudge_stage(incoming.last_nudge_stage) or 0

        # The settings snapshot is last-writer-wins for active-hours and is
        # still the raw source for pendingNudge hydration.  The two shadows the
        # scheduler reads are reconciled independently below.
        self._nudge_snapshot = incoming
        if not self._nudge_load_seeded:
            self._nudge_owner_activity = incoming_activity
            self._set_nudge_stage(incoming_stage)
            self._nudge_load_seeded = True
        else:
            current_activity = self._nudge_owner_activity
            incoming_activity_is_newer = incoming_activity is not None and (
                current_activity is None or incoming_activity[0] > current_activity[0]
            )
            if incoming_activity_is_newer:
                self._set_nudge_owner_activity(incoming_activity)
                # Both harnesses persist activity put-entries before the stage
                # del-entry, so strictly newer activity marks a newer owner
                # cycle: adopt its stage even when it clears or lowers. A
                # stale scry can only carry activity <= our shadow and stays
                # on the raise-only path. Caveat: if we already observed the
                # activity put live and then missed the ordered stage
                # deletion (disconnect mid-batch), the equal-activity load
                # retains the old stage until still-newer owner activity.
                self._set_nudge_stage(incoming_stage)
            elif incoming_stage > self._nudge_stage_shadow:
                self._set_nudge_stage(incoming_stage)

        if not self._pending_nudge_rehydrated:
            pending = parse_pending_nudge(self._nudge_snapshot.pending_nudge_raw)
            self._set_pending_nudge(pending)
            if pending is not None and not is_nudge_eligible(
                pending, int(time.time() * 1000)
            ):
                self._set_pending_nudge(None)
                self._pending_nudge_persistence.enqueue(None)

    def _start_nudge_settings_retry(self) -> None:
        if self._nudge_settings_retry_task is None or self._nudge_settings_retry_task.done():
            self._nudge_settings_retry_task = asyncio.create_task(
                self._retry_nudge_settings_load()
            )

    async def _retry_nudge_settings_load(self) -> None:
        delay = 1.0
        while self._sse is not None and not self._nudge_settings_ready:
            await asyncio.sleep(delay)
            if await self._load_nudge_settings_only():
                self._nudge_settings_ready = True
                return
            delay = min(delay * 2, 30.0)

    async def _stop_nudge_settings_retry(self) -> None:
        if self._nudge_settings_retry_task is not None:
            self._nudge_settings_retry_task.cancel()
            try:
                await self._nudge_settings_retry_task
            except asyncio.CancelledError:
                pass
            self._nudge_settings_retry_task = None

    async def _stop_nudge_collaborators(self) -> None:
        self._nudge_settings_ready = False
        await self._stop_nudge_settings_retry()
        await self._nudge_scheduler.stop()
        await self._nudge_activity_persistence.flush(final=True)
        await self._pending_nudge_persistence.flush(final=True)

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

    async def _handle_settings_event(
        self, raw: Any, *, nudge_handled: bool = False
    ) -> None:
        """Hot-reload owner-listen state from live %settings updates.

        Covers writes from outside this process (Landscape, an OpenClaw
        instance sharing the store). Our own pokes echo back here too, which
        is a no-op since the state already matches.
        """
        event = parse_settings_event(raw)
        if event is None:
            return
        if not nudge_handled:
            self._apply_nudge_settings_event(event)
        if event.key == SETTINGS_KEY_DEFAULT_AUTHORIZED_SHIPS:
            self._settings_default_authorized_ships = parse_ship_list(event.value)
            return
        if event.key == SETTINGS_KEY_AUTO_ACCEPT_DM_INVITES:
            was_on = self._auto_accept_dm_invites
            self._auto_accept_dm_invites = settings_bool(event.value, False)
            if self._auto_accept_dm_invites and not was_on:
                # Left-pending allowlisted invites become eligible now; accept
                # them promptly instead of waiting for the next reconnect.
                await self._process_pending_dm_invites()
            return
        if event.key == SETTINGS_KEY_AUTO_DISCOVER_CHANNELS:
            self._auto_discover = settings_bool(
                event.value, self.tlon_config.auto_discover
            )
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
            self._settings_group_invite_allowlist = (
                self._resolve_group_invite_allowlist(event.value)
            )
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

    def _apply_nudge_settings_event(self, event: Any) -> bool:
        key = getattr(event, "key", "")
        if key not in _NUDGE_SNAPSHOT_FIELDS:
            return False
        value = getattr(event, "value", None)
        if (
            key == SETTINGS_KEY_LAST_OWNER_MESSAGE_AT
            and value is not None
            and _valid_epoch_ms(value) is None
        ):
            # Ignore a malformed activity instant entirely.  It is a handled
            # settings event, so the ordered worker does not retry it after
            # the fast tap and accidentally apply a poisoned snapshot.
            return True
        # Subscription events are trusted and fully authoritative, including
        # deletes and external backdates. Only the scry/load path is
        # monotonic, because a scry can be stale relative to local writes.
        # Invalidate an already-started load before applying every snapshot
        # field: the load replaces the entire snapshot, not only the scheduler
        # shadows, so it could otherwise restore stale active hours or pending
        # nudge data.
        candidate = replace(self._nudge_snapshot)
        candidate.apply(key, value)
        activity: Optional[tuple[int, str]] = None
        stage: Optional[int] = None
        pending: Optional[PendingNudge] = None
        clear_expired_pending = False
        if key in (
            SETTINGS_KEY_LAST_OWNER_MESSAGE_AT,
            SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE,
        ):
            activity = owner_activity_from_snapshot(candidate)
        elif key == SETTINGS_KEY_LAST_NUDGE_STAGE:
            stage = parse_last_nudge_stage(candidate.last_nudge_stage) or 0
        elif key == SETTINGS_KEY_PENDING_NUDGE and not self._pending_nudge_rehydrated:
            pending = parse_pending_nudge(candidate.pending_nudge_raw)
            if pending is not None:
                clear_expired_pending = not is_nudge_eligible(
                    pending, int(time.time() * 1000)
                )

        # Do all candidate derivation before publishing any part of the live
        # state. If a future parser or derivation raises above, the fast-tap
        # fallback can safely leave this prior state in place for the worker.
        self._nudge_snapshot = candidate
        self._nudge_load_seeded = True
        self._nudge_load_generation += 1
        if key in (
            SETTINGS_KEY_LAST_OWNER_MESSAGE_AT,
            SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE,
        ):
            self._set_nudge_owner_activity(activity)
        elif key == SETTINGS_KEY_LAST_NUDGE_STAGE:
            self._set_nudge_stage(stage or 0)
        elif pending is not None:
            self._set_pending_nudge(pending)
            if clear_expired_pending:
                self._set_pending_nudge(None)
                self._pending_nudge_persistence.enqueue(None)
        return True

    def _user_authorized(self, ship: str, *, is_dm: bool, nest: str = "") -> bool:
        """Env/owner authorization plus settings-store grants.

        DMs: the approved-senders set (``dmAllowlist``). Channels: an *open*
        channel admits any ship, and per-channel ``allowedShips`` (falling
        back to ``defaultAuthorizedShips`` when the rule doesn't pin its own
        list) admit approved mentioners.
        """
        if self.tlon_config.user_allowed(ship, is_dm=is_dm):
            return True
        normalized = normalize_ship(ship)
        if is_dm:
            return normalized in self._settings_dm_allowlist
        if nest:
            if is_channel_open(self._channel_rules, nest):
                return True
            allowed = effective_allowed_ships(
                self._channel_rules, nest, self._settings_default_authorized_ships
            )
            if normalized in allowed:
                return True
        return False

    @staticmethod
    def _original_message_payload(message: TlonIncomingMessage) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "messageId": message.message_id,
            "messageText": message.text,
            "timestamp": int(message.sent_at.timestamp() * 1000),
        }
        if message.content is not None:
            payload["messageContent"] = message.content
        if message.blob:
            payload["blob"] = message.blob
        if message.author_is_bot:
            payload["authorIsBot"] = True
        if message.reply_to_message_id:
            payload["parentId"] = message.reply_to_message_id
            payload["isThreadReply"] = True
        return payload

    @staticmethod
    def _build_retry_seed(message: TlonIncomingMessage, clean_text: str) -> dict[str, Any]:
        """ContextLensRetrySeed (camelCase) from the pre-enrichment message.

        Stored on the lens so an owner-requested retry can rebuild the run.
        ``clean_text`` is the inbound text BEFORE media/context enrichment, so a
        retry re-runs _prepare_dispatch_payload / _with_group_context cleanly.
        """
        seed: dict[str, Any] = {
            "messageText": strip_block_directives(clean_text)
        }
        if message.blob:
            seed["blobField"] = message.blob
        if message.content is not None:
            seed["messageContent"] = message.content
        if message.reply_to_message_id:
            seed["parentId"] = message.reply_to_message_id
            seed["isThreadReply"] = True
        seed["cachesHistory"] = True
        return seed

    @staticmethod
    def _message_preview_text(message: TlonIncomingMessage, text: str) -> str:
        preview = render_content_with_blob(text, message.blob, compact=False).strip()
        preview = strip_block_directives(preview).strip()
        return preview or "[attachment]"

    async def _parent_author_for(
        self, message: TlonIncomingMessage, *, allow_scry: bool
    ) -> Optional[str]:
        """Author of the thread parent an approval request replied to.

        Without it a View-message button on a thread reply silently no-ops
        whenever the owner's client has not already synced the parent post.
        Cache first (the ``"unknown"`` sentinel is not an author); the exact
        post scry is the channel-side fallback only — DM parents are in the
        bot's own recent cache.
        """
        parent_id = message.reply_to_message_id
        if not parent_id:
            return None
        cached = self._message_cache.lookup(message.chat_id, parent_id)
        if cached is not None and cached.author and cached.author != "unknown":
            return normalize_ship(cached.author) or None
        if not allow_scry or self._sse is None:
            return None
        author = await fetch_post_author(self._sse.scry, message.chat_id, parent_id)
        return normalize_ship(author or "") or None

    def _recipient_sees_bot_dms(self) -> bool:
        """Whether the notified owner can open the bot's own DM conversations.

        Only when the owner *is* the bot ship: on a hosted deployment the
        owner is a separate ship whose client has no copy of the bot's DM
        channel, so a DM source link would dead-end. Sender-side heuristic,
        matching OpenClaw — no permission scry.
        """
        return normalize_ship(self.tlon_config.owner_ship) == normalize_ship(
            self.tlon_config.ship_name
        )

    async def _queue_dm_approval(
        self, message: TlonIncomingMessage, clean_text: str
    ) -> None:
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if not clean_text.strip() and not message.blob:
            logger.info(
                "[tlon] ignoring empty request after sanitization from unauthorized ship"
            )
            return
        original = self._original_message_payload(message)
        original["messageText"] = clean_text
        parent_author = await self._parent_author_for(message, allow_scry=False)
        if parent_author:
            original["parentAuthorId"] = parent_author
        await self._queue_approval(
            approval_kind="dm",
            requesting_ship=message.user_id,
            message_preview=self._message_preview_text(message, clean_text),
            original_message=original,
        )

    async def _queue_channel_approval(
        self, message: TlonIncomingMessage, clean_text: str
    ) -> None:
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if not clean_text.strip() and not message.blob:
            logger.info(
                "[tlon] ignoring empty request after sanitization from unauthorized ship"
            )
            return
        original = self._original_message_payload(message)
        original["messageText"] = clean_text
        parent_author = await self._parent_author_for(message, allow_scry=True)
        if parent_author:
            original["parentAuthorId"] = parent_author
        if normalize_ship(message.user_id) in self._known_bot_ships:
            # The triggering message may carry a plain-string author even
            # though the ship was already learned as a bot, and the learned
            # set is lost on restart — persist the status so a post-restart
            # replay still counts against the loop cap.
            original["authorIsBot"] = True
        await self._queue_approval(
            approval_kind="channel",
            requesting_ship=message.user_id,
            channel_nest=message.chat_id,
            message_preview=self._message_preview_text(message, clean_text),
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
        # Groups dedup on the flag alone, so the no-op exits can be taken from a
        # direct lookup — no candidate needed. DM/channel dedup needs the built
        # candidate and so stays behind the scry.
        existing = (
            find_duplicate(
                self._pending_approvals,
                {"type": "group", "groupFlag": group_flag},
            )
            if approval_kind == "group"
            else None
        )
        if existing is not None:
            # Delivered => never re-DM while the record lives; undelivered
            # (including legacy lastNotifiedAt-only records) re-notifies
            # under the cooldown until a send lands. Persisted JSON can
            # carry a junk marker, so only a real stamp suppresses.
            delivered = existing.get("notificationDeliveredAt")
            if (
                isinstance(delivered, (int, float))
                and not isinstance(delivered, bool)
                and math.isfinite(delivered)
            ):
                return
            try:
                last_notified = float(existing.get("lastNotifiedAt"))
            except (TypeError, ValueError):
                last_notified = 0.0
            if not math.isfinite(last_notified):
                # An inf stamp reads as "attempted in the future" and would
                # suppress every retry for the record's whole life.
                last_notified = 0.0
            if now_ms - last_notified < RENOTIFY_COOLDOWN_MS:
                return
        # Every path past here sends the owner a DM or creates a record, so the
        # blocked-list scry runs only when an action is imminent — a no-op
        # re-observation of a suppressed group approval must not cost a 30s-
        # worst-case scry per observation.
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
        if approval_kind != "group":
            existing = find_duplicate(self._pending_approvals, candidate)
        if existing is not None:
            if approval_kind == "group":
                updated = dict(existing)
                updated["lastNotifiedAt"] = int(now_ms)
                if await self._notify_owner_approval(updated):
                    updated["notificationDeliveredAt"] = int(now_ms)
                    self._telemetry.approval_event("renotified", approval_kind)
                self._pending_approvals = [
                    updated if approval_id(item) == approval_id(existing) else item
                    for item in self._pending_approvals
                ]
                await self._persist_pending_approvals()
                return
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
                if await self._notify_owner_approval(updated):
                    updated["notificationDeliveredAt"] = int(now_ms)
                self._telemetry.approval_event("renotified", approval_kind)
            self._pending_approvals = [
                updated if approval_id(item) == approval_id(existing) else item
                for item in self._pending_approvals
            ]
            await self._persist_pending_approvals()
            return
        candidate["lastNotifiedAt"] = int(now_ms)
        self._pending_approvals.append(candidate)
        if await self._notify_owner_approval(candidate):
            candidate["notificationDeliveredAt"] = int(now_ms)
        await self._persist_pending_approvals()
        self._telemetry.approval_event("queued", approval_kind)
        logger.info(
            "[tlon] queued approval %s (%s from %s)",
            approval_id(candidate),
            approval_kind,
            normalize_ship(requesting_ship),
        )

    async def _notify_owner_approval(self, approval: dict[str, Any]) -> bool:
        """Send the owner DM for a pending approval; True when delivered."""
        owner = self.tlon_config.owner_ship
        if not owner:
            return False
        text = format_approval_request(approval)[:MAX_MESSAGE_LENGTH]
        # The text notification is self-sufficient, so a card that cannot be
        # built or does not validate costs the owner the buttons, never the
        # request itself.
        blob: Optional[str] = None
        card_error: Any = None
        try:
            card = build_approval_card(
                approval,
                recipient_sees_bot_dms=self._recipient_sees_bot_dms(),
                channel_groups=await self._channel_groups_for([approval]),
            )
            if validate_a2ui_card(card):
                blob = serialize_blob(card)
            else:
                card_error = "approval card failed validation"
        except Exception as exc:
            card_error = exc
        if card_error is not None:
            logger.warning(
                "[tlon] approval card unavailable for %s: %s",
                approval_id(approval),
                card_error,
            )
            self._telemetry.error(
                "approval", card_error, requestType=approval_type(approval)
            )
        args: list[str] = ["posts", "send", owner, text]
        if blob:
            args.extend(["--blob", blob])
        with cli_context("owner_notification"):
            result = await self._cli.run_command(args)
        if not result.success:
            logger.warning(
                "[tlon] approval notification to %s failed: %s", owner, result.error
            )
            self._telemetry.error(
                "approval",
                result.error or "notification send failed",
                requestType=approval_type(approval),
            )
            return False
        return True

    async def _notify_owner(
        self, target: str, reason: str, *, block_succeeded: bool = True
    ) -> None:
        owner = self.tlon_config.owner_ship
        if not owner:
            return
        if block_succeeded:
            action = f"Blocked {target}"
        else:
            action = f"Tried to block {target} but the block failed."
        reason = str(reason or "")
        if len(reason) > _OWNER_BLOCK_REASON_MAX_CHARS:
            reason = reason[: _OWNER_BLOCK_REASON_MAX_CHARS - 1].rstrip() + "…"
        text = f"[Agent Action] {action}\nReason: {reason}"[:MAX_MESSAGE_LENGTH]
        with cli_context("owner_notification"):
            result = await self._cli.run_command(("posts", "send", owner, text))
        if not result.success:
            logger.warning("[tlon] block notification to owner failed")
            self._telemetry.error(
                "moderation",
                result.error or "notification send failed",
                operation="owner_notification",
            )

    async def _run_migration_command(
        self,
        args: Sequence[str],
        timeout: float,
        on_deadline: TlonDeadlineCallback,
    ):
        with cli_context("migration"):
            return await self._cli.run_command(
                args, timeout=timeout, on_deadline=on_deadline
            )

    async def _send_migration_dm(
        self, text: str, blob: Optional[str]
    ) -> bool:
        owner = self.tlon_config.owner_ship
        if not owner:
            return False
        args: list[str] = ["posts", "send", owner, text]
        if blob:
            args.extend(["--blob", blob])
        with cli_context("migration"):
            result = await self._cli.run_command(args)
        if not result.success:
            logger.warning(
                "[tlon] migration notification to %s failed: %s",
                owner,
                result.error,
            )
        return result.success

    async def _persist_pending_approvals(self) -> None:
        # JSON string, not a raw list of dicts: %settings values cannot hold
        # objects (the poke would be nacked). Matches OpenClaw's encoding.
        await self._persist_settings_entry(
            SETTINGS_KEY_PENDING_APPROVALS, json.dumps(self._pending_approvals)
        )

    async def _drop_pending_approvals_for(
        self, ship: str, *, types: tuple[str, ...] | None = None
    ) -> int:
        remaining = [
            item
            for item in self._pending_approvals
            if approval_ship(item) != ship
            or (types is not None and approval_type(item) not in types)
        ]
        removed = len(self._pending_approvals) - len(remaining)
        if removed:
            self._pending_approvals = remaining
            await self._persist_pending_approvals()
        return removed

    async def _drop_pending_group_approval(self, flag: str) -> int:
        remaining = [
            item
            for item in self._pending_approvals
            if approval_type(item) != "group" or approval_group_flag(item) != flag
        ]
        removed = len(self._pending_approvals) - len(remaining)
        if removed:
            self._pending_approvals = remaining
            await self._persist_pending_approvals()
        return removed

    async def _persist_channel_rules(self) -> bool:
        return await self._persist_settings_entry(
            SETTINGS_KEY_CHANNEL_RULES, json.dumps(self._channel_rules)
        )

    async def _is_ship_blocked(self, ship: str) -> bool:
        blocked = await self._blocked_ships_list()
        return normalize_ship(ship) in blocked

    async def _blocked_ships_list(self) -> set[str]:
        blocked = await self._scry_blocked_ships()
        return blocked if blocked is not None else set()

    async def _scry_blocked_ships(self) -> Optional[set[str]]:
        """Blocked ships, or None when the list could not be read.

        SECURITY: auto-accept gates must treat None as unknown and never
        accept on it; fail-open conveniences use _blocked_ships_list.
        """
        if self._sse is None:
            return None
        try:
            blocked = await self._sse.scry("/chat/blocked")
        except Exception as exc:
            logger.debug("[tlon] blocked-ships scry failed: %s", exc)
            return None
        if not isinstance(blocked, list):
            return None
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
        if pruned:
            await self._persist_pending_approvals()

        blob_fields: tuple[str | None, ...] = ()
        if action == "pending":
            is_dm_reply = _is_dm_chat_id(reply_chat_id)
            # Group flags only decorate the card, so don't scry for them when
            # no card will be built (non-DM reply, or outside the 1..4 item
            # card budget — the list is already pruned above).
            wants_card = (
                is_dm_reply
                and 0 < len(self._pending_approvals) <= MAX_PENDING_APPROVALS_A2UI
            )
            reply, pending_blob = build_pending_approvals_response(
                self._pending_approvals,
                is_dm=is_dm_reply,
                recipient_sees_bot_dms=self._recipient_sees_bot_dms(),
                channel_groups=(
                    await self._channel_groups_for(self._pending_approvals)
                    if wants_card
                    else {}
                ),
            )
            if pending_blob is not None:
                blob_fields = (pending_blob,)
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

        await self._send_control_reply(
            reply_chat_id, reply_parent_id, reply, blob_fields=blob_fields
        )

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
            # %chat nacks the block poke for an already-blocked ship, but pokes
            # are fire-and-forget: the nack lands later on the stream and is
            # only logged, so _block_ship still reports success. This pre-check
            # only saves the redundant re-poke — a /ban retried after a failed
            # decline reaches the decline with or without it, including while
            # the (fail-open) blocked-list scry is down.
            blocked = normalize_ship(ship) in await self._blocked_ships_list()
            if not blocked:
                blocked = await self._block_ship(ship)
            if not blocked and approval_type(approval) == "group":
                # The record is the invite's suppression, so dropping it after a
                # failed block re-queues and re-DMs on the next observation.
                return (
                    f"Could not block {ship}: block failed. "
                    "Request stays pending."
                )
            # Ahead of the decline: a block-OK/decline-failed partial ban keeps
            # the record for a retry, and until that retry lands the DM grant
            # would be a live authorization the owner believes is gone.
            await self._remove_from_dm_allowlist(ship)
            if approval_type(approval) == "group":
                # A ban must also decline the invite: the inviter may have been
                # allowlisted since the request queued, and auto-accept does not
                # consult the block list — the still-pending invite would be
                # accepted on the next observation.
                flag = approval_group_flag(approval)
                if flag and not await self._reject_group_invite(flag):
                    return (
                        f"Blocked {ship}, but could not decline the invite. "
                        "Request stays pending."
                    )
        elif action == "reject" and approval_type(approval) == "group":
            # Reject must decline on the ship, or the next observation of the
            # still-pending invite would re-queue it.
            flag = approval_group_flag(approval)
            if flag and not await self._reject_group_invite(flag):
                return (
                    f"Could not decline {flag}: invite decline failed. "
                    "Request stays pending."
                )

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
        blob = str(original.get("blob") or "").strip() or None
        if not text.strip() and not blob:
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
            raw={"approvalReplay": approval_id(approval), "originalMessage": original},
            content=original.get("messageContent"),
            blob=blob,
            author_is_bot=bool(original.get("authorIsBot")),
            # Approval replays are always non-owner messages, so the command
            # override can never fire for them; set the field anyway so the
            # reconstruction stays faithful to a fresh parse.
            inline_text=extract_inline_message_text(original.get("messageContent")),
        )
        retry_seed = self._build_retry_seed(message, text)
        if is_dm:
            dispatch_text, prepared_media = await self._prepare_dispatch_payload(
                message, text
            )
            await self._dispatch_message(
                replace(message, text=dispatch_text),
                is_dm=True,
                dispatch_reason="approved",
                prepared_media=prepared_media,
                retry_seed=retry_seed,
            )
            return
        if message.author_is_bot:
            self._learn_known_bot_ship(message.user_id)
        if not self._mark_seen(message):
            return
        if not self._passes_group_loop_safety(message):
            return
        dispatch_text, prepared_media = await self._prepare_dispatch_payload(message, text)
        dispatch_text = await self._with_group_context(message, dispatch_text, "approved")
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=False,
            mark_seen=False,
            dispatch_reason="approved",
            prepared_media=prepared_media,
            retry_seed=retry_seed,
        )

    async def _execute_ban_ship(self, ship: str) -> str:
        if not _is_patp(ship):
            return f"{ship} is not a valid ship."
        if not await self._block_ship(ship):
            return f"Could not block {ship}."
        await self._remove_from_dm_allowlist(ship)
        removed = await self._drop_pending_approvals_for(ship)
        suffix = f" Removed {removed} pending request(s)." if removed else ""
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
            harness_version=self._harness_version(),
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
        current_bucket = ""
        has_s3_creds = False
        genuine_reachable = False
        config_known = False
        if self._sse is not None:
            try:
                config = await self._sse.scry("/storage/configuration")
                update = config.get("storage-update") if isinstance(config, dict) else None
                configuration = update.get("configuration") if isinstance(update, dict) else None
                if isinstance(configuration, dict):
                    service = str(configuration.get("service") or "unknown")
                    current_bucket = str(configuration.get("currentBucket") or "")
                    config_known = True
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
            current_bucket=current_bucket,
            genuine_reachable=genuine_reachable,
            config_known=config_known,
        )

    def _inline_command(
        self, message: TlonIncomingMessage
    ) -> Optional[str]:
        """The bare command the owner typed inline, or None.

        The parser renders story blocks ahead of the typed text — "[quoted
        message]", "[image: …]" — and heap parsing prepends the title, any of
        which would hide a command from every downstream verbatim guard
        (which all key on a leading slash). So the command is re-derived from
        the parser's inline-only rendering. Matches core commands AND the
        adapter's own registry commands: when this fires for a registry
        command, the control-command dispatcher (same detection regexes) is
        guaranteed to consume it, so a quoted /pending works like a quoted
        /help. Owner-gated: for anyone else the decorated text is the
        message, unchanged.
        """
        if not self._is_owner(message.user_id):
            return None
        inline = self._typed_inline_text(message)
        if not inline:
            return None
        if is_core_command(inline) or is_adapter_command(inline):
            return inline
        return None

    def _typed_inline_text(self, message: TlonIncomingMessage) -> str:
        """The mention-stripped inline-only rendering: what the sender
        actually typed, with a leading bot mention removed. Empty for
        synthetic events."""
        inline = (message.inline_text or "").strip()
        if inline and self._mention_matcher.mentioned(inline):
            inline = self._mention_matcher.strip_leading(inline)
        return inline

    def _command_dispatch_override(
        self, message: TlonIncomingMessage
    ) -> Optional[str]:
        """The authoritative command fact for a dispatch, or None.

        Slash commands are a chat-channel and DM surface only (mirroring the
        OpenClaw plugin's chat/ constraint): heap and diary channels stay
        conversational, so a heap title or header block whose rendered text
        begins with "/help" must never be classified as a command. Everything
        downstream consumes this fact — it is never re-derived from rendered
        text, which block rendering can forge in either direction.
        """
        if message.chat_type != "dm" and not message.chat_id.startswith("chat/"):
            return None
        return self._inline_command(message)

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
        if ctx_nest and ctx_nest.startswith("heap/") and not reply_parent_id:
            reply_parent_id = message.message_id
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
        if is_migrate_command(command_text):
            if self._mark_seen(message):
                self._telemetry.control_command("migrate")

                async def send_reply(text: str) -> None:
                    await self._send_control_reply(
                        message.chat_id,
                        reply_parent_id,
                        text,
                    )

                await self._migration.handle(
                    command_text,
                    bot_ship=self.tlon_config.ship_name,
                    owner_ship=self.tlon_config.owner_ship,
                    send_reply=send_reply,
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
        *,
        blob_fields: Sequence[str | None] = (),
    ) -> None:
        # Control commands are consumed before normal dispatch, so they never
        # have a lens run. Retain their existing routing rule: channel control
        # replies may thread, while direct-message control replies stay linear.
        text = str(text or "")[:MAX_MESSAGE_LENGTH]
        thread_parent = parent_id if parent_id and not _is_dm_chat_id(chat_id) else None
        with cli_context("control_plane"):
            result, _ = await self._deliver_post(
                chat_id,
                text,
                parent_id=thread_parent,
                blob_fields=blob_fields,
                lens_blob=None,
            )
        if not result.success:
            logger.warning("[tlon] control command reply failed: %s", result.error)

    async def _load_bot_profile(self) -> Optional[dict[str, Any]]:
        """Fetch and apply the self contact; return the raw map so callers
        can compare the published bot-info value before poking.

        Returns None when the read did not produce a contact map — callers
        must treat that as "current value unknown", never as "key absent"."""
        if self._sse is None:
            return None
        try:
            profile = await self._sse.scry("/contacts/v1/self.json")
        except Exception as exc:
            logger.debug("[tlon] could not fetch self profile: %s", exc)
            return None
        if not isinstance(profile, dict):
            return None
        self._apply_self_contact(profile)
        return profile

    async def _publish_bot_info(
        self, self_contact: Optional[Mapping[str, Any]]
    ) -> None:
        """Publish the bot's identity claim in its own contact profile:
        compare the current ``bot-info`` value against the computed claim and
        poke only on difference. Non-fatal — the client falls back to treating
        the bot as unidentified until the next successful publish."""
        if self._sse is None:
            return
        if self_contact is None:
            # The self-contact read failed: the current value is unknown, so
            # there is nothing to compare against. Poking blind here would
            # defeat compare-then-poke exactly when the ship is unhealthy.
            logger.debug("[tlon] skipping bot info publish: self contact unread")
            return
        try:
            desired = build_bot_info_json(
                plugin_version(), self._harness_version()
            )
            if extract_bot_info_value(self_contact) == desired:
                return
            payload = build_bot_info_poke(desired)
            for attempt in range(1, BOT_INFO_PUBLISH_ATTEMPTS + 1):
                try:
                    await self._sse.poke("contacts", BOT_INFO_CONTACT_MARK, payload)
                    logger.info("[tlon] published bot info")
                    return
                except Exception as exc:
                    if attempt >= BOT_INFO_PUBLISH_ATTEMPTS:
                        raise
                    logger.debug(
                        "[tlon] bot info publish attempt %d failed: %s",
                        attempt,
                        exc,
                    )
                    await asyncio.sleep(
                        BOT_INFO_PUBLISH_BACKOFF_SECONDS[
                            min(
                                attempt - 1,
                                len(BOT_INFO_PUBLISH_BACKOFF_SECONDS) - 1,
                            )
                        ]
                    )
        except Exception as exc:
            logger.warning("[tlon] could not publish bot info: %s", exc)

    def _harness_version(self) -> Optional[str]:
        """Resolved once per process: a function-local import reads Python's
        already-cached module, so deferring the read buys no freshness — an
        edit to the host's constants needs a restart either way."""
        if self._harness_version_cache is _UNSET_HARNESS_VERSION:
            self._harness_version_cache = resolve_harness_version()
        return self._harness_version_cache

    async def _clear_bot_info(self) -> None:
        """Clear the published claim (rollback/retirement procedure): contact
        keys die only by explicit null."""
        if self._sse is None:
            return
        await self._sse.poke("contacts", BOT_INFO_CONTACT_MARK, build_bot_info_poke(None))

    def _apply_self_contact(self, contact: Any) -> None:
        """Reconcile bot nickname/avatar state from a self contact map.

        Shared by the boot/reconnect scry and live `contacts /v1/news` %self
        facts. Both carry the full contact map, so an absent nickname means the
        nickname is cleared — rebuild the matcher to drop the stale wake term."""
        nickname = extract_profile_nickname(contact)
        avatar = extract_profile_avatar(contact)
        if nickname != self._bot_nickname:
            self._bot_nickname = nickname
            self._mention_matcher = self._build_mention_matcher(nickname=nickname)
            if nickname:
                logger.info("[tlon] bot nickname for wake detection: %s", nickname)
            else:
                logger.info(
                    "[tlon] bot nickname cleared; waking on ship id and aliases only"
                )
        if avatar != self._bot_avatar:
            self._bot_avatar = avatar
            logger.info("[tlon] bot avatar %s", "updated" if avatar else "cleared")

    def _handle_contacts_event(self, raw: Any) -> None:
        if not isinstance(raw, dict):
            return
        self_update = raw.get("self")
        if not isinstance(self_update, dict):
            return
        contact = self_update.get("contact")
        if not isinstance(contact, dict):
            return
        self._apply_self_contact(contact)

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

    async def _start_lens(self) -> None:
        try:
            started = await self._lens_sync.start()
        except Exception as exc:
            logger.warning("[tlon] context-lens activation failed: %s", exc)
            self._telemetry.error("context_lens", exc, operation="start")
            return
        if started:
            set_active_recorder(self._lens)

    async def _stop_lens(self) -> None:
        try:
            await self._lens_sync.stop()
        except Exception as exc:
            logger.warning("[tlon] context-lens shutdown failed: %s", exc)

    async def _connect_sse(self) -> None:
        await self._close_sse()
        sse = TlonSSEClient(self.tlon_config, reap_detection=True)
        try:
            await sse.authenticate()
            await sse.open()
            await sse.subscribe("channels", "/v2")
            await sse.subscribe("chat", "/v3")
            await sse.subscribe("settings", f"/desk/{SETTINGS_DESK}")
            await sse.subscribe("groups", "/v1/foreigns")
            await sse.subscribe("contacts", "/v1/news")
            # Owner-requested retries arrive as %steward /v1/lens facts.
            # Optional: if %steward isn't installed the nack is skipped, not
            # fatal.
            if self._lens.enabled:
                await sse.subscribe("steward", "/v1/lens", optional=True)
        except BaseException:
            try:
                await sse.close(graceful=False)
            except BaseException:
                pass
            raise
        # The persistence queues resolve this pointer at poke time.  Do not
        # expose the client until its authentication, channel open, and
        # subscriptions have all completed.
        self._sse = sse

    async def _close_sse(self, *, graceful: bool = True) -> None:
        # Settle any in-flight watchdog probe first — rebuilds reach here
        # without the disconnect path's watchdog shutdown, and a probe still
        # inside its PUT could otherwise race the teardown and re-create the
        # channel it targets. A pending probe is either for this client or
        # stale cross-client garbage; both are safe to cancel.
        probe = self._sse_probe_task
        if probe is not None:
            probe.cancel()
            try:
                await probe
            except asyncio.CancelledError:
                pass
            self._sse_probe_task = None
        if self._sse is not None:
            try:
                await self._sse.close(graceful=graceful)
            finally:
                self._sse = None

    def _can_reauthenticate(self) -> bool:
        return not bool(self.tlon_config.cookie)

    def _is_fatal_auth_rejection(self, exc: BaseException) -> bool:
        """A 401/403 on the channel GET (``TlonChannelError``) or on an
        open/subscribe PUT (``TlonTerminalActionError``) is unrecoverable when
        the config cannot mint fresh credentials — i.e. a fixed ``TLON_COOKIE``
        the ship rejects. Retrying such a config only hammers the ship, so it
        must be surfaced as fatal from both the initial ``connect()`` and the
        ``_run_stream`` reconnect loop."""
        return (
            isinstance(exc, (TlonChannelError, TlonTerminalActionError))
            and getattr(exc, "status", None) in (401, 403)
            and not self._can_reauthenticate()
        )

    async def _run_stream(self) -> None:
        backoff_idx = 0

        def _established() -> None:
            nonlocal backoff_idx
            backoff_idx = 0

        async def _backoff_and_report(exc: BaseException, *, mode: str) -> None:
            nonlocal backoff_idx
            delay = RECONNECT_BACKOFF_SECONDS[
                min(backoff_idx, len(RECONNECT_BACKOFF_SECONDS) - 1)
            ]
            backoff_idx += 1
            self._telemetry.sse_reconnect(
                attempt=backoff_idx, delay_seconds=delay, error=exc, mode=mode
            )
            await asyncio.sleep(delay)

        while self._running:
            try:
                if self._sse is None:
                    try:
                        await self._connect_sse()
                        # Settings events do not replay, so re-sync owner-listen
                        # state after every reconnect.  The worker may still be
                        # processing facts captured before the disconnect; drain
                        # those first so this ordinary full snapshot cannot make
                        # authorization/approval/owner-listen decisions for an
                        # earlier queued message observe future state.
                        await self._drain_event_worker()
                        loaded = await self._load_settings_state()
                        self._nudge_settings_ready = loaded
                        if not loaded:
                            self._start_nudge_settings_retry()
                        # Native DM invites are likewise missed while disconnected
                        # (an unknown ship, a now-allowlisted ship, or a flag flip
                        # that happened during the outage). Catch up, but don't let
                        # a failure here masquerade as a stream error and cycle
                        # reconnects.
                        try:
                            await self._process_pending_dm_invites()
                        except Exception as exc:
                            logger.warning(
                                "[tlon] reconnect invite catch-up failed: %s", exc
                            )
                        # Group invites have the same gap: the foreigns
                        # subscription gets no snapshot on resubscribe, so
                        # anything that arrived during the outage is only seen
                        # here (or by a later live fact). Same guard as the DM
                        # catch-up — a failure must not cycle reconnects.
                        # Gated on a fresh settings read: auto-accept must not
                        # act on a possibly-stale allowlist, and the invites keep
                        # until the next reconnect.
                        if loaded:
                            try:
                                if not await self._process_pending_group_invites():
                                    logger.warning(
                                        "[tlon] reconnect group-invite catch-up failed"
                                    )
                            except Exception as exc:
                                logger.warning(
                                    "[tlon] reconnect group-invite catch-up failed: %s",
                                    exc,
                                )
                        # Contacts facts do not replay either; catch up on renames
                        # (or clears) missed while disconnected, and re-check the
                        # published identity claim (e.g. a version bump that has
                        # not been published yet).
                        self_contact = await self._load_bot_profile()
                        await self._publish_bot_info(self_contact)
                    except BaseException:
                        await self._close_sse(graceful=False)
                        raise
                assert self._sse is not None
                stream = self._sse.events(on_open=_established)
                try:
                    async for event in stream:
                        if not self._running:
                            return
                        await self._route_stream_event(event)
                finally:
                    await stream.aclose()
            except asyncio.CancelledError:
                return
            except TlonAuthError as exc:
                # The ship rejected the access code — reconnecting with the
                # same credentials can never succeed. Mark the adapter fatal
                # (core surfaces it and stops restart churn) instead of
                # hammering the ship at max-backoff forever.
                logger.error("[tlon] SSE auth rejected, stopping: %s", exc)
                await self._close_sse(graceful=False)
                self._telemetry.error("sse", exc, operation="authenticate")
                self._set_fatal_error("auth", str(exc), retryable=False)
                return
            except TlonChannelError as exc:
                if not self._running:
                    return
                self._nudge_settings_ready = False
                self._nudge_load_generation += 1
                await self._stop_nudge_settings_retry()
                if self._is_fatal_auth_rejection(exc):
                    await self._close_sse(graceful=False)
                    self._telemetry.error("sse", exc, operation="channel")
                    self._set_fatal_error("auth", str(exc), retryable=False)
                    return
                logger.warning("[tlon] SSE channel lost, rebuilding: %s", exc)
                await self._close_sse(graceful=False)
                await _backoff_and_report(exc, mode="rebuild")
            except Exception as exc:
                if not self._running:
                    return
                if self._sse is None:
                    self._nudge_settings_ready = False
                    self._nudge_load_generation += 1
                    await self._stop_nudge_settings_retry()
                    if self._is_fatal_auth_rejection(exc):
                        # Setup rejects auth in open()/subscribe() (a channel
                        # PUT) rather than on the SSE GET, so it never reaches
                        # the TlonChannelError branch. Same policy applies: a
                        # configured cookie the ship rejects can never succeed,
                        # and retrying forever just hammers the ship.
                        logger.error(
                            "[tlon] SSE setup auth rejected, stopping: %s", exc
                        )
                        self._telemetry.error("sse", exc, operation="setup")
                        self._set_fatal_error("auth", str(exc), retryable=False)
                        return
                    logger.warning("[tlon] SSE setup failed, retrying: %s", exc)
                    await _backoff_and_report(exc, mode="rebuild")
                else:
                    logger.warning(
                        "[tlon] SSE stream error (resuming from event %s): %s",
                        self._sse.last_heard_event_id, exc,
                    )
                    mode = (
                        "watchdog_stale"
                        if isinstance(exc, TlonStreamStaleError)
                        else "resume"
                    )
                    await _backoff_and_report(exc, mode=mode)

    def _start_event_worker(self) -> None:
        self._event_queue = asyncio.Queue(maxsize=_STREAM_EVENT_QUEUE_MAXSIZE)
        self._event_worker_task = asyncio.create_task(self._run_event_worker())
        self._sse_watchdog_task = asyncio.create_task(self._run_sse_watchdog())

    async def _stop_event_worker(self) -> None:
        if self._event_worker_task is not None:
            self._event_worker_task.cancel()
            try:
                await self._event_worker_task
            except asyncio.CancelledError:
                pass
            self._event_worker_task = None
        self._event_queue = None
        await self._stop_sse_watchdog()

    async def _stop_sse_watchdog(self) -> None:
        # Runs before _close_sse in the disconnect sequence so no probe can
        # race the client's teardown. The loop goes first so it cannot launch
        # a fresh probe while the pending one is being drained.
        if self._sse_watchdog_task is not None:
            self._sse_watchdog_task.cancel()
            try:
                await self._sse_watchdog_task
            except asyncio.CancelledError:
                pass
            self._sse_watchdog_task = None
        if self._sse_probe_task is not None:
            self._sse_probe_task.cancel()
            try:
                await self._sse_probe_task
            except asyncio.CancelledError:
                pass
            self._sse_probe_task = None

    async def _run_sse_watchdog(self) -> None:
        # Always runs, even when staleness condemnation is disabled
        # (threshold 0): the probe pokes are the reap detectors' only
        # guaranteed main-channel traffic on an idle bot.
        interval = self.tlon_config.sse_watchdog_interval_seconds
        threshold = self.tlon_config.sse_stale_threshold_seconds
        if 0 < threshold < interval:
            # Legal but pathological: staleness cannot fire until a probe has
            # been sent (>= one interval) and given a grace interval, so the
            # effective recovery time is bounded by ~2x the interval, not the
            # threshold.
            logger.warning(
                "[tlon] SSE stale threshold (%.0fs) is below the watchdog "
                "interval (%.0fs); staleness recovery will take up to ~%.0fs",
                threshold,
                interval,
                2 * interval,
            )
        while self._running:
            await asyncio.sleep(interval)
            if not self._running:
                return
            try:
                self._sse_watchdog_tick(time.monotonic(), interval)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("[tlon] SSE watchdog tick failed: %s", exc)

    def _sse_watchdog_tick(self, now: float, interval: float) -> None:
        # Backpressure gate: while the reader is parked on the bounded queue,
        # frames age without reaching the parser and a condemn would needlessly
        # resume a healthy stream once the stall clears.
        if self._route_blocked:
            return
        sse = self._sse
        # While unbound, the resume/rebuild loop owns recovery — and probes
        # must never fire at an unbound channel, so they cannot themselves
        # revive a reaped channel during an outage window.
        if sse is None or not sse.stream_bound:
            return
        probe = self._sse_probe_task
        if probe is not None and self._sse_probe_client is not sse:
            probe.cancel()
            self._sse_probe_task = None
        idle = now - sse.last_event_frame_at
        if idle < interval:
            return
        threshold = self.tlon_config.sse_stale_threshold_seconds
        epoch_at = self._sse_probe_epoch_at
        success_at = self._sse_probe_success_at
        epoch_valid = (
            epoch_at is not None
            and success_at is not None
            and self._sse_probe_client is sse
            and epoch_at > sse.last_event_frame_at
        )
        if (
            threshold > 0
            and idle >= threshold
            and epoch_valid
            # Condemnation additionally requires a full grace interval since
            # the delivered probe: an arithmetic relationship between the
            # knobs cannot guarantee probe-before-condemn, so it is tracked.
            and now - success_at >= interval
        ):
            logger.warning(
                "[tlon] SSE stream stale: no events for %.0fs (threshold %.0fs); "
                "forcing reconnect",
                idle,
                threshold,
            )
            sse.condemn(
                TlonStreamStaleError(
                    f"Tlon SSE stream stale: no events for {idle:.0f}s "
                    f"(threshold {threshold:.0f}s)"
                )
            )
            return
        if self._sse_probe_task is None and not epoch_valid:
            task = asyncio.create_task(self._send_sse_probe(sse))
            self._sse_probe_task = task
            task.add_done_callback(self._sse_probe_task_done)

    def _sse_probe_task_done(self, task: "asyncio.Task") -> None:
        if self._sse_probe_task is task:
            self._sse_probe_task = None

    async def _send_sse_probe(self, sse: TlonSSEClient) -> None:
        # Frame-order validity must use the probe's START time: on a single
        # event loop the probe's own ack can be parsed (refreshing
        # last_event_frame_at) before poke() returns, and a post-PUT epoch
        # would then postdate the answering ack and condemn a healthy stream
        # in the next silence.
        started_at = time.monotonic()
        try:
            await sse.poke("hood", "helm-hi", "Hermes SSE liveness probe")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # A failed PUT arms nothing: otherwise a broken outbound path
            # would let the grace clock condemn a healthy inbound stream.
            logger.debug("[tlon] SSE liveness probe failed: %s", exc)
            return
        self._sse_probe_epoch_at = started_at
        self._sse_probe_success_at = time.monotonic()
        self._sse_probe_client = sse

    async def _drain_event_worker(self) -> None:
        """Wait for pre-reconnect SSE work before applying a full snapshot."""
        queue = self._event_queue
        worker = self._event_worker_task
        if queue is not None and worker is not None and not worker.done():
            await queue.join()

    async def _run_event_worker(self) -> None:
        assert self._event_queue is not None
        while True:
            item = await self._event_queue.get()
            try:
                await self._process_stream_item(item)
            except asyncio.CancelledError:
                raise
            finally:
                self._event_queue.task_done()

    async def _process_stream_item(self, item: _StreamWorkItem) -> None:
        try:
            if item.app == "channels":
                if self._event_queue is None:
                    await self._handle_channel_event(item.raw)
                else:
                    await self._handle_channel_event(
                        item.raw, message=item.message, nudge_hook=item.nudge_hook
                    )
            elif item.app == "chat":
                if self._event_queue is None:
                    await self._handle_dm_event(item.raw)
                else:
                    await self._handle_dm_event(
                        item.raw, message=item.message, nudge_hook=item.nudge_hook
                    )
            elif item.app == "settings":
                await self._handle_settings_event(
                    item.raw, nudge_handled=item.nudge_settings_handled
                )
            elif item.app == "groups":
                await self._handle_foreigns(item.raw)
            elif item.app == "contacts":
                self._handle_contacts_event(item.raw)
            elif item.app == "steward":
                await self._handle_steward_event(item.raw)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("[tlon] %s event handler failed", item.app)
            self._telemetry.error("event_handler", exc, app=item.app)

    async def _route_stream_event(self, event: Any) -> None:
        """Apply nudge-critical state before the bounded ordered worker queue.

        The queue cap makes sustained overload backpressure the SSE reader.
        Nudge state must remain fresh even while enqueueing blocks, so its
        synchronous fast-tap always runs before the queue operation.
        """
        app = getattr(event, "app", "")
        raw = getattr(event, "json", None)
        item = _StreamWorkItem(app=app, raw=raw)
        try:
            if app == "channels" and isinstance(raw, dict):
                message = parse_channel_message(
                    raw, self_ship=self.tlon_config.ship_name, include_self=True
                )
                if message is not None:
                    item = _StreamWorkItem(
                        app=app,
                        raw=raw,
                        message=message,
                        nudge_hook=self._observe_nudge_owner_message(
                            message, is_dm=False
                        ),
                    )
            elif app == "chat" and not isinstance(raw, list):
                message = parse_dm_message(
                    raw, self_ship=self.tlon_config.ship_name, include_self=True
                )
                if message is not None:
                    item = _StreamWorkItem(
                        app=app,
                        raw=raw,
                        message=message,
                        nudge_hook=self._observe_nudge_owner_message(
                            message, is_dm=True
                        ),
                    )
            elif app == "settings":
                settings_event = parse_settings_event(raw)
                handled = settings_event is not None and self._apply_nudge_settings_event(
                    settings_event
                )
                item = _StreamWorkItem(
                    app=app, raw=raw, nudge_settings_handled=handled
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # A malformed fast-tap must not escape to _run_stream, where it
            # would be treated as a failed SSE connection. Keep the plain item
            # so the existing guarded worker can log and skip its dispatch.
            logger.warning("[tlon] %s event fast-tap failed: %s", app, exc)
            self._telemetry.error("event_fast_tap", exc, app=app)
        if self._event_queue is not None:
            self._route_blocked = True
            try:
                await self._event_queue.put(item)
            finally:
                self._route_blocked = False
        else:
            await self._process_stream_item(item)

    def _mark_nudge_seen(self, message: TlonIncomingMessage) -> bool:
        key = f"{message.chat_type}:{message.chat_id}:{message.message_id}"
        if key in self._nudge_seen_ids:
            return False
        self._nudge_seen_ids.add(key)
        self._nudge_seen_order.append(key)
        if len(self._nudge_seen_order) > 1000:
            self._nudge_seen_ids.discard(self._nudge_seen_order.pop(0))
        return True

    def _observe_nudge_owner_message(
        self, message: TlonIncomingMessage, *, is_dm: bool
    ) -> _NudgeHookResult:
        # DM parses set user_id to the conversation partner and author_id to
        # the actual sender, so with include_self=True the bot's own outbound
        # echo carries user_id=owner. Gate on the true author — a self echo
        # (including the nudge DM itself) must never count as owner activity
        # or clear just-written stage/pending state.
        author = normalize_ship(message.author_id or message.user_id)
        if (
            author == normalize_ship(self.tlon_config.ship_name)
            or not self._is_owner(author)
            or not self._mark_nudge_seen(message)
        ):
            return _NudgeHookResult()
        at = _epoch_ms(message.sent_at)
        if at is None:
            return _NudgeHookResult()
        # Advance-only, like the load path. Post edits re-deliver `r-post.set`
        # with the ORIGINAL creation `sent`, so an owner editing an old post
        # (with the dedup ring empty after a restart) would otherwise backdate
        # the activity shadow — and persist that stale instant — making an
        # active owner look idle for 7/14/30 days. A strictly older instant
        # never advances state; same-instant messages still process normally.
        current_activity = self._nudge_owner_activity
        if current_activity is not None and at < current_activity[0]:
            return _NudgeHookResult()
        date = datetime.fromtimestamp(at / 1000, timezone.utc).date().isoformat()
        # Owner activity is trusted just like a live settings event.  It can
        # arrive while a boot/retry scry is in flight, so make a later load
        # reconcile against this shadow (or discard the already-started one).
        self._nudge_load_seeded = True
        self._nudge_load_generation += 1
        self._nudge_owner_activity = (at, date)
        self._nudge_snapshot.last_owner_message_at = at
        self._nudge_snapshot.last_owner_message_date = date
        pending = self._pending_nudge
        was_rehydrated = self._pending_nudge_rehydrated
        will_clear = self._nudge_stage_shadow > 0 or pending is not None or not was_rehydrated
        if will_clear:
            self._set_nudge_stage(0)
        self._nudge_activity_persistence.enqueue(at, date, will_clear)
        eligible = bool(pending and is_nudge_eligible(pending, at))
        if pending is not None:
            if eligible:
                self._telemetry.nudge_reengaged(
                    stage=pending.stage,
                    nudge_sent_at=pending.sent_at,
                    reengaged_at=at,
                    account_id=pending.account_id,
                    owner_ship=pending.owner_ship,
                )
            self._set_pending_nudge(None)
            self._pending_nudge_persistence.enqueue(None)
        elif not was_rehydrated:
            self._set_pending_nudge(None)
            self._pending_nudge_persistence.enqueue(None)
        return _NudgeHookResult(
            pending=pending,
            inject_context=bool(pending is not None and eligible and is_dm),
        )

    @staticmethod
    def _reaction_conversation_key(chat_type: str, chat_id: str) -> str:
        return f"{chat_type}:{chat_id}"

    @staticmethod
    def _collapse_reaction_text(value: Any, limit: int, *, structural: bool = False) -> str:
        # Every Unicode Cc control (C0 *and* C1, e.g. U+009B) collapses to a
        # space; format/mark characters like ZWJ (Cf) and emoji variation
        # selectors (Mn) are untouched, so multi-codepoint emoji survive.
        raw = str(value or "")
        text = "".join(
            " " if unicodedata.category(ch) == "Cc" else ch for ch in raw
        )
        text = " ".join(text.split())
        if structural:
            text = text.replace("[", "(").replace("]", ")")
        return text[:limit]

    def _encode_reaction_note(self, reaction: TlonReaction, target: Any) -> str:
        action = "added" if reaction.added else "removed"
        emoji = self._collapse_reaction_text(reaction.emoji, 32, structural=True)
        reactor = self._collapse_reaction_text(reaction.reactor, 80, structural=True)
        post_id = self._collapse_reaction_text(reaction.post_id, 80, structural=True)
        author = self._collapse_reaction_text(
            getattr(target, "author", "unknown"), 80, structural=True
        )
        snippet = self._collapse_reaction_text(
            getattr(target, "content", ""), 200, structural=True
        )
        kind = "DM " if reaction.chat_type == "dm" else ""
        note = (
            f"Tlon {kind}reaction {action}: {emoji or '(unknown)'} by {reactor} "
            f"on message {post_id} (by {author})"
        )
        if snippet:
            note += f' (message: "{snippet}")'
        return note[:300]

    def _queue_reaction_note(self, reaction: TlonReaction, target: Any) -> None:
        key = self._reaction_conversation_key(reaction.chat_type, reaction.chat_id)
        notes = self._pending_reaction_notes.get(key)
        if notes is None:
            notes = deque(maxlen=10)
            self._pending_reaction_notes[key] = notes
        self._pending_reaction_notes.move_to_end(key)
        notes.append(self._encode_reaction_note(reaction, target))
        while len(self._pending_reaction_notes) > 64:
            self._pending_reaction_notes.popitem(last=False)

    async def _lookup_reaction_target(
        self, reaction: TlonReaction, snapshot_cache: Optional[dict] = None
    ) -> Any:
        # `snapshot_cache` — when supplied by the caller — memoizes the
        # lookup (including a failed/None result) for the lifetime of one
        # SSE event's transitions, so a snapshot with several authorized
        # entries for the same post makes at most one exact scry instead of
        # one per transition (a failing scry has a 30s timeout, and the SSE
        # reader processes events serially). It is never persisted beyond
        # that one call, so a later event still retries a prior failure.
        cache_key = (reaction.chat_type, reaction.chat_id, reaction.post_id)
        if snapshot_cache is not None and cache_key in snapshot_cache:
            return snapshot_cache[cache_key]

        cached = self._message_cache.lookup(reaction.chat_id, reaction.post_id)
        if cached is not None or reaction.chat_type != "group" or self._sse is None:
            if snapshot_cache is not None:
                snapshot_cache[cache_key] = cached
            return cached
        if reaction.parent_id:
            fetched = await fetch_reply(
                self._sse.scry,
                reaction.chat_id,
                reaction.parent_id,
                reaction.post_id,
            )
        else:
            fetched = await fetch_post(self._sse.scry, reaction.chat_id, reaction.post_id)
        # A failed scry, or one that can't identify the author, remains a
        # cache miss so a later event retries exact classification; only
        # entries with a decodable author become durable cache knowledge
        # (an "unknown"-author entry can't classify ownership, so caching it
        # would permanently misclassify the post — F-3).
        if fetched is not None and fetched.author and fetched.author != "unknown":
            self._message_cache.record(
                reaction.chat_id, fetched.post_id or reaction.post_id, fetched.author, fetched.content
            )
        if snapshot_cache is not None:
            snapshot_cache[cache_key] = fetched
        return fetched

    def _is_own_reaction_target(self, reaction: TlonReaction, target: Any) -> bool:
        bot = normalize_ship(self.tlon_config.ship_name)
        if reaction.chat_type == "dm":
            author = str(reaction.post_id).split("/", 1)[0]
            return normalize_ship(author) == bot
        return normalize_ship(str(getattr(target, "author", ""))) == bot

    async def _handle_reaction(
        self, reaction: TlonReaction, snapshot_cache: Optional[dict] = None
    ) -> None:
        if reaction.reactor == normalize_ship(self.tlon_config.ship_name):
            return
        if reaction.reactor_is_bot:
            self._learn_known_bot_ship(reaction.reactor)
        is_dm = reaction.chat_type == "dm"
        if not self._user_authorized(
            reaction.reactor, is_dm=is_dm, nest="" if is_dm else reaction.chat_id
        ):
            logger.info("[tlon] ignoring unauthorized reaction from %s", reaction.reactor)
            return
        if is_dm and await self._is_ship_blocked(reaction.reactor):
            logger.info("[tlon] ignoring DM reaction from blocked ship")
            return

        target = await self._lookup_reaction_target(reaction, snapshot_cache)
        if self._is_own_reaction_target(reaction, target) and reaction.added:
            emoji = self._collapse_reaction_text(reaction.emoji, 32)
            snippet = self._collapse_reaction_text(
                getattr(target, "content", ""), 200
            )
            text = f'{emoji} (reacting to: "{snippet}")' if snippet else emoji
            message = TlonIncomingMessage(
                chat_id=reaction.chat_id,
                chat_name=reaction.chat_id,
                chat_type=reaction.chat_type,
                user_id=reaction.reactor,
                user_name=reaction.reactor,
                text=text,
                message_id=(
                    # Event identity only (decision 10) — never shown to the
                    # model or resolved on the wire. The react component is
                    # arbitrary `@t`, so it is bounded the same way
                    # `_reaction_state_value` bounds reaction state (digest
                    # over 256 chars), keeping this id (which flows into
                    # LensRun.message_id and presence run ids) from growing
                    # unbounded while staying deterministic.
                    f"react/{reaction.post_id}/{reaction.reactor}/"
                    f"{_reaction_state_value(reaction.emoji)}"
                ),
                reply_to_message_id=reaction.parent_id,
                sent_at=datetime.now(tz=timezone.utc),
                raw=reaction.raw,
                author_is_bot=reaction.reactor_is_bot,
                author_id=reaction.reactor,
                reactable_target_id=reaction.post_id,
            )
            if not is_dm and not self._passes_group_loop_safety(message):
                return
            await self._dispatch_message(
                message,
                is_dm=is_dm,
                mark_seen=False,
                dispatch_reason="reaction",
            )
            return

        # An unresolved channel classification (scry failed, or the payload
        # had no decodable author) must stay retryable: the snapshot already
        # committed this entry, so without forgetting it a later reacts diff
        # on the post is a no-op and an own-post reaction would be lost as a
        # passive note forever. Forgetting the entry makes the next diff
        # re-emit the add and retry exact classification once the scry
        # recovers. Resolved non-own targets are final — no rollback.
        if reaction.added and not is_dm:
            author = str(getattr(target, "author", "") or "")
            if target is None or not author or author == "unknown":
                self._reaction_state.forget_entry(
                    reaction.chat_type,
                    reaction.chat_id,
                    reaction.post_id,
                    reaction.wire_key,
                )

        self._queue_reaction_note(reaction, target)

    async def _dispatch_reaction_transitions(self, transitions: list) -> None:
        """Handle every transition from one snapshot/delta event.

        Transitions for one event (all naming the same post) share a single
        target lookup (I1) instead of one exact scry per transition, and a
        failure handling one transition is logged and does not stop the
        remaining transitions of the same, already-committed snapshot from
        being handled (I2) — the SSE reader only ever sees this one event as
        having succeeded, so a raise here would otherwise lose the rest of
        the snapshot permanently (redelivery is a no-op diff once state is
        committed).
        """
        if not transitions:
            return
        snapshot_cache: dict = {}
        for reaction in transitions:
            try:
                await self._handle_reaction(reaction, snapshot_cache)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception(
                    "[tlon] reaction handler failed for %s in %s",
                    reaction.post_id,
                    reaction.chat_id,
                )
                self._telemetry.error(
                    "reaction_handler", exc, chat_type=reaction.chat_type
                )

    async def _handle_channel_event(
        self,
        raw: Any,
        *,
        message: Optional[TlonIncomingMessage] = None,
        nudge_hook: _NudgeHookResult = _NudgeHookResult(),
    ) -> None:
        if not isinstance(raw, dict):
            return
        nest = raw.get("nest")
        if not isinstance(nest, str) or not nest:
            return
        if message is None:
            message = parse_channel_message(
                raw, self_ship=self.tlon_config.ship_name, include_self=True
            )
            if message is not None:
                nudge_hook = self._observe_nudge_owner_message(message, is_dm=False)
        if nest not in self._monitored_channels:
            if self._auto_discover and (nest.startswith("chat/") or nest.startswith("heap/")):
                self._monitored_channels.add(nest)
                logger.info("[tlon] auto-discovered channel %s", nest)
            else:
                return

        if message is None:
            snapshot = parse_channel_reacts_snapshot(raw)
            if snapshot is not None:
                await self._dispatch_reaction_transitions(
                    self._reaction_state.apply_channel_snapshot(snapshot)
                )
            return
        self._message_cache.record(
            message.chat_id,
            message.message_id,
            message.author_id or message.user_id,
            message.text,
        )
        if message.author_id == normalize_ship(self.tlon_config.ship_name):
            return
        if message.author_is_bot:
            self._learn_known_bot_ship(message.user_id)

        is_mentioned = self._mention_matcher.mentioned(message.text)
        clean_text = (
            self._mention_matcher.strip_leading(message.text)
            if is_mentioned
            else message.text.strip()
        )
        inline_command = self._command_dispatch_override(message)
        if inline_command is not None:
            clean_text = inline_command

        if await self._maybe_handle_control_command(
            message, clean_text, ctx_nest=message.chat_id
        ):
            return
        sanitized_text = strip_block_directives(clean_text)

        is_authorized = self._user_authorized(
            message.user_id, is_dm=False, nest=message.chat_id
        )
        # Core commands (/help /status /new ...) are dispatched by the Hermes
        # gateway, not the adapter's pre-gate registry dispatcher, so without
        # this fact a bare owner core command dies at the attention gate in
        # any channel owner-listen does not cover — the same silent-ignore
        # trap the registry commands escape via _maybe_handle_control_command.
        # The fact comes from the inline-derived override, never from the
        # rendered text: a heap title or header block rendering as "/help"
        # must not gain command reach.
        is_owner_command = inline_command is not None
        is_owner_listen = self._is_owner(message.user_id) and owner_listen_active(
            self._owner_listen,
            message.chat_id,
            owner_ship=self.tlon_config.owner_ship,
            bot_ship=self.tlon_config.ship_name,
        )
        is_owner_blob = bool(message.blob) and self._is_owner(message.user_id)
        is_participated_thread = self._is_participated_thread(message)
        is_free_response = self.tlon_config.group_free_response_enabled(message.chat_id)
        decision = resolve_attention(
            AttentionFacts(
                is_dm=False,
                is_authorized=is_authorized,
                has_text=bool(clean_text or message.blob),
                is_mentioned=is_mentioned,
                is_owner_command=is_owner_command,
                is_owner_listen=is_owner_listen,
                is_owner_blob=is_owner_blob,
                is_free_response=is_free_response,
                is_participated_thread=is_participated_thread,
            )
        )
        if not decision.dispatch:
            if decision.reason == "unauthorized":
                if is_mentioned and _is_patp(message.user_id):
                    await self._queue_channel_approval(message, sanitized_text)
                else:
                    logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if not self._mark_seen(message):
            return
        if not self._passes_group_loop_safety(message):
            return
        is_command = inline_command is not None
        dispatch_text, prepared_media = await self._prepare_dispatch_payload(
            message, clean_text, is_command=is_command
        )
        dispatch_text = await self._with_group_context(
            message, dispatch_text, decision.reason, is_command=is_command
        )
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=False,
            mark_seen=False,
            dispatch_reason=decision.reason,
            prepared_media=prepared_media,
            pending_nudge=nudge_hook.inject_context,
            retry_seed=self._build_retry_seed(message, sanitized_text),
            is_command_dispatch=is_command,
        )

    async def _handle_dm_event(
        self,
        raw: Any,
        *,
        message: Optional[TlonIncomingMessage] = None,
        nudge_hook: _NudgeHookResult = _NudgeHookResult(),
    ) -> None:
        if isinstance(raw, list):
            await self._handle_dm_invites(raw)
            return
        if message is None:
            message = parse_dm_message(
                raw, self_ship=self.tlon_config.ship_name, include_self=True
            )
            if message is not None:
                nudge_hook = self._observe_nudge_owner_message(message, is_dm=True)
        if message is None:
            reaction = parse_dm_reaction(raw, self_ship=self.tlon_config.ship_name)
            if reaction is not None:
                await self._dispatch_reaction_transitions(
                    self._reaction_state.apply_dm_delta(reaction)
                )
            return
        self._message_cache.record(
            message.chat_id,
            message.message_id,
            message.author_id or message.user_id,
            message.text,
        )
        if message.author_id == normalize_ship(self.tlon_config.ship_name):
            return
        inline_command = self._command_dispatch_override(message)
        dm_text = inline_command if inline_command is not None else message.text
        if await self._maybe_handle_control_command(
            message, dm_text.strip(), ctx_nest=None
        ):
            return
        sanitized_text = strip_block_directives(dm_text)
        if not self._user_authorized(message.user_id, is_dm=True):
            if _is_patp(message.user_id):
                await self._queue_dm_approval(message, sanitized_text)
            else:
                logger.info(
                    "[tlon] ignoring unauthorized message in %s", message.chat_id
                )
            return
        if await self._is_ship_blocked(message.user_id):
            logger.info("[tlon] ignoring DM from blocked ship")
            return
        retry_seed = self._build_retry_seed(message, sanitized_text)
        is_command = inline_command is not None
        dispatch_text, prepared_media = await self._prepare_dispatch_payload(
            message, dm_text, is_command=is_command
        )
        if (
            nudge_hook.inject_context
            and nudge_hook.pending is not None
            # A core command must reach the gateway verbatim (see
            # _dispatch_message). The nudge accounting already happened in
            # _observe_nudge_owner_message, and the context only matters for
            # a model turn, which a command dispatch never starts.
            and not is_command
        ):
            dispatch_text = _nudge_reply_context(nudge_hook.pending, dispatch_text)
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=True,
            prepared_media=prepared_media,
            pending_nudge=nudge_hook.inject_context,
            retry_seed=retry_seed,
            is_command_dispatch=is_command,
        )

    async def _handle_dm_invites(self, ships: list) -> None:
        for raw_ship in ships:
            ship = normalize_ship(str(raw_ship or ""))
            if not _is_patp(ship) or ship == self.tlon_config.ship_name:
                continue
            if ship in self._processed_dm_invites:
                continue
            # Only mark processed on a terminal outcome (accepted / queued /
            # ignored-by-policy). A "left pending" no-op must not be marked,
            # so a later autoAcceptDmInvites=true reload/re-scan can still
            # accept it.
            if await self._handle_dm_invite(ship):
                self._processed_dm_invites.add(ship)

    async def _accept_dm_invite(self, ship: str) -> bool:
        with cli_context("invite_rsvp"):
            result = await self._cli.run_command(("dms", "accept", ship))
        if result.success:
            logger.info("[tlon] auto-accepted DM invite from %s", ship)
            await self._clear_pending_dm_approval(ship)
        else:
            logger.warning(
                "[tlon] failed to accept DM invite from %s: %s", ship, result.error
            )
        return result.success

    async def _clear_pending_dm_approval(self, ship: str) -> None:
        """Drop a stale invite-only 'dm' approval for a just-accepted ship.

        A ship can be auto-accepted while a 'dm' approval for it is still
        queued (queued while unknown, later allowlisted, then accepted by a
        re-scan). Leaving that approval behind would show a stale /pending
        card whose /allow would just redo the already-completed accept.

        Only a pure invite sentinel is cleared. A 'dm' approval that carries
        an ``originalMessage`` (queued from a real message, or an invite
        approval later enriched by one — dm approvals dedup by ship) must
        survive: its /allow still does meaningful work, replaying the queued
        message.
        """
        match = find_duplicate(
            self._pending_approvals, {"type": "dm", "requestingShip": ship}
        )
        if match is None or match.get("originalMessage"):
            return
        self._pending_approvals = remove_approval(
            self._pending_approvals, approval_id(match)
        )
        await self._persist_pending_approvals()

    async def _handle_dm_invite(self, ship: str) -> bool:
        """Decide the fate of one native DM invite (OpenClaw semantics:
        owner always accepts; every other allowlisted ship is gated by
        ``autoAcceptDmInvites``; unknown ships queue for approval).

        Returns True for terminal outcomes (accepted / queued /
        ignored-by-policy) and False for the "left pending" no-op, so the
        caller knows whether to mark the ship processed.
        """
        if self._is_owner(ship):
            return await self._accept_dm_invite(ship)
        if self._user_authorized(ship, is_dm=True):
            if self._auto_accept_dm_invites:
                return await self._accept_dm_invite(ship)
            # Authorized (env allowlists or the settings-store dmAllowlist)
            # but auto-accept is off: leave the native invite pending. Do
            # NOT queue (an already-approved inviter is a no-op, not a fresh
            # approval request) and do NOT mark processed, so a later
            # autoAcceptDmInvites=true reload / re-scan can still accept it.
            return False
        if not self.tlon_config.owner_ship:
            logger.info("[tlon] ignoring DM invite from unauthorized %s", ship)
            return True
        await self._queue_approval(
            approval_kind="dm",
            requesting_ship=ship,
            message_preview=DM_INVITE_PREVIEW,
        )
        return True

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
        for flag in error_progress_flags(payload):
            # The accept-invite CLI call acked but the backend join failed, so
            # the flag is actionable again; discarding before the marker check
            # is what lets a flag marked by the accept (or by the
            # confirmed-blocked branch) reach a fresh decision.
            self._processed_group_invites.discard(flag)
        for invite in parse_foreigns(payload):
            flag = invite["groupFlag"]
            if flag in self._processed_group_invites:
                continue
            await self._handle_group_invite(
                flag, inviter=invite["from"], title=invite["title"]
            )

    async def _handle_group_invite(self, flag: str, *, inviter: str, title: str) -> None:
        ship = normalize_ship(inviter)
        owner = self.tlon_config.owner_ship
        accept = False
        if owner and ship == owner:
            # Owner invites accept without consulting the block list.
            accept = True
        elif self._group_invite_authorized(inviter):
            # SECURITY: auto-accept requires a positive "not blocked"
            # confirmation (openclaw parity). A failed lookup is unknown and
            # falls through to the queue path — it must never auto-accept.
            blocked = await self._scry_blocked_ships()
            if blocked is None:
                pass
            elif ship in blocked:
                # Confirmed blocked: silent ignore, no card.
                logger.info(
                    "[tlon] ignoring group invite %s from blocked %s", flag, inviter
                )
                self._processed_group_invites.add(flag)
                return
            else:
                accept = True
        if accept:
            if await self._accept_group_invite(flag):
                # Mark processed only on success; a failed accept retries.
                self._processed_group_invites.add(flag)
                # A card queued before the inviter was allowlisted now points
                # at an invite that is gone.
                await self._drop_pending_group_approval(flag)
                logger.info("[tlon] auto-accepted group invite %s from %s", flag, inviter)
            return
        if not self.tlon_config.owner_ship:
            # Unprocessed so a later owner/allowlist change can pick it up.
            logger.info("[tlon] ignoring group invite %s from unauthorized %s", flag, inviter)
            return
        # Queue path never marks — suppression/retry live in the approval record.
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

    async def _reject_group_invite(self, flag: str) -> bool:
        """Decline the invite on the ship so it leaves foreigns for good."""
        with cli_context("invite_rsvp"):
            result = await self._cli.run_command(("groups", "reject-invite", flag))
        if not result.success:
            logger.warning("[tlon] failed to decline group invite %s: %s", flag, result.error)
            self._telemetry.error(
                "approval", result.error or "group decline failed", operation="group_decline"
            )
            return False
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

    async def _refresh_nest_to_group(self) -> None:
        """Rebuild the nest -> group-flag map from `/groups-ui/v7/init`.

        The same payload the group lookups above walk. On failure the previous
        map is kept — a stale flag beats none, and the next render retries.
        """
        if self._sse is None:
            return
        try:
            init = await self._sse.scry("/groups-ui/v7/init")
        except Exception as exc:
            logger.debug("[tlon] could not scry nest-to-group map: %s", exc)
            return
        groups = init.get("groups") if isinstance(init, Mapping) else None
        if not isinstance(groups, Mapping):
            return
        resolved: dict[str, str] = {}
        for flag, group in groups.items():
            if not isinstance(flag, str) or not isinstance(group, Mapping):
                continue
            channels = group.get("channels")
            if not isinstance(channels, Mapping):
                continue
            for channel_nest in channels:
                if isinstance(channel_nest, str) and channel_nest:
                    resolved[channel_nest] = flag
        self._nest_to_group = resolved

    async def _channel_groups_for(
        self, approvals: Iterable[Mapping[str, Any]]
    ) -> dict[str, str]:
        """nest -> group flag for the channel approvals about to be rendered.

        Resolved at render time rather than stored on the approval record, so
        the `pendingApprovals` schema OpenClaw shares stays unchanged and
        already-persisted approvals gain the link too. At most one scry per
        render: the map is rebuilt once when any nest is missing from it, and
        nests still unresolved after that are omitted (a nest whose group the
        bot has left has no navigable group anyway).
        """
        nests: list[str] = []
        for approval in approvals:
            nest = approval_nest(approval)
            if approval_type(approval) == "channel" and nest and nest not in nests:
                nests.append(nest)
        if not nests:
            return {}
        if any(nest not in self._nest_to_group for nest in nests):
            await self._refresh_nest_to_group()
        return {
            nest: self._nest_to_group[nest]
            for nest in nests
            if self._nest_to_group.get(nest)
        }

    async def _lookup_diary_channel_title(self, nest: str) -> Optional[str]:
        canonical = canonicalize_nest(nest)
        if canonical is None:
            return None
        if self._sse is None:
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                "SSE client is not connected",
            )
            return None
        try:
            init = await self._sse.scry("/groups-ui/v7/init")
        except Exception as exc:
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                exc,
            )
            return None
        if not isinstance(init, Mapping):
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                "init payload is not a mapping",
            )
            return None
        groups = init.get("groups")
        if not isinstance(groups, Mapping):
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                "groups payload is not a mapping",
            )
            return None

        discovered_title: Optional[str] = None
        usable_group = False
        usable_channels = False
        for group_data in groups.values():
            if not isinstance(group_data, Mapping):
                continue
            usable_group = True
            channels = group_data.get("channels")
            if not isinstance(channels, Mapping):
                continue
            usable_channels = True
            for channel_nest, channel_data in channels.items():
                if not isinstance(channel_nest, str) or not isinstance(
                    channel_data, Mapping
                ):
                    continue
                channel_canonical = canonicalize_nest(channel_nest)
                if channel_canonical != canonical:
                    continue
                meta = channel_data.get("meta")
                meta_title = meta.get("title") if isinstance(meta, Mapping) else None
                title = (
                    meta_title
                    if meta_title is not None
                    else channel_data.get("title")
                )
                if isinstance(title, str) and title.strip():
                    discovered_title = title.strip()

        if groups and not usable_group:
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                "group entries are not mappings",
            )
            return None
        if groups and not usable_channels:
            logger.debug(
                "[tlon] diary migration title lookup unavailable for %s: %s",
                canonical,
                "channel payloads are not mappings",
            )
            return None

        if discovered_title is None:
            logger.debug(
                "[tlon] diary migration title lookup missed nest %s in usable init payload",
                canonical,
            )
        return discovered_title

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

    async def _process_pending_group_invites(self) -> bool:
        """Catch group invites that arrived while the gateway was down.

        Returns False when the catch-up did not actually read a snapshot —
        scry failure or a response without a usable `foreigns` map. An empty
        map is a real answer (no pending invites) and counts as success.
        Callers surface the result; boot keeps ignoring it, reconnect logs a
        warning.
        """
        if self._sse is None:
            return False
        try:
            init = await self._sse.scry("/groups-ui/v7/init")
        except Exception as exc:
            logger.debug("[tlon] could not scry pending group invites: %s", exc)
            return False
        foreigns = init.get("foreigns") if isinstance(init, dict) else None
        if not isinstance(foreigns, dict):
            logger.debug("[tlon] group-invite catch-up returned no foreigns map")
            return False
        await self._handle_foreigns(foreigns)
        return True

    async def _prepare_dispatch_payload(
        self,
        message: TlonIncomingMessage,
        text: str,
        *,
        is_command: bool = False,
    ) -> tuple[str, PreparedMedia]:
        # A core command must reach the gateway verbatim: a cite or media
        # prefix would displace the leading slash the gateway's command
        # classifier looks for. The fact is threaded from the handler's
        # inline-derived override — never re-derived from rendered text,
        # which block rendering can forge.
        if is_command:
            return text, PreparedMedia()
        cite_block = ""
        if self._sse is not None and message.content:
            partial: list[str] = []
            try:
                cite_block = await asyncio.wait_for(
                    resolve_cites(
                        self._sse.scry, message.content, collected=partial
                    ),
                    CITE_RESOLUTION_BUDGET_SECONDS,
                )
            except (Exception, asyncio.TimeoutError) as exc:
                logger.debug(
                    "[tlon] cite resolution failed for %s: %s",
                    message.message_id,
                    exc,
                )
                self._telemetry.error("cite_resolve", exc)
                if isinstance(exc, asyncio.TimeoutError) and partial:
                    cite_block = "\n".join(partial)
        try:
            prepared = await prepare_inbound_media(message.content, message.blob)
        except Exception as exc:
            logger.debug(
                "[tlon] media preparation failed for %s: %s",
                message.message_id,
                exc,
            )
            self._telemetry.error("media_prepare", exc)
            prepared = PreparedMedia()
        if not prepared.text_prefix:
            dispatch_text = text
        else:
            body = str(text or "").strip()
            dispatch_text = (
                f"{prepared.text_prefix}\n{body}" if body else prepared.text_prefix
            )
        if cite_block:
            dispatch_text = f"{cite_block}\n\n{dispatch_text}"
        return dispatch_text, prepared

    async def _with_group_context(
        self,
        message: TlonIncomingMessage,
        clean_text: str,
        reason: str,
        *,
        is_command: bool = False,
    ) -> str:
        """Prepend recent channel or thread history so group replies have context."""
        # Never wrap a core command: the gateway classifies commands with
        # MessageEvent.text.startswith("/") (pinned core's is_command), so
        # prepended history would silently turn /new, /stop, etc. into an
        # ordinary model prompt. A command needs no conversational context.
        # The fact is threaded from the handler's inline-derived override.
        if is_command:
            return clean_text
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
                    include_ids=self.tlon_config.reaction_level
                    in {"minimal", "extensive"},
                )
            else:
                entries = await fetch_channel_history(scry, message.chat_id, limit)
                enriched = build_channel_context(
                    entries,
                    current_text=clean_text,
                    current_id=message.message_id,
                    is_mention=reason == "mention",
                    limit=limit,
                    include_ids=self.tlon_config.reaction_level
                    in {"minimal", "extensive"},
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

    def _learn_known_bot_ship(self, ship: str) -> None:
        sender = normalize_ship(ship)
        if not sender or sender in self._known_bot_ships:
            return
        self._known_bot_ships.add(sender)
        logger.info("[tlon] learned bot ship from channel author metadata: %s", sender)

    def _passes_group_loop_safety(self, message: TlonIncomingMessage) -> bool:
        channel = message.chat_id
        sender = normalize_ship(message.user_id)
        is_known_bot = (
            message.author_is_bot
            or sender in self._known_bot_ships
            or sender in self.tlon_config.known_bot_users
        )
        if not is_known_bot:
            self._known_bot_consecutive_by_channel[channel] = 0
            self._pending_bot_cap_addendum.pop(channel, None)
            return True

        count = self._known_bot_consecutive_by_channel.get(channel, 0) + 1
        self._known_bot_consecutive_by_channel[channel] = count
        limit = self.tlon_config.max_consecutive_bot_responses
        if limit <= 0:
            return True
        if count > limit:
            logger.info(
                "[tlon] dropping known-bot message from %s in %s after %s consecutive dispatch attempts",
                sender,
                channel,
                count,
            )
            return False
        if count == limit:
            self._pending_bot_cap_addendum[channel] = (sender, message.message_id)
        return True

    async def _dispatch_message(
        self,
        message: TlonIncomingMessage,
        *,
        is_dm: bool,
        mark_seen: bool = True,
        dispatch_reason: str = "dm",
        prepared_media: PreparedMedia | None = None,
        pending_nudge: bool = False,
        retry_seed: dict[str, Any] | None = None,
        retry_of: str | None = None,
        skip_authorization: bool = False,
        # Threaded from the handler's inline-derived override (see
        # _command_dispatch_override); defaults False so callers that never
        # carry commands (synthetic reactions, approval replays of non-owner
        # messages) get ordinary decoration.
        is_command_dispatch: bool = False,
    ) -> None:
        # Owner-requested retries re-run a message from an already-authorized
        # sender, so they skip the inbound authorization gate (the owner vetted
        # the original) but the caller still enforces the native block check.
        if not skip_authorization and not self._user_authorized(
            message.user_id,
            is_dm=is_dm,
            nest="" if is_dm else message.chat_id,
        ):
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if mark_seen and not self._mark_seen(message):
            return

        message = replace(message, text=strip_block_directives(message.text))

        if (
            dispatch_reason == "reaction"
            and message.reactable_target_id
            and not message.reply_to_message_id
        ):
            # Top-level own-post reaction: there is no thread root, so
            # source.thread_id will be None and send()'s reply_in_thread
            # fallback would otherwise thread on message.message_id — the
            # synthetic `react/…` event id, not a real wire post (I3).
            # Record the real reactable target so send() can recover it.
            self._reaction_reply_targets[message.message_id] = message.reactable_target_id
            self._reaction_reply_targets.move_to_end(message.message_id)
            while len(self._reaction_reply_targets) > 200:
                self._reaction_reply_targets.popitem(last=False)

        notes_key = self._reaction_conversation_key(message.chat_type, message.chat_id)
        # A core command must reach the gateway verbatim: its command
        # classifier is text.startswith("/") and its args parser takes
        # everything after the token, so a reaction-note prefix would hide
        # the command and an id-marker suffix would pollute its arguments.
        # Notes are not peeked for a command, so they stay queued for the
        # next conversational dispatch. The fact arrives as a parameter —
        # re-deriving it from message.text here would let a heap title or
        # header block that renders as "/help" skip decoration.
        pending_notes = (
            ()
            if is_command_dispatch
            else tuple(self._pending_reaction_notes.get(notes_key, ()))
        )
        dispatch_text = message.text
        if pending_notes:
            dispatch_text = (
                "[Recent reactions in this conversation]\n"
                + "\n".join(pending_notes)
                + "\n\n"
                + dispatch_text
            )
        if not is_command_dispatch and self.tlon_config.reaction_level in {
            "minimal",
            "extensive",
        }:
            target_id = message.reactable_target_id or message.message_id
            marker = (
                "reacted message id"
                if message.reactable_target_id
                else "message id"
            )
            dispatch_text += f"\n\n[{marker}: {target_id}]"
            if message.reply_to_message_id:
                dispatch_text += f"\n[thread root: {message.reply_to_message_id}]"

        # Final boundary, anti-forgery only: the gateway's command classifier
        # is text.startswith("/"), and a heap title or header block can forge
        # that position — so a slash-leading dispatch is defused with a
        # leading newline (invisible to the model) unless the sender genuinely
        # TYPED leading slash text, in a channel type where commands belong
        # (chat/DM). A typed command outside the popup's six — including the
        # ~40 unsuggested core commands, from any sender — passes through
        # untouched: hermes core's slash-access policy remains the
        # authorization ceiling, exactly as before this change.
        if not is_command_dispatch and dispatch_text.startswith("/"):
            typed_slash = self._typed_inline_text(message).startswith("/")
            in_scope = message.chat_type == "dm" or message.chat_id.startswith(
                "chat/"
            )
            if not (typed_slash and in_scope):
                dispatch_text = "\n" + dispatch_text

        self._telemetry.start_reply(
            message.chat_id,
            chat_type="dm" if is_dm else "groupChannel",
            is_thread=bool(message.reply_to_message_id),
            sender_role="owner" if self._is_owner(message.user_id) else "user",
            dispatch_reason=dispatch_reason,
        )
        await self._begin_lens_run(
            message,
            is_dm=is_dm,
            dispatch_reason=dispatch_reason,
            pending_nudge=pending_nudge,
            retry_seed=retry_seed,
            retry_of=retry_of,
        )
        try:
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
            prepared = prepared_media or PreparedMedia()
            event_kwargs = {
                "text": dispatch_text,
                "message_type": _message_type_member(prepared.message_type),
                "source": source,
                "raw_message": message.raw,
                "message_id": message.message_id,
                "reply_to_message_id": reply_context,
                "timestamp": message.sent_at,
                "media_urls": list(prepared.media_urls),
                "media_types": list(prepared.media_types),
            }
            try:
                event = MessageEvent(**event_kwargs)
            except TypeError:
                # Keeps older Hermes test doubles and runtimes from failing
                # before they pick up the native media fields.
                media_urls = event_kwargs.pop("media_urls")
                media_types = event_kwargs.pop("media_types")
                event = MessageEvent(**event_kwargs)
                setattr(event, "media_urls", media_urls)
                setattr(event, "media_types", media_types)
            self._remember_dispatch_sender(
                (message.chat_id, str(message.message_id)), message.user_id
            )
            await self.handle_message(event)
            # Peeked notes are committed only after core accepted the event;
            # failed/duplicate/unauthorized dispatches leave them untouched.
            if pending_notes:
                notes = self._pending_reaction_notes.get(notes_key)
                if notes is not None:
                    for note in pending_notes:
                        if notes and notes[0] == note:
                            notes.popleft()
                        else:
                            break
                    if not notes:
                        self._pending_reaction_notes.pop(notes_key, None)
        except Exception:
            # Dispatch raised before on_processing_complete could finalize the
            # run (e.g. _route_stream_event catches and skips handle_message
            # errors). Close it out as an error so the lens UI shows a terminal
            # state and the run doesn't leak until the next prune.
            self._remove_dispatch_state(
                (message.chat_id, str(message.message_id))
            )
            await self._finish_lens_run_on_error(message.chat_id)
            raise

    async def on_processing_start(self, event: MessageEvent) -> None:
        await self._computing_presence.refresh_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )

    async def _begin_lens_run(
        self,
        message: TlonIncomingMessage,
        *,
        is_dm: bool,
        dispatch_reason: str,
        pending_nudge: bool = False,
        retry_seed: dict[str, Any] | None = None,
        retry_of: str | None = None,
    ) -> None:
        if not self._lens.active:
            return
        # The lens is a non-essential observability sink; a bug in its
        # accounting must never break message dispatch. Poke failures are
        # already swallowed by TlonLensSync.push — this guards the rest.
        try:
            conversation_kind = "dm" if is_dm else "channel"
            run = LensRun(
                lens_id=str(uuid.uuid4()),
                message_id=message.message_id,
                chat_type=conversation_kind,
                trigger=_lens_trigger(dispatch_reason, is_dm=is_dm),
                conversation_kind=conversation_kind,
                run_kind=_lens_run_kind(dispatch_reason),
                author_ship=normalize_ship(message.user_id) or None,
                conversation_id=message.chat_id,
                received_at=_epoch_ms(message.sent_at),
                preview=message.text or None,
                thread_messages=1 if message.reply_to_message_id else 0,
                emits_telemetry=self._telemetry.enabled,
                pending_nudge=pending_nudge,
                retry_seed=retry_seed,
                retry_of=retry_of,
            )
            run.set_status("dispatching")
            self._lens.begin(message.chat_id, run)
            await self._lens.push(message.chat_id)
        except Exception as exc:
            logger.warning("[tlon] context-lens begin failed: %s", exc)
            self._telemetry.error("context_lens", exc, operation="begin")

    def _lens_reference_blob(self, conversation_id: str) -> Optional[str]:
        if not self._lens.active:
            return None
        run = self._lens.get(conversation_id)
        if run is None:
            return None
        return context_lens_reference_blob(
            run.lens_id, normalize_ship(self.tlon_config.ship_name) or None
        )

    async def _finish_lens_run_on_error(self, conversation_id: str) -> None:
        if not self._lens.active:
            return
        try:
            # finish() no-ops if the run already reached a terminal state and
            # was popped (e.g. on_processing_complete ran before the raise).
            await self._lens.finish(conversation_id, status="error")
        except Exception as exc:
            logger.warning("[tlon] context-lens error-finish failed: %s", exc)

    async def _handle_steward_event(self, raw: Any) -> None:
        """Handle a %steward /v1/lens fact.

        Only ``retry-requested`` is actionable here: an owner tapped Retry on a
        finalized run's lens card, so the bot ship should re-dispatch it.
        ``entry`` / ``recent`` facts are our own echoes and are ignored. This
        runs in the serial event worker, so a retry can't race a live run
        in the same conversation.
        """
        if not self._lens.enabled or not isinstance(raw, dict):
            return
        request = raw.get("retry-requested")
        if not isinstance(request, dict):
            # Compatibility: tolerate a nested {lens:{retry-requested}} shape.
            nested = raw.get("lens")
            if isinstance(nested, dict) and isinstance(
                nested.get("retry-requested"), dict
            ):
                request = nested["retry-requested"]
            else:
                return
        lens_id = str(request.get("id") or "").strip()
        requester = normalize_ship(str(request.get("requester") or ""))
        if not lens_id or not requester:
            return
        # Steward keys runs (and emits retry-requested) to the lens owner, which
        # is context_lens_owner_ship() and may differ from owner_ship. Match the
        # singular owner the agent stores, not the general adapter owner.
        if requester != self._lens.owner:
            logger.info("[tlon] ignoring lens retry from non-owner %s", requester)
            return
        if not self._reserve_retry(lens_id):
            logger.debug("[tlon] duplicate lens retry for %s ignored", lens_id)
            return
        keep_reservation = False
        try:
            # Memory-then-disk lookup, gateway-local like OpenClaw's chain; the
            # bot ship's steward is empty with a remote owner so no ship scry.
            lens = self._lens.find_recent_lens(lens_id)
            if lens is None:
                logger.info("[tlon] lens retry %s: run not found", lens_id)
                return
            result = build_retry_dispatch(lens)
            if not result.ok or result.dispatch is None:
                logger.info("[tlon] lens retry %s refused: %s", lens_id, result.reason)
                return
            dispatch = result.dispatch
            if await self._is_ship_blocked(dispatch.sender_ship):
                logger.info(
                    "[tlon] lens retry %s: sender %s is blocked",
                    lens_id,
                    dispatch.sender_ship,
                )
                return
            # Committed to dispatching (past every refusal path): hold the
            # dedup slot even if the dispatch itself raises, so a duplicate
            # fact or double-tap within the window can't start a second run.
            keep_reservation = True
            await self._dispatch_retry(dispatch, retry_of=lens_id)
        finally:
            if not keep_reservation:
                self._retry_dedup.pop(lens_id, None)

    def _reserve_retry(self, lens_id: str) -> bool:
        """Reserve the dedup slot for a lensId before any await.

        Returns False if a retry for this run is already in flight or was
        handled within RETRY_DEDUP_SECONDS.
        """
        now = time.monotonic()
        cutoff = now - RETRY_DEDUP_SECONDS
        stale = [k for k, ts in self._retry_dedup.items() if ts < cutoff]
        for key in stale:
            self._retry_dedup.pop(key, None)
        if lens_id in self._retry_dedup:
            return False
        self._retry_dedup[lens_id] = now
        return True

    async def _dispatch_retry(self, dispatch: RetryDispatch, *, retry_of: str) -> None:
        is_dm = not dispatch.is_group
        chat_id = dispatch.sender_ship if is_dm else (dispatch.channel_nest or "")
        if not chat_id:
            logger.info("[tlon] lens retry %s: no conversation to dispatch", retry_of)
            return
        message = TlonIncomingMessage(
            chat_id=chat_id,
            chat_name=chat_id,
            chat_type="dm" if is_dm else "group",
            user_id=dispatch.sender_ship,
            user_name=dispatch.sender_ship,
            text=dispatch.message_text,
            message_id=dispatch.message_id,
            # Hermes uses one parent for both context and delivery, so prefer the
            # delivery override when a seed carries it (TS: replyParentId ?? parentId).
            reply_to_message_id=dispatch.reply_parent_id or dispatch.parent_id,
            sent_at=datetime.now(tz=timezone.utc),
            raw={"lensRetry": retry_of},
            content=dispatch.message_content,
            blob=dispatch.blob_field,
            # Recomputed from the carried story so the command fact survives
            # retry reconstruction (a /new <tail> turn can retry).
            inline_text=extract_inline_message_text(dispatch.message_content),
        )
        # Re-run media/context prep exactly like a fresh inbound message; the
        # seed carried clean (pre-enrichment) text so this doesn't double-wrap.
        retry_seed = self._build_retry_seed(message, dispatch.message_text)
        inline_command = self._command_dispatch_override(message)
        is_command = inline_command is not None
        dispatch_text, prepared_media = await self._prepare_dispatch_payload(
            message, dispatch.message_text, is_command=is_command
        )
        if not is_dm:
            dispatch_text = await self._with_group_context(
                message, dispatch_text, "retry", is_command=is_command
            )
        await self._dispatch_message(
            replace(message, text=dispatch_text),
            is_dm=is_dm,
            mark_seen=False,
            dispatch_reason="retry",
            prepared_media=prepared_media,
            retry_seed=retry_seed,
            retry_of=retry_of,
            is_command_dispatch=is_command,
            skip_authorization=True,
        )

    async def on_processing_complete(self, event: MessageEvent, outcome: Any) -> None:
        # Release the presence lease first.  The gateway runs this hook through
        # a wrapper that swallows every exception, so anything that raises
        # above this call would leave the run registered and the keepalive
        # would refresh its lease for the life of the process.
        await self._computing_presence.stop_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )
        source = getattr(event, "source", None)
        chat_id = str(getattr(source, "chat_id", "") or "")
        message_id = str(
            getattr(source, "message_id", None)
            or getattr(event, "message_id", None)
            or ""
        )
        if chat_id and message_id:
            self._remove_dispatch_state((chat_id, message_id))
        processing_outcome = _processing_outcome_value(outcome)
        self._telemetry.finish_reply(
            event.source.chat_id,
            processing_outcome=processing_outcome,
        )
        existing = self._lens.get(event.source.chat_id)
        delivered = bool(existing and existing.delivered_message_count > 0)
        delivery_failed = bool(existing and existing.delivery_failed)
        await self._lens.finish(
            event.source.chat_id,
            status=_lens_final_status(
                processing_outcome,
                delivered=delivered,
                delivery_failed=delivery_failed,
            ),
        )

    def _remove_dispatch_state(self, message_key: tuple[str, str]) -> None:
        self._inflight_senders.pop(message_key, None)
        stale = [
            directive_key
            for directive_key in self._executed_block_directives
            if directive_key[:2] == message_key
        ]
        for directive_key in stale:
            self._executed_block_directives.pop(directive_key, None)

    def _remember_dispatch_sender(
        self, message_key: tuple[str, str], sender: str
    ) -> None:
        self._remove_dispatch_state(message_key)
        self._inflight_senders[message_key] = normalize_ship(sender).lower()
        self._inflight_senders.move_to_end(message_key)
        while len(self._inflight_senders) > self._DISPATCH_STATE_CAPACITY:
            oldest = next(iter(self._inflight_senders))
            self._remove_dispatch_state(oldest)

    def _remember_executed_block(
        self, directive_key: tuple[str, str, str]
    ) -> None:
        self._executed_block_directives[directive_key] = None
        self._executed_block_directives.move_to_end(directive_key)
        while len(self._executed_block_directives) > self._DISPATCH_STATE_CAPACITY:
            oldest = next(iter(self._executed_block_directives))
            self._remove_dispatch_state(oldest[:2])

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

    def _next_lens_sent_at(self) -> int:
        """Allocate the post ID timestamp for one lens-stamped output."""
        sent_at_ms = max(int(time.time() * 1000), self._last_lens_sent_at + 1)
        self._last_lens_sent_at = sent_at_ms
        return sent_at_ms

    async def _deliver_post(
        self,
        chat_id: str,
        content: str,
        *,
        parent_id: Optional[str] = None,
        parent_author: Optional[str] = None,
        blob_fields: Sequence[str | None] = (),
        lens_blob: Optional[str] = None,
    ) -> tuple[Any, Optional[int]]:
        """Deliver one post after composing every applicable blob source.

        ``blob_fields`` is the adapter-facing producer seam: callers pass
        complete serialized post-blob arrays, which are ordered before the
        internal lens reference. A caller-provided blob must ride non-empty
        content (the published CLI has no blob-only send transport).
        """
        blob = combine_blob_fields(*blob_fields, lens_blob)
        sent_at_ms = self._next_lens_sent_at() if lens_blob is not None else None
        if parent_id:
            result = await self._cli.send_reply(
                chat_id,
                parent_id,
                content,
                parent_author=parent_author,
                blob=blob,
                sent_at=sent_at_ms,
            )
        else:
            result = await self._cli.send_message(
                chat_id, content, blob=blob, sent_at=sent_at_ms
            )
        canonical = canonicalize_nest(chat_id)
        if (
            not result.success
            and canonical is not None
            and canonical.startswith("diary/")
        ):
            refusal = diary_target_blocked_message(canonical)
            result = replace(
                result,
                stderr=f"Error: {refusal}\n",
                error=f"Error: {refusal}",
            )
            start_diary_migration_discovery(canonical)
        return result, sent_at_ms

    async def _process_block_directives(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str],
    ) -> tuple[str, bool]:
        if not find_block_directives(content):
            return content, False

        directives = find_executable_block_directives(content)

        reply_id = str(reply_to or "")
        message_key = (chat_id, reply_id)
        tracked_sender = self._inflight_senders.get(message_key)
        owner = normalize_ship(self.tlon_config.owner_ship).lower()

        for raw_target, reason in directives:
            target = normalize_ship(raw_target).lower()
            if owner and target == owner:
                logger.warning(
                    "[tlon] block directive rejected: target is configured owner"
                )
                continue
            if not reply_id:
                logger.warning(
                    "[tlon] block directive rejected: missing reply correlation"
                )
                continue
            if tracked_sender is None:
                logger.warning(
                    "[tlon] block directive rejected: unknown reply correlation"
                )
                continue
            if not _is_dm_chat_id(chat_id):
                logger.warning(
                    "[tlon] block directive rejected: conversation is not a direct message"
                )
                continue
            dm_counterparty = normalize_ship(chat_id).lower()
            if tracked_sender != dm_counterparty:
                logger.warning(
                    "[tlon] block directive rejected: correlated sender is not DM counterparty"
                )
                continue
            if target != tracked_sender:
                logger.warning(
                    "[tlon] block directive rejected: target is not correlated sender"
                )
                continue

            directive_key = (chat_id, reply_id, target)
            if directive_key in self._executed_block_directives:
                continue
            self._remember_executed_block(directive_key)
            if not await self._block_ship(target):
                self._executed_block_directives.pop(directive_key, None)
                await self._notify_owner(target, reason, block_succeeded=False)
                continue
            await self._remove_from_dm_allowlist(target)
            await self._drop_pending_approvals_for(target, types=("dm",))
            await self._notify_owner(target, reason)

        return strip_block_directives(content).strip(), True

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send a model reply.

        Adapter callers may provide ``metadata["blob"]`` as a complete,
        serialized post-blob entry array. It rides the first chunk, is
        composed before the internal context-lens reference, and must
        accompany non-empty content because the deployed CLI does not support
        blob-only posts.
        """
        metadata = metadata or {}
        content = str(content or "")
        if metadata.get("expect_edits") and ends_with_directive_prefix(content):
            return SendResult(success=False, retryable=False)

        incomplete_stripped = False
        if not metadata.get("expect_edits"):
            content, incomplete_stripped = strip_trailing_directive_prefix(content)

        caller_blob = metadata.get("blob")
        if not (isinstance(caller_blob, str) and caller_blob.strip()):
            # A whitespace-only string is treated as ABSENT, same as None:
            # it never fires the blob-requires-content guard below.
            caller_blob = None

        content, complete_stripped = await self._process_block_directives(
            chat_id, content, reply_to
        )
        directive_syntax_stripped = incomplete_stripped or complete_stripped
        if directive_syntax_stripped:
            content = content.rstrip()

        pending = self._pending_bot_cap_addendum.get(chat_id)
        correlated_pending = (
            pending
            if pending is not None and reply_to == pending[1]
            else None
        )
        if directive_syntax_stripped and not content.strip():
            if caller_blob is None:
                if (
                    correlated_pending is not None
                    and self._pending_bot_cap_addendum.get(chat_id)
                    == correlated_pending
                ):
                    self._pending_bot_cap_addendum.pop(chat_id, None)
                return SendResult(success=True, retryable=False)
            blob_error = (
                "metadata['blob'] requires non-empty content "
                "(no blob-only CLI transport)"
            )
            self._telemetry.record_delivery(chat_id, content=content, success=False)
            self._lens.record_delivery_failure(chat_id, error=blob_error)
            return SendResult(
                success=False,
                message_id=None,
                error=blob_error,
                raw_response={},
                retryable=False,
            )

        addendum = ""
        if correlated_pending is not None:
            addendum = (
                "\n\n---\n_This is my last response to "
                f"{correlated_pending[0]} for now. To continue our conversation, "
                "someone will need to mention me._"
            )
        content += addendum
        if caller_blob is not None and not content.strip():
            blob_error = "metadata['blob'] requires non-empty content (no blob-only CLI transport)"
            self._telemetry.record_delivery(chat_id, content=content, success=False)
            self._lens.record_delivery_failure(chat_id, error=blob_error)
            return SendResult(
                success=False,
                message_id=None,
                error=blob_error,
                raw_response={},
                retryable=False,
            )
        # Core anchors every reply to the triggering message (reply_to), but
        # Tlon conversations are linear: reply top-level unless the
        # conversation is already a thread (metadata.thread_id carries the
        # thread ROOT, which is what Tlon replies must attach to). This holds
        # for both group channels and DMs — DM threads thread too.
        # reply_in_thread=true restores always-thread-on-the-trigger. Gallery
        # posts always anchor reactive replies to the trigger: a new heap post
        # is a separate gallery item, not a conversational reply.
        thread_parent = str(metadata.get("thread_id") or "") or None
        if thread_parent is None and (
            self.tlon_config.reply_in_thread or chat_id.startswith("heap/")
        ):
            # A top-level own-post reaction's `reply_to` is core's generic
            # trigger anchor, i.e. the synthetic `react/<post>/<reactor>/
            # <emoji>` event id — never a real wire post. Recover the actual
            # reacted post recorded by _dispatch_message (I3) so the fallback
            # threads onto something that exists; anything else (an ordinary
            # message's own id) has no entry here and falls through as-is.
            thread_parent = (
                self._reaction_reply_targets.get(reply_to)
                if reply_to
                else None
            ) or reply_to
        is_thread_reply = bool(thread_parent)
        # parentAuthor: honor what Hermes passes. For one-to-one DMs the writ
        # id itself is author-prefixed, so derive that exact prefix when core
        # did not supply metadata (not the partner default the CLI would
        # otherwise assume).
        parent_author = metadata.get("parent_author") or None
        if (
            not parent_author
            and is_thread_reply
            and _is_dm_chat_id(chat_id)
            and "/" in thread_parent
        ):
            parent_author = normalize_ship(thread_parent.split("/", 1)[0])
        # Stamp each delivered chunk with a pointer to its lens run so the
        # client can open the run from the message (badge / message actions),
        # matching OpenClaw. Only when a run is active for this conversation.
        lens_blob = self._lens_reference_blob(chat_id)
        chunks = self._chunk_outbound(content)
        multi = len(chunks) > 1
        message_ids: list[str] = []
        result = None
        for idx, chunk in enumerate(chunks):
            with cli_context("delivery", conversation=chat_id):
                # A caller-provided field describes one logical reply and
                # therefore rides only the first visible chunk. The internal
                # lens reference rides every chunk so each post can open the
                # run that produced it.
                result, sent_at_ms = await self._deliver_post(
                    chat_id,
                    chunk,
                    parent_id=thread_parent if is_thread_reply else None,
                    parent_author=parent_author,
                    blob_fields=(
                        (caller_blob,)
                        if idx == 0 and caller_blob is not None
                        else ()
                    ),
                    lens_blob=lens_blob,
                )
            self._telemetry.record_delivery(
                chat_id, content=chunk, success=result.success
            )
            if not result.success:
                break
            # sent_at_ms is set iff there's an active run to stamp (see above).
            if sent_at_ms is not None:
                self._lens.record_output(
                    chat_id,
                    LensOutput(
                        message_id=format_post_id(self.tlon_config.ship_name, sent_at_ms),
                        conversation_id=chat_id,
                        kind="dm" if normalize_ship(chat_id) == chat_id else "channel",
                        sent_at=sent_at_ms,
                        preview=chunk or None,
                        chunk_index=idx if multi else None,
                    ),
                )
            message_ids.append(str(result.message_id or ""))

        raw_response = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
        if message_ids and not result.success:
            # Partial delivery: some chunks landed before one failed. Report
            # success with what was delivered — a failure here would make the
            # core retry/plain-text-fallback resend the WHOLE payload and
            # duplicate the chunks users already saw.
            logger.error(
                "[tlon] delivered %d/%d chunks to %s before failure: %s",
                len(message_ids),
                len(chunks),
                chat_id,
                result.error,
            )
            self._telemetry.error(
                "send",
                RuntimeError(result.error or "chunked send failed"),
                operation="chunked_delivery",
            )
            # Surface the dropped tail on the lens run (error text, status
            # unchanged) so the owner sees it in the UI, not just in logs.
            live_run = self._lens.get(chat_id)
            if live_run is not None:
                live_run.set_status(
                    live_run.status,
                    error=(
                        f"partial delivery: {len(message_ids)}/{len(chunks)} "
                        f"chunks sent ({result.error or 'send failed'})"
                    ),
                )
        elif not result.success:
            # A produced-but-undelivered reply is a delivery failure, not a
            # no_reply; record it so the run finalizes as an error.
            self._lens.record_delivery_failure(
                chat_id, error=(result.stderr or "").strip() or "delivery failed"
            )
        delivered = bool(message_ids)
        if delivered and is_thread_reply and thread_parent:
            self._participated_threads.add(self._thread_key(chat_id, thread_parent))
        if addendum and (result.success or result.returncode != 124):
            if self._pending_bot_cap_addendum.get(chat_id) == correlated_pending:
                self._pending_bot_cap_addendum.pop(chat_id, None)
        return SendResult(
            success=delivered,
            # Core contract: message_id is the LAST visible chunk (edits
            # target it); earlier chunk ids ride continuation_message_ids.
            message_id=message_ids[-1] if delivered else result.message_id,
            error=None if delivered else result.error,
            raw_response=raw_response,
            retryable=False if delivered else self._send_retryable(result),
            continuation_message_ids=tuple(message_ids[:-1]),
        )

    # Transient network failures from the bun-built tlon CLI, mirroring
    # core's _RETRYABLE_ERROR_PATTERNS. CLI timeouts (returncode 124) are
    # deliberately NOT retryable: the poke may have landed before the kill,
    # so a resend risks a duplicate post (same rule as core's
    # _is_timeout_error).
    _TRANSIENT_SEND_ERRORS = (
        "econnrefused",
        "econnreset",
        "enotfound",
        "eai_again",
        "socket hang up",
        "fetch failed",
        "network",
        "connection refused",
        "connection reset",
        "broken pipe",
    )

    @classmethod
    def _send_retryable(cls, result: Any) -> bool:
        if result.returncode == 124:
            return False
        blob = f"{result.error or ''} {result.stderr or ''}".lower()
        return any(pat in blob for pat in cls._TRANSIENT_SEND_ERRORS)

    def _chunk_outbound(self, content: str) -> list[str]:
        """Split an oversized reply instead of silently truncating it.

        Uses core's code-block-aware truncate_message when running under the
        real BasePlatformAdapter; the plain fallback keeps the adapter usable
        standalone (test stubs).
        """
        if len(content) <= self.MAX_MESSAGE_LENGTH:
            return [content]
        chunker = getattr(self, "truncate_message", None)
        if callable(chunker):
            try:
                chunks = [c for c in chunker(content, self.MAX_MESSAGE_LENGTH) if c]
                if chunks:
                    return chunks
            except Exception as exc:
                logger.warning("[tlon] truncate_message failed, plain split: %s", exc)
        return [
            content[i : i + self.MAX_MESSAGE_LENGTH]
            for i in range(0, len(content), self.MAX_MESSAGE_LENGTH)
        ]

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
    if tlon.reaction_level != "minimal":
        seed["reaction_level"] = tlon.reaction_level
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


def _non_owner_reaction_carveout(args: Optional[dict], config: TlonConfig) -> Optional[str]:
    """Return None only for a narrowly-scoped current-chat reaction command."""
    command = str((args or {}).get("command") or "")
    parsed, parse_error = split_tlon_command(command)
    if parse_error or len(parsed) < 3:
        return "Blocked: non-owner Tlon sessions may only react in the current conversation."
    if any(
        arg in CREDENTIAL_FLAGS_WITH_VALUE
        or any(arg.startswith(f"{flag}=") for flag in CREDENTIAL_FLAGS_WITH_VALUE)
        for arg in parsed
    ):
        return (
            "Blocked: non-owner reactions cannot use credential override flags; "
            "they must use this bot account in the current conversation."
        )
    # Do not use the tool parser's global-flag skipping here: the subcommand
    # must literally be first, preventing a prefix override from authenticating
    # the right-looking target as another account.
    family, action = parsed[0].lower(), parsed[1].lower()
    if family not in {"posts", "dms"} or action not in {"react", "unreact"}:
        return "Blocked: non-owner Tlon sessions may only react in the current conversation."
    if config.reaction_level not in {"minimal", "extensive"}:
        return (
            "Blocked: agent reactions are disabled "
            f'(TLON_REACTION_LEVEL="{config.reaction_level}"). '
            "Set TLON_REACTION_LEVEL to minimal or extensive to enable."
        )
    chat_id = str(_session_env("HERMES_SESSION_CHAT_ID", "")).strip()
    if not chat_id:
        return "Blocked: no current Tlon conversation is available for this reaction."
    expected_family = "dms" if _is_dm_chat_id(chat_id) else "posts"
    if family != expected_family:
        return (
            f"Blocked: use {expected_family} react|unreact for the current "
            f"{'one-to-one DM' if expected_family == 'dms' else 'channel'} conversation."
        )
    target = str(parsed[2] or "").strip()
    if not target or target.casefold() != chat_id.casefold():
        return "Blocked: non-owner reactions may target only the current conversation."
    return None


def block_tlon_session_tool(tool_name: str, args: Optional[dict] = None, **_kwargs: Any) -> Optional[dict]:
    if _session_env("HERMES_SESSION_PLATFORM", "").lower() != "tlon":
        return None

    tool = str(tool_name or "").strip()
    tlon = TlonConfig.from_env()
    owner = tlon.owner_ship
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
        if tool == "tlon":
            parsed, _parse_error = split_tlon_command(
                str((args or {}).get("command") or "")
            )
            reaction_attempt = any(
                parsed[index].lower() in {"posts", "dms"}
                and index + 1 < len(parsed)
                and parsed[index + 1].lower() in {"react", "unreact"}
                for index in range(len(parsed))
            )
            if reaction_attempt:
                reaction_block = _non_owner_reaction_carveout(args, tlon)
                if reaction_block is None:
                    return None
                return _tool_access_block(reaction_block)
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
    del force_document
    if media_files:
        # The standalone/cron send path is text-only (TlonCLI.send_message takes
        # no image argument). Dropping the media and delivering the text alone
        # would report success for a message the recipient never sees in full —
        # the exact fabricated-delivery failure this path must not have.
        return {
            "error": (
                "tlon standalone send: media attachments are not supported on "
                "this path — upload the image with `tlon upload` and send it "
                "with `tlon posts send <target> [caption] --image <url>`"
            )
        }
    extra = getattr(pconfig, "extra", {}) or {}
    tlon = TlonConfig.from_env(extra)
    if not tlon.is_complete():
        return {"error": "tlon standalone send: TLON node URL/id/access code not configured"}
    message = strip_block_directives(message).strip()
    if not message:
        return {
            "success": True,
            "platform": "tlon",
            "chat_id": chat_id,
            "message_id": None,
        }
    cli = TlonCLI(tlon, as_bot=True)
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


def _reaction_platform_hint(level: str) -> str:
    if level == "minimal":
        guidance = (
            "React ONLY when truly relevant: acknowledge important requests or "
            "confirmations, and express genuine sentiment sparingly. Avoid routine "
            "messages and your own replies. Aim for at most one reaction per 5-10 exchanges."
        )
    elif level == "extensive":
        guidance = (
            "Feel free to react liberally when natural: acknowledge messages, express "
            "sentiment and personality, react to interesting content or humor, and confirm "
            "understanding or agreement."
        )
    else:
        return ""
    return (
        f" Reactions are enabled for Tlon in {level.upper()} mode. {guidance} "
        "Message ids and thread roots appear in […] markers. For channels use "
        "'posts react <nest> <post-id> \"<emoji>\"'; for one-to-one DMs use "
        "'dms react <ship> <message-id> \"<emoji>\"'. For a thread reply add "
        "'--parent <thread-root-id>'; use unreact to remove your reaction. Non-owner "
        "sessions may react only in the current conversation."
    )


def register(ctx) -> None:
    ctx.register_hook("pre_tool_call", handle_pre_tool_call)
    ctx.register_hook("pre_tool_call", handle_pre_tool_call_lens)
    ctx.register_hook("pre_tool_call", block_tlon_session_tool)
    ctx.register_hook("post_api_request", handle_post_api_request)
    ctx.register_hook("post_api_request", handle_post_api_request_telemetry)
    ctx.register_hook("post_api_request", handle_post_api_request_lens)
    ctx.register_hook("post_tool_call", handle_post_tool_call_telemetry)
    ctx.register_hook("post_tool_call", handle_post_tool_call_lens)

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

    # Registered separately from the CLI skill above, not merged into it: this
    # one carries no commands and answers "what is Tlon Messenger / how does
    # this feature work", so it has to be selectable on its own. It ships in
    # the OpenClaw plugin tree, which a Hermes deployment may not have — hence
    # the None check rather than a hard requirement.
    product_guide_path = resolve_tlon_product_guide_path()
    if product_guide_path is not None:
        ctx.register_skill(
            "tlon-product-guide",
            product_guide_path,
            description=(
                "Tlon Messenger product guide: what Tlon, Urbit, Tlon Messenger "
                "and Tlonbot are, how features work, and how to walk a user "
                "through a task in the app."
            ),
        )

    # Derived from the registration above rather than written into the hint
    # unconditionally: a deployment without the plugin tree registers no such
    # skill, and pointing the model at a skill_view that cannot resolve turns
    # every product question into a failed tool call.
    product_guide_hint = (
        "When the user asks what Tlon Messenger is or how one of its features "
        "works, rather than asking you to do something, load "
        'skill_view("tlon-platform:tlon-product-guide") and answer from it. '
        if product_guide_path is not None
        else ""
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
            + product_guide_hint
            + "When a user asks you to create a Tlon group for them, use "
            "groups create-owned with --owner set to that user's ship so they "
            "are invited and made admin. "
            "To reply to the current conversation, just write your reply and "
            "Hermes delivers it. To post somewhere else (e.g. a channel of a "
            "group you host or a one-to-one DM), use the tlon tool's posts "
            "send with that target; reserve dms send for group-DM club IDs "
            "starting with 0v. Sending plain text to the current conversation "
            "that way is blocked, except that posts send heap/~host/name creates "
            "a new top-level gallery item. Galleries use heap/~host/name. Reply "
            "normally in a gallery to comment on the triggering post; posts send "
            "heap/~host/name \"text or URL\" creates a new top-level item and is "
            "allowed even in the current gallery (optional --title \"...\"). React "
            "to a gallery comment with posts react heap/~host/name <comment-id> "
            "<emoji> --parent <post-id>; delete with posts delete heap/~host/name "
            "<post-id>. To send an image anywhere — including the "
            "current conversation — first 'tlon upload <direct-image-url>', then "
            "'tlon posts send <target> [caption] --image <uploaded-url>'. "
            "--image takes only a public https URL (upload itself also accepts "
            "local paths and http sources); never claim an image was posted "
            "unless every command returned success — if upload reports the ship "
            "cannot store uploads, pass the direct https image URL to --image "
            "instead. "
            "The platform adapter directly handles owner chat commands for "
            "access and configuration: /owner-listen (no-mention listening), "
            "/channel-access (per-channel open access), /pending, /allow, "
            "/reject, /ban, /unban, /banned (approvals for unknown ships), "
            "and /tlon (version, status storage, status telemetry, status "
            "binary — debug info). Point the owner at those commands when asked "
            "rather than changing configuration yourself. "
            "Use concise plain text and basic markdown. Never use LaTeX math "
            "delimiters ($...$, $$...$$, \\(...\\), \\[...\\]) in note bodies "
            "or message text — Tlon renders no math; write math as plain "
            "text/Unicode or in code blocks."
            + _reaction_platform_hint(TlonConfig.from_env().reaction_level)
        ),
    )
