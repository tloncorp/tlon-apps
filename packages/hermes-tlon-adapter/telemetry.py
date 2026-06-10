"""PostHog telemetry for the Hermes Tlon adapter.

Ports the OpenClaw plugin's "TlonBot Reply Handled" event (same Title Case
name and property names so existing dashboards keep working) and adds the
coverage it lacked: per-CLI-call events, error events, and gateway lifecycle
events. Every event carries ``harness: "hermes"`` so dashboards can segment
Hermes-emitted events from OpenClaw-emitted ones, plus the adapter version
identity so anomalies map to the exact code that produced them.

Strictly opt-in (``TLON_TELEMETRY=true`` + ``TLON_TELEMETRY_API_KEY``), and
strictly content-free: no message text, no CLI arguments, no channel nests;
ship ids are scrubbed from error detail. Uses the official ``posthog`` SDK,
whose worker thread owns batching and delivery — ``capture`` only enqueues,
so emits never block the event loop. All emit paths swallow their own errors;
telemetry must never break messaging.
"""

from __future__ import annotations

import logging
import os
import re
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Optional, Sequence

from .tlon_api import TlonConfig, TlonSendResult

logger = logging.getLogger(__name__)

EVENT_REPLY_HANDLED = "TlonBot Reply Handled"
EVENT_CLI_CALL = "TlonBot CLI Call"
EVENT_ERROR = "TlonBot Error"
EVENT_GATEWAY_CONNECTED = "TlonBot Gateway Connected"
EVENT_GATEWAY_DISCONNECTED = "TlonBot Gateway Disconnected"
EVENT_SSE_RECONNECT = "TlonBot SSE Reconnect"
EVENT_APPROVAL = "TlonBot Approval Event"
EVENT_CONTROL_COMMAND = "TlonBot Control Command"

HARNESS = "hermes"

# Message-send plumbing: ordinary replies, control-command replies, and owner
# notifications go through the CLI but are not "CLI use" — replies are already
# represented in "TlonBot Reply Handled". Suppressed when successful; failures
# still emit so delivery problems stay visible.
PLUMBING_ORIGINS = frozenset({"delivery", "control_plane", "owner_notification"})

REPLY_TRACE_TTL_SECONDS = 60 * 60
MAX_REPLY_TRACES = 50
MAX_CALLS_PER_TRACE = 200
ERROR_DETAIL_MAX_CHARS = 200

_SHIP_RE = re.compile(r"~[a-zA-Z0-9.\-]+")


def scrub_detail(text: Any, max_chars: int = ERROR_DETAIL_MAX_CHARS) -> str:
    """First line only, ship ids masked, truncated."""
    first_line = str(text or "").strip().splitlines()[0] if str(text or "").strip() else ""
    masked = _SHIP_RE.sub("~…", first_line)
    if len(masked) > max_chars:
        masked = masked[: max_chars - 1].rstrip() + "…"
    return masked


_ACTION_WORD_RE = re.compile(r"[a-z][a-z-]*")


def cli_command_parts(args: Sequence[str]) -> dict[str, Any]:
    """Structured, argument-free breakdown of a CLI invocation.

    ``commandRoot`` is the top-level subcommand ("groups"), ``commandAction``
    its action word ("create-owned"), ``commandFlags`` the flag names used
    (never their values), and ``command`` the combined label for grouping.
    """
    from .tlon_tool import find_subcommand_index

    parts = [str(arg) for arg in args]
    sub_idx = find_subcommand_index(parts)
    root = parts[sub_idx].lower() if sub_idx >= 0 else "unknown"
    action = ""
    if (
        sub_idx >= 0
        and not root.startswith("-")
        and len(parts) > sub_idx + 1
        and not parts[sub_idx + 1].startswith("-")
    ):
        candidate = parts[sub_idx + 1].lower()
        # Only keep action words, not positional values like ships or nests.
        if _ACTION_WORD_RE.fullmatch(candidate):
            action = candidate

    flags: list[str] = []
    for part in parts:
        if part.startswith("--"):
            name = part.split("=", 1)[0]
            if name != root and name not in flags:
                flags.append(name)

    return {
        "command": f"{root} {action}".strip() if root != "unknown" else "unknown",
        "commandRoot": root,
        "commandAction": action or None,
        "commandFlags": sorted(flags),
    }


def cli_command_label(args: Sequence[str]) -> str:
    """Subcommand plus action only (e.g. "posts send") — never arguments."""
    return str(cli_command_parts(args)["command"])


def cli_error_kind(result: TlonSendResult) -> str:
    if result.success:
        return ""
    if result.returncode == 124:
        return "timeout"
    if result.returncode == 127:
        return "not_found"
    return "nonzero"


@dataclass(frozen=True)
class CliContext:
    origin: str = "adapter"
    conversation: str = ""


_cli_context: ContextVar[CliContext] = ContextVar(
    "tlon_cli_context", default=CliContext()
)


@contextmanager
def cli_context(origin: str, conversation: str = ""):
    """Tag TlonCLI calls made inside the block with an origin (and optionally
    the conversation whose reply trace should absorb them)."""
    token = _cli_context.set(CliContext(origin=origin, conversation=conversation))
    try:
        yield
    finally:
        _cli_context.reset(token)


def _summary(calls: list[dict[str, Any]], name_key: str) -> dict[str, Any]:
    return {
        "calls": list(calls),
        "names": [call[name_key] for call in calls],
        "totalDurationMs": sum(call.get("durationMs") or 0 for call in calls),
        "errorCount": sum(1 for call in calls if call.get("error")),
    }


@dataclass
class _ReplyTrace:
    started_monotonic: float
    chat_type: str
    is_thread: bool
    sender_role: str
    dispatch_reason: str
    created_at: float = field(default_factory=time.time)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    cli_calls: list[dict[str, Any]] = field(default_factory=list)
    delivered_count: int = 0
    char_count: int = 0
    word_count: int = 0
    send_error: bool = False
    model: Optional[str] = None
    provider: Optional[str] = None


def _create_posthog_client(api_key: str, host: str):
    from posthog import Posthog

    kwargs: dict[str, Any] = {"disable_geoip": True}
    if host:
        kwargs["host"] = host
    return Posthog(api_key, **kwargs)


class TlonTelemetry:
    def __init__(
        self,
        config: TlonConfig,
        *,
        client_factory: Callable[[str, str], Any] = _create_posthog_client,
    ) -> None:
        self.config = config
        self._client: Any = None
        self._common: dict[str, Any] = {
            "harness": HARNESS,
            "botShip": config.ship_name,
            "ownerShip": config.owner_ship or None,
        }
        self._traces: dict[str, _ReplyTrace] = {}
        self._capture_warned = False
        self._missing_owner_warned = False
        self._identified = False

        if not (config.telemetry_enabled and config.telemetry_api_key.strip()):
            return
        try:
            self._client = client_factory(
                config.telemetry_api_key.strip(), config.telemetry_host.strip()
            )
            logger.info("[tlon] telemetry enabled (PostHog)")
        except Exception as exc:
            logger.warning("[tlon] telemetry disabled: PostHog client unavailable: %s", exc)
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def set_common(self, props: Mapping[str, Any]) -> None:
        """Merge identity properties stamped on every event (version info)."""
        self._common.update(props)

    def capture(self, event: str, properties: Optional[Mapping[str, Any]] = None) -> None:
        """Capture an event against the owner's PostHog person.

        Mirrors OpenClaw: the owner ship is the distinct id (so bot events
        join the owner's app-side identity), and telemetry is skipped entirely
        when no owner is configured.
        """
        if self._client is None:
            return
        owner = self.config.owner_ship
        if not owner:
            if not self._missing_owner_warned:
                self._missing_owner_warned = True
                logger.warning(
                    "[tlon] telemetry is enabled but TLON_OWNER_SHIP is not "
                    "configured; skipping telemetry events"
                )
            return
        try:
            self._ensure_identified(owner)
            props = dict(self._common)
            if properties:
                props.update(properties)
            self._client.capture(
                distinct_id=owner,
                event=event,
                properties=props,
            )
        except Exception as exc:
            if not self._capture_warned:
                self._capture_warned = True
                logger.warning("[tlon] telemetry capture failed (first occurrence): %s", exc)
            else:
                logger.debug("[tlon] telemetry capture failed: %s", exc)

    def _ensure_identified(self, owner: str) -> None:
        """One-time identify so the owner person carries bot attributes."""
        if self._identified:
            return
        self._identified = True
        identify = getattr(self._client, "identify", None)
        if identify is None:
            return
        try:
            identify(
                distinct_id=owner,
                properties={
                    "harness": HARNESS,
                    "tlonOwnerShip": owner,
                    "tlonBotShip": self.config.ship_name,
                },
            )
        except Exception as exc:
            logger.debug("[tlon] telemetry identify failed: %s", exc)

    def flush(self) -> None:
        """Push pending events; keeps the client usable across reconnects."""
        self._traces.clear()
        if self._client is None:
            return
        try:
            self._client.flush()
        except Exception as exc:
            logger.debug("[tlon] telemetry flush failed: %s", exc)

    def close(self) -> None:
        self._traces.clear()
        client, self._client = self._client, None
        if client is None:
            return
        try:
            client.flush()
            client.shutdown()
        except Exception as exc:
            logger.debug("[tlon] telemetry shutdown failed: %s", exc)

    # ── reply traces ─────────────────────────────────────────────────────

    def start_reply(
        self,
        conversation_id: str,
        *,
        chat_type: str,
        is_thread: bool,
        sender_role: str,
        dispatch_reason: str,
    ) -> None:
        if not self.enabled or not conversation_id:
            return
        self._prune_traces()
        self._traces[conversation_id] = _ReplyTrace(
            started_monotonic=time.monotonic(),
            chat_type=chat_type,
            is_thread=is_thread,
            sender_role=sender_role,
            dispatch_reason=dispatch_reason,
        )

    def record_tool_call(
        self,
        conversation_id: str,
        *,
        tool_name: str,
        duration_ms: Optional[int] = None,
        error: Optional[str] = None,
    ) -> None:
        trace = self._traces.get(conversation_id)
        if trace is None or len(trace.tool_calls) >= MAX_CALLS_PER_TRACE:
            return
        trace.tool_calls.append(
            {
                "toolName": str(tool_name or "unknown"),
                "durationMs": duration_ms,
                "error": error or None,
            }
        )

    def record_api_request(
        self,
        conversation_id: str,
        *,
        model: Optional[str],
        provider: Optional[str],
    ) -> None:
        trace = self._traces.get(conversation_id)
        if trace is None:
            return
        trace.model = model or trace.model
        trace.provider = provider or trace.provider

    def record_delivery(
        self,
        conversation_id: str,
        *,
        content: str,
        success: bool,
    ) -> None:
        trace = self._traces.get(conversation_id)
        if trace is None:
            return
        if success:
            trace.delivered_count += 1
            trace.char_count += len(content)
            trace.word_count += len(content.split())
        else:
            trace.send_error = True

    def finish_reply(
        self,
        conversation_id: str,
        *,
        processing_outcome: Optional[str] = None,
    ) -> None:
        trace = self._traces.pop(conversation_id, None)
        if trace is None or not self.enabled:
            return
        self._emit_reply(trace, processing_outcome=processing_outcome)

    def _emit_reply(
        self,
        trace: _ReplyTrace,
        *,
        processing_outcome: Optional[str] = None,
        abandoned: bool = False,
    ) -> None:
        if abandoned:
            # The turn never reached on_processing_complete — hung or crashed
            # without a lifecycle callback. Surfaced rather than silently pruned.
            outcome = "abandoned"
        elif trace.delivered_count > 0:
            outcome = "responded"
        elif processing_outcome == "failure" or trace.send_error:
            outcome = "error"
        elif processing_outcome == "cancelled":
            outcome = "cancelled"
        else:
            outcome = "no_reply"
        self.capture(
            EVENT_REPLY_HANDLED,
            {
                "outcome": outcome,
                "processingOutcome": processing_outcome,
                "chatType": trace.chat_type,
                "isThreadReply": trace.is_thread,
                "senderRole": trace.sender_role,
                "dispatchReason": trace.dispatch_reason,
                "deliveredMessageCount": trace.delivered_count,
                "replyCharCount": trace.char_count,
                "replyWordCount": trace.word_count,
                "dispatchDurationMs": int(
                    (time.monotonic() - trace.started_monotonic) * 1000
                ),
                "provider": trace.provider,
                "model": trace.model,
                "toolUsage": _summary(trace.tool_calls, "toolName"),
                "cliUsage": _summary(trace.cli_calls, "command"),
            },
        )

    def _prune_traces(self) -> None:
        now = time.time()
        stale = [
            key
            for key, trace in self._traces.items()
            if now - trace.created_at > REPLY_TRACE_TTL_SECONDS
        ]
        for key in stale:
            trace = self._traces.pop(key, None)
            if trace is not None:
                self._emit_reply(trace, abandoned=True)
        while len(self._traces) >= MAX_REPLY_TRACES:
            trace = self._traces.pop(next(iter(self._traces)))
            self._emit_reply(trace, abandoned=True)

    # ── CLI observation ──────────────────────────────────────────────────

    def observe_cli(
        self,
        args: Sequence[str],
        duration_ms: int,
        result: TlonSendResult,
    ) -> None:
        """TlonCLI observer: one event per CLI invocation, plus trace rollup."""
        if not self.enabled:
            return
        context = _cli_context.get()
        if context.origin in PLUMBING_ORIGINS and result.success:
            return
        parts = cli_command_parts(args)
        error_kind = cli_error_kind(result)
        self.capture(
            EVENT_CLI_CALL,
            {
                **parts,
                "origin": context.origin,
                "durationMs": duration_ms,
                "success": result.success,
                "returncode": result.returncode,
                "errorKind": error_kind or None,
            },
        )
        conversation = context.conversation
        trace = self._traces.get(conversation) if conversation else None
        if trace is not None and len(trace.cli_calls) < MAX_CALLS_PER_TRACE:
            trace.cli_calls.append(
                {
                    "command": parts["command"],
                    "durationMs": duration_ms,
                    "error": error_kind or None,
                }
            )

    # ── discrete events ──────────────────────────────────────────────────

    def gateway_connected(self, properties: Mapping[str, Any]) -> None:
        self.capture(EVENT_GATEWAY_CONNECTED, properties)

    def gateway_disconnected(self, *, uptime_seconds: int, reason: str) -> None:
        self.capture(
            EVENT_GATEWAY_DISCONNECTED,
            {"uptimeSeconds": uptime_seconds, "reason": reason},
        )

    def sse_reconnect(self, *, attempt: int, delay_seconds: float, error: Any) -> None:
        self.capture(
            EVENT_SSE_RECONNECT,
            {
                "attempt": attempt,
                "delaySeconds": delay_seconds,
                "errorType": type(error).__name__ if error is not None else None,
                "detail": scrub_detail(error),
            },
        )

    def error(self, component: str, error: Any, **context: Any) -> None:
        self.capture(
            EVENT_ERROR,
            {
                "component": component,
                "errorType": type(error).__name__
                if isinstance(error, BaseException)
                else "error",
                "detail": scrub_detail(error),
                **context,
            },
        )

    def approval_event(self, action: str, request_type: str) -> None:
        self.capture(
            EVENT_APPROVAL, {"action": action, "requestType": request_type}
        )

    def control_command(self, command: str) -> None:
        self.capture(EVENT_CONTROL_COMMAND, {"command": command})


# ── active instance + hook handlers ─────────────────────────────────────

_active_telemetry: Optional[TlonTelemetry] = None


def set_active_telemetry(telemetry: TlonTelemetry) -> None:
    global _active_telemetry
    _active_telemetry = telemetry


def clear_active_telemetry(telemetry: TlonTelemetry) -> None:
    global _active_telemetry
    if _active_telemetry is telemetry:
        _active_telemetry = None


def get_active_telemetry() -> Optional[TlonTelemetry]:
    return _active_telemetry


def _session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def _tlon_session_conversation(kwargs: Mapping[str, Any]) -> Optional[str]:
    platform = str(
        kwargs.get("platform") or _session_env("HERMES_SESSION_PLATFORM", "")
    ).lower()
    if platform != "tlon":
        return None
    conversation = str(_session_env("HERMES_SESSION_CHAT_ID", "") or "").strip()
    return conversation or None


def handle_post_tool_call_telemetry(**kwargs: Any) -> None:
    telemetry = get_active_telemetry()
    if telemetry is None or not telemetry.enabled:
        return
    conversation = _tlon_session_conversation(kwargs)
    if conversation is None:
        return
    status = str(kwargs.get("status") or "").lower()
    error = str(kwargs.get("error_type") or "") if status not in ("", "ok") else ""
    try:
        duration_ms = int(kwargs.get("duration_ms") or 0)
    except (TypeError, ValueError):
        duration_ms = 0
    telemetry.record_tool_call(
        conversation,
        tool_name=str(kwargs.get("tool_name") or "unknown"),
        duration_ms=duration_ms,
        error=error or None,
    )


def handle_post_api_request_telemetry(**kwargs: Any) -> None:
    telemetry = get_active_telemetry()
    if telemetry is None or not telemetry.enabled:
        return
    conversation = _tlon_session_conversation(kwargs)
    if conversation is None:
        return
    telemetry.record_api_request(
        conversation,
        model=str(kwargs.get("model") or "") or None,
        provider=str(kwargs.get("provider") or "") or None,
    )
