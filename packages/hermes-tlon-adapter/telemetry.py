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

Debuggability: the constructor always logs the resolved telemetry state
(enabled, or disabled with the precise reason), the SDK's ``on_error`` hook
surfaces delivery failures that its worker thread would otherwise swallow,
``TLON_TELEMETRY_DEBUG=true`` turns on per-event and SDK-internal logging,
and the owner-only ``/tlon status telemetry`` chat command reports live status
(``/tlon status telemetry test`` does a synchronous round trip to PostHog).
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
EVENT_TELEMETRY_TEST = "TlonBot Telemetry Test"
EVENT_HEARTBEAT_NUDGE_SENT = "TlonBot Heartbeat Nudge Sent"
EVENT_HEARTBEAT_NUDGE_REENGAGED = "TlonBot Heartbeat Nudge Reengaged"

HARNESS = "hermes"

# The posthog SDK's default ingestion host, shown when no override is set.
DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

# Message-send plumbing: ordinary replies, control-command replies, and owner
# notifications go through the CLI but are not "CLI use" — replies are already
# represented in "TlonBot Reply Handled". Suppressed when successful; failures
# still emit so delivery problems stay visible.
PLUMBING_ORIGINS = frozenset({"delivery", "control_plane", "owner_notification"})

REPLY_TRACE_TTL_SECONDS = 60 * 60
MAX_REPLY_TRACES = 50
MAX_CALLS_PER_TRACE = 200
ERROR_DETAIL_MAX_CHARS = 200
# Full multi-line errors (e.g. CLI stderr) get a generous cap — big enough that
# a real error + stack is never truncated, bounded only against pathological
# output bloating the PostHog event.
ERROR_DETAIL_FULL_MAX_CHARS = 8000

_SHIP_RE = re.compile(r"~[a-zA-Z0-9.\-]+")


def scrub_detail(text: Any, max_chars: int = ERROR_DETAIL_MAX_CHARS) -> str:
    """First line only, ship ids masked, truncated. For short summaries."""
    first_line = str(text or "").strip().splitlines()[0] if str(text or "").strip() else ""
    masked = _SHIP_RE.sub("~…", first_line)
    if len(masked) > max_chars:
        masked = masked[: max_chars - 1].rstrip() + "…"
    return masked


def scrub_full(text: Any, max_chars: int = ERROR_DETAIL_FULL_MAX_CHARS) -> str:
    """The complete message — all lines preserved, ship ids masked, capped only
    against pathological sizes. Use when the full error context matters (CLI
    stderr) rather than a one-line summary."""
    masked = _SHIP_RE.sub("~…", str(text or "").strip())
    if len(masked) > max_chars:
        masked = masked[: max_chars - 1].rstrip() + "…"
    return masked


def scrub_error(error: Any) -> str:
    """``Type: detail`` for exceptions, scrubbed like any other detail."""
    if isinstance(error, BaseException):
        return scrub_detail(f"{type(error).__name__}: {error}")
    return scrub_detail(error)


def mask_api_key(key: str) -> str:
    """Identify a key without disclosing it: edges + length only."""
    key = str(key or "").strip()
    if not key:
        return "not set"
    if len(key) <= 8:
        return f"set ({len(key)} chars)"
    return f"{key[:4]}…{key[-4:]} ({len(key)} chars)"


# Mirrors the (env names, config-extra keys) lookup order in
# TlonConfig.from_env so the status report can say where a value came from.
_CONFIG_SOURCE_NAMES: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "telemetry": (("TLON_TELEMETRY",), ("telemetry", "telemetry_enabled")),
    "api_key": (("TLON_TELEMETRY_API_KEY",), ("telemetry_api_key",)),
    "host": (("TLON_TELEMETRY_HOST",), ("telemetry_host",)),
    "debug": (("TLON_TELEMETRY_DEBUG",), ("telemetry_debug",)),
    "owner": (("TLON_OWNER_SHIP", "TLON_OWNER"), ("owner_ship", "owner")),
}


def config_source(
    setting: str,
    extra: Optional[Mapping[str, Any]] = None,
    env: Optional[Mapping[str, Any]] = None,
) -> str:
    """Where a telemetry setting was resolved from: env var, plugin config, or unset."""
    env = os.environ if env is None else env
    extra = extra or {}
    env_names, extra_names = _CONFIG_SOURCE_NAMES[setting]
    for name in env_names:
        value = env.get(name)
        if value is not None and str(value).strip():
            return f"env {name}"
    for name in extra_names:
        if name not in extra:
            continue
        value = extra.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        return f"config {name}"
    return "unset"


def posthog_sdk_status() -> str:
    """Installed posthog SDK version, or why it cannot be imported."""
    try:
        import posthog  # noqa: F401
    except Exception as exc:
        return f"not importable ({type(exc).__name__}: {exc})"
    try:
        from importlib import metadata

        return metadata.version("posthog")
    except Exception:
        return "installed (version unknown)"


def _ago(timestamp: float) -> str:
    delta = max(0, int(time.time() - timestamp))
    if delta < 60:
        return f"{delta}s ago"
    if delta < 3600:
        return f"{delta // 60}m ago"
    return f"{delta // 3600}h ago"


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


def _create_posthog_client(
    api_key: str,
    host: str,
    *,
    debug: bool = False,
    on_error: Optional[Callable[..., None]] = None,
):
    from posthog import Posthog

    kwargs: dict[str, Any] = {"disable_geoip": True}
    if host:
        kwargs["host"] = host
    if debug:
        kwargs["debug"] = True
    if on_error is not None:
        kwargs["on_error"] = on_error
    return Posthog(api_key, **kwargs)


class TlonTelemetry:
    def __init__(
        self,
        config: TlonConfig,
        *,
        extra: Optional[Mapping[str, Any]] = None,
        client_factory: Optional[Callable[[str, str], Any]] = None,
    ) -> None:
        self.config = config
        self.debug = config.telemetry_debug
        self.disabled_reason: Optional[str] = None
        self._extra: dict[str, Any] = dict(extra or {})
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
        self._identified_owners: set[str] = set()
        self._identified_as = ""
        self._events_captured = 0
        self._last_event = ""
        self._last_event_at = 0.0
        self._last_capture_error = ""
        self._last_capture_error_at = 0.0
        self._delivery_failures = 0
        self._last_delivery_error = ""
        self._last_delivery_error_at = 0.0

        api_key = config.telemetry_api_key.strip()
        if not config.telemetry_enabled:
            self.disabled_reason = (
                "TLON_TELEMETRY is not enabled (set TLON_TELEMETRY=true and "
                "TLON_TELEMETRY_API_KEY to opt in)"
            )
        elif not api_key:
            self.disabled_reason = (
                "TLON_TELEMETRY=true but TLON_TELEMETRY_API_KEY is not set"
            )
        else:
            if client_factory is None:
                client_factory = lambda key, host: _create_posthog_client(  # noqa: E731
                    key,
                    host,
                    debug=self.debug,
                    on_error=self._record_delivery_error,
                )
            try:
                self._client = client_factory(api_key, config.telemetry_host.strip())
            except Exception as exc:
                self.disabled_reason = (
                    f"PostHog client init failed: {exc} "
                    "(is the posthog package installed?)"
                )

        if self._client is None:
            # A simply-off default is INFO (most deployments never opt in, and
            # the gateway console shows WARNING+ only). But if telemetry was
            # explicitly requested and still can't run — missing key, posthog
            # not installed — that's a misconfiguration the operator needs to
            # see on a default console, so escalate to WARNING.
            level = logging.WARNING if config.telemetry_enabled else logging.INFO
            logger.log(level, "[tlon] telemetry disabled: %s", self.disabled_reason)
            return
        logger.info(
            "[tlon] telemetry enabled (PostHog): key %s, host %s, "
            "events identify as owner %s (bot %s), debug %s",
            mask_api_key(api_key),
            config.telemetry_host.strip() or f"default ({DEFAULT_POSTHOG_HOST})",
            config.owner_ship or "<missing>",
            config.ship_name,
            "on" if self.debug else "off",
        )
        if not config.owner_ship:
            self._missing_owner_warned = True
            logger.warning(
                "[tlon] telemetry is enabled but TLON_OWNER_SHIP is not "
                "configured; every telemetry event will be skipped"
            )

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def set_common(self, props: Mapping[str, Any]) -> None:
        """Merge identity properties stamped on every event (version info)."""
        self._common.update(props)

    def capture(
        self,
        event: str,
        properties: Optional[Mapping[str, Any]] = None,
        *,
        distinct_id: Optional[str] = None,
    ) -> None:
        """Capture an event against the owner's PostHog person.

        Mirrors OpenClaw: the owner ship is the distinct id (so bot events
        join the owner's app-side identity), and telemetry is skipped entirely
        when no owner is configured.
        """
        if self._client is None:
            return
        # An empty per-event override is meaningful: OpenClaw drops it rather
        # than attributing the event to the currently configured owner.
        owner = self.config.owner_ship if distinct_id is None else distinct_id
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
            self._events_captured += 1
            self._last_event = event
            self._last_event_at = time.time()
            if self._events_captured == 1 or self.debug:
                logger.info(
                    "[tlon] telemetry%s event enqueued: %s (distinct_id=%s)",
                    " first" if self._events_captured == 1 else "",
                    event,
                    owner,
                )
        except Exception as exc:
            self._last_capture_error = scrub_error(exc)
            self._last_capture_error_at = time.time()
            if not self._capture_warned:
                self._capture_warned = True
                logger.warning("[tlon] telemetry capture failed (first occurrence): %s", exc)
            else:
                logger.debug("[tlon] telemetry capture failed: %s", exc)

    def _ensure_identified(self, owner: str) -> None:
        """One-time identify so the owner person carries bot attributes."""
        if owner in self._identified_owners:
            return
        self._identified = True
        props = {
            "harness": HARNESS,
            "tlonOwnerShip": owner,
            "tlonBotShip": self.config.ship_name,
        }
        identify = getattr(self._client, "identify", None)
        setter = getattr(self._client, "set", None)
        try:
            if identify is not None:
                identify(distinct_id=owner, properties=props)
                method = "identify"
            elif setter is not None:
                # posthog-python >= 7 removed identify(); set() enqueues the
                # equivalent $set event for person properties.
                setter(distinct_id=owner, properties=props)
                method = "$set"
            else:
                logger.warning(
                    "[tlon] telemetry identify unavailable: posthog client has "
                    "neither identify() nor set()"
                )
                return
            self._identified_as = owner
            self._identified_owners.add(owner)
            logger.info(
                "[tlon] telemetry identify enqueued (%s): owner %s (bot %s)",
                method,
                owner,
                self.config.ship_name,
            )
        except Exception as exc:
            logger.warning("[tlon] telemetry identify failed: %s", exc)

    def _record_delivery_error(self, error: Any, batch: Any = None) -> None:
        """posthog ``on_error`` hook, called from the SDK's worker thread when
        a batch upload fails after retries — without this those failures are
        completely silent and "telemetry is on but nothing arrives" is
        undiagnosable."""
        self._delivery_failures += 1
        self._last_delivery_error = scrub_error(error)
        self._last_delivery_error_at = time.time()
        batch_size = len(batch) if isinstance(batch, (list, tuple)) else None
        suffix = f" ({batch_size} events dropped)" if batch_size else ""
        if self._delivery_failures == 1 or self.debug:
            logger.warning(
                "[tlon] telemetry delivery to PostHog failed%s: %s", suffix, error
            )
        else:
            logger.debug(
                "[tlon] telemetry delivery to PostHog failed%s: %s", suffix, error
            )

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
        properties: dict[str, Any] = {
            **parts,
            "origin": context.origin,
            "durationMs": duration_ms,
            "success": result.success,
            "returncode": result.returncode,
            "errorKind": error_kind or None,
        }
        if not result.success and result.error:
            # The CLI's FULL stderr (all lines, ship-masked) — e.g. why an
            # upload failed. Capture everything; a one-line summary kept hiding
            # the real error behind the CLI's auth-note preamble.
            properties["errorDetail"] = scrub_full(result.error)
        self.capture(EVENT_CLI_CALL, properties)
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

    def sse_reconnect(self, *, attempt: int, delay_seconds: float, error: Any, mode: str = "rebuild") -> None:
        self.capture(
            EVENT_SSE_RECONNECT,
            {
                "attempt": attempt,
                "delaySeconds": delay_seconds,
                "errorType": type(error).__name__ if error is not None else None,
                "detail": scrub_detail(error),
                "mode": mode,
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

    def nudge_sent(
        self,
        *,
        stage: int,
        target: str,
        success: bool,
        message_id: Optional[str],
        sent_at_ms: Optional[int],
    ) -> None:
        self.capture(
            EVENT_HEARTBEAT_NUDGE_SENT,
            {
                "trigger": "heartbeat",
                "nudgeStage": stage,
                "nudgeTarget": target,
                "channel": "tlon",
                "success": success,
                "accountId": "hermes",
                "messageId": message_id,
                "nudgeSentAtMs": sent_at_ms,
            },
        )

    def nudge_reengaged(
        self,
        *,
        stage: int,
        nudge_sent_at: float,
        reengaged_at: int,
        account_id: str,
        owner_ship: str,
    ) -> None:
        self.capture(
            EVENT_HEARTBEAT_NUDGE_REENGAGED,
            {
                "nudgeStage": stage,
                "nudgeSentAt": nudge_sent_at,
                "reengagedAt": reengaged_at,
                "reengagementDelayMs": reengaged_at - nudge_sent_at,
                "channel": "tlon",
                "accountId": account_id,
                "ownerShip": owner_ship,
            },
            distinct_id=owner_ship,
        )

    # ── diagnostics ──────────────────────────────────────────────────────

    def status_report(self) -> str:
        """Field-per-line live status for logs and /tlon status telemetry."""

        def with_source(value: str, setting: str) -> str:
            source = config_source(setting, self._extra)
            return value if source == "unset" else f"{value} ({source})"

        owner = self.config.owner_ship
        if self._client is None:
            state = f"disabled — {self.disabled_reason}"
        elif not owner:
            state = (
                "enabled but BLOCKED — TLON_OWNER_SHIP is not set, so every "
                "event is skipped (events need a distinct id)"
            )
        else:
            state = "enabled"

        lines = [
            f"Telemetry: {state}",
            "Enabled flag: "
            + with_source(str(self.config.telemetry_enabled).lower(), "telemetry"),
            "API key: " + with_source(mask_api_key(self.config.telemetry_api_key), "api_key"),
            "Host: "
            + (
                with_source(self.config.telemetry_host.strip(), "host")
                if self.config.telemetry_host.strip()
                else f"default ({DEFAULT_POSTHOG_HOST})"
            ),
            f"PostHog SDK: {posthog_sdk_status()}",
            "Distinct id: "
            + (
                f"{owner} (owner ship"
                + (
                    f", {config_source('owner', self._extra)}"
                    if config_source("owner", self._extra) != "unset"
                    else ""
                )
                + ")"
                if owner
                else "missing — set TLON_OWNER_SHIP"
            ),
            f"Bot ship: {self.config.ship_name or 'missing'}",
            "Identify: "
            + (
                f"enqueued as {self._identified_as}"
                if self._identified_as
                else (
                    "attempted but failed or unavailable (see gateway logs)"
                    if self._identified
                    else "not yet (sent with the first event)"
                )
            ),
            "Events enqueued: "
            + (
                f"{self._events_captured} since gateway start "
                f"(last: {self._last_event}, {_ago(self._last_event_at)})"
                if self._events_captured
                else "none since gateway start"
            ),
        ]
        if self._last_capture_error:
            lines.append(
                f"Capture errors: {self._last_capture_error} "
                f"({_ago(self._last_capture_error_at)})"
            )
        lines.append(
            "Delivery: "
            + (
                f"{self._delivery_failures} failed batches "
                f"(last: {self._last_delivery_error}, "
                f"{_ago(self._last_delivery_error_at)})"
                if self._delivery_failures
                else "no failed batches observed"
            )
        )
        lines.append(
            "Debug: "
            + (
                with_source("on", "debug")
                if self.debug
                else "off (set TLON_TELEMETRY_DEBUG=true for per-event and SDK logs)"
            )
        )
        if self._client is not None and owner:
            lines.append(
                "Run /tlon status telemetry test to send and flush a test event."
            )
        return "\n".join(lines)

    def delivery_test(self) -> str:
        """Synchronous round trip: enqueue a test event, flush, report.

        Blocks on the SDK flush (network + retries), so call it off the event
        loop. Unlike :meth:`flush` it leaves reply traces alone.
        """
        if self._client is None:
            return f"Cannot test: telemetry is disabled — {self.disabled_reason}"
        if not self.config.owner_ship:
            return (
                "Cannot test: TLON_OWNER_SHIP is not set, so events have no "
                "distinct id and are skipped."
            )
        failures_before = self._delivery_failures
        captured_before = self._events_captured
        self.capture(EVENT_TELEMETRY_TEST, {"trigger": "control_command"})
        if self._events_captured == captured_before:
            return (
                "Test event could not be enqueued: "
                f"{self._last_capture_error or 'unknown capture error'}"
            )
        try:
            self._client.flush()
        except Exception as exc:
            return f"Test flush failed: {scrub_error(exc)}"
        if self._delivery_failures > failures_before:
            return (
                f"Test event FAILED to deliver: {self._last_delivery_error}. "
                "Check the API key, host, and network egress from the gateway."
            )
        # PostHog's ingestion endpoint accepts any well-formed request and
        # drops wrong-project keys later, so "accepted" cannot promise the
        # event reached the intended project.
        return (
            f"Test event accepted by PostHog: '{EVENT_TELEMETRY_TEST}' sent "
            f"as {self.config.owner_ship}. If it does not appear in the "
            "project, the API key likely belongs to a different project — "
            "mismatched keys are dropped silently during ingestion."
        )


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
