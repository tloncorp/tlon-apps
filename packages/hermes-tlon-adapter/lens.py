"""Context-lens ship sync for the Hermes Tlon adapter.

The context lens is per-run bot introspection: for each message-handling run
the adapter records a lifecycle (created -> dispatching -> tool_running ->
delivering -> terminal), the tool calls made, the model output, the assembled
context, and where the run persisted state. Runs are poked to the bot ship's
``%steward`` agent (lens module), which stores them and fans them out to the
configured owner ship, where a client renders them.

This module is the emitter side. It mirrors the OpenClaw gateway's
``context-lens-ship-sync.ts`` so both bot backends feed the SAME on-ship agent
and the SAME client UI:

  * payload shape == the gateway's ``ContextLens`` object, wrapped as
    ``{schemaVersion, lens, truncated?}`` (see ``build_lens_payload``);
  * poke shape == ``steward`` / ``steward-lens-action-1`` with
    ``{entry: {id, payload, final}}``, preceded once by a
    ``steward-action-1`` / ``{configure: {owner}}`` poke.

The recorder accumulates a run purely in memory (fed synchronously by the same
hooks that feed PostHog telemetry) and the sink pushes snapshots to the ship
from the adapter's async dispatch path. It is independent of PostHog: the lens
is the on-ship UI and must work whether or not cloud telemetry is enabled.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Optional

from .tlon_api import ClientFactory, TlonConfig, TlonSSEClient

logger = logging.getLogger(__name__)

# Kept in lockstep with packages/openclaw/src/context-lens-ship-sync.ts so the
# on-ship store and client render both backends identically.
PAYLOAD_SCHEMA_VERSION = 1
MAX_SUMMARY_CHARS = 4_096
MAX_PAYLOAD_CHARS = 50 * 1_024
# The steward lens module has no time-based expiry (count-capped instead), but
# the client ContextLens carries expiresAt; mirror the gateway's DEFAULT_TTL_MS
# (context-lens.ts) so both backends age entries out identically.
DEFAULT_TTL_MS = 30 * 60 * 1_000
# Bound in-memory runs so a leaked/never-finalized run can't grow unbounded.
MAX_TRACKED_RUNS = 256
RUN_TTL_SECONDS = 30 * 60

TERMINAL_STATUSES: frozenset[str] = frozenset(
    {"completed", "no_reply", "timed_out", "aborted", "error"}
)

_STEWARD_APP = "steward"
_CONFIGURE_MARK = "steward-action-1"
_LENS_MARK = "steward-lens-action-1"


def _now_ms() -> int:
    return int(time.time() * 1_000)


def _truncate(value: Optional[str]) -> Optional[str]:
    if value is None or len(value) <= MAX_SUMMARY_CHARS:
        return value
    return f"{value[:MAX_SUMMARY_CHARS]}… [truncated]"


@dataclass
class LensToolRun:
    id: str
    name: str
    call_index: int
    started_at: int
    tool_call_id: Optional[str] = None
    phase: Optional[str] = None
    completed_at: Optional[int] = None
    duration_ms: Optional[int] = None
    status: str = "running"  # running | completed | error | blocked
    argument_summary: Optional[str] = None
    argument_detail: Optional[str] = None
    result_summary: Optional[str] = None
    error: Optional[str] = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": self.id,
            "callIndex": self.call_index,
            "name": self.name,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "durationMs": self.duration_ms,
            "status": self.status,
        }
        if self.tool_call_id is not None:
            out["toolCallId"] = self.tool_call_id
        if self.phase is not None:
            out["phase"] = self.phase
        if self.argument_summary is not None:
            out["argumentSummary"] = _truncate(self.argument_summary)
        if self.argument_detail is not None:
            out["argumentDetail"] = _truncate(self.argument_detail)
        if self.result_summary is not None:
            out["resultSummary"] = _truncate(self.result_summary)
        if self.error is not None:
            out["error"] = self.error
        return out


@dataclass
class LensSource:
    kind: str  # message | memory | identity | system | tool_result | other
    label: str
    included: bool = True
    source_id: Optional[str] = None
    reason: Optional[str] = None
    token_estimate: Optional[int] = None
    preview: Optional[str] = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "kind": self.kind,
            "label": self.label,
            "included": self.included,
        }
        if self.source_id is not None:
            out["sourceId"] = self.source_id
        if self.reason is not None:
            out["reason"] = self.reason
        if self.token_estimate is not None:
            out["tokenEstimate"] = self.token_estimate
        if self.preview is not None:
            out["preview"] = _truncate(self.preview)
        return out


@dataclass
class LensPersistenceEvent:
    kind: str  # memory | conversation_state | tool_cache | artifact | other
    action: str  # read | created | updated | skipped | deleted
    location: str  # openclaw | urbit | tlon-desk | external
    status: str  # ok | failed | skipped
    at: int
    key: Optional[str] = None
    reason: Optional[str] = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "kind": self.kind,
            "action": self.action,
            "location": self.location,
            "status": self.status,
            "at": self.at,
        }
        if self.key is not None:
            out["key"] = self.key
        if self.reason is not None:
            out["reason"] = self.reason
        return out


@dataclass
class LensOutput:
    message_id: str
    conversation_id: str
    kind: str  # dm | channel
    sent_at: int
    preview: Optional[str] = None
    chunk_index: Optional[int] = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "messageId": self.message_id,
            "conversationId": self.conversation_id,
            "kind": self.kind,
            "sentAt": self.sent_at,
        }
        if self.preview is not None:
            out["preview"] = _truncate(self.preview)
        if self.chunk_index is not None:
            out["chunkIndex"] = self.chunk_index
        return out


@dataclass
class LensRun:
    """In-memory accumulator for a single run, rendered to a ContextLens dict.

    Field names mirror ``ContextLens`` (context-lens.ts): Python attributes are
    snake_case, the emitted JSON keys are camelCase via ``to_context_lens``.
    """

    lens_id: str
    message_id: str
    chat_type: str  # dm | channel | internal
    trigger: str
    conversation_kind: str  # dm | channel | internal
    run_kind: str = "conversation"
    visibility: str = "owner"
    session_key_hash: Optional[str] = None
    author_ship: Optional[str] = None
    conversation_id: Optional[str] = None
    received_at: Optional[int] = None
    preview: Optional[str] = None
    retry_of: Optional[str] = None

    model: Optional[str] = None
    provider: Optional[str] = None

    status: str = "assembling"
    error: Optional[str] = None

    created_at: int = field(default_factory=_now_ms)
    updated_at: int = field(default_factory=_now_ms)

    # context
    current_message: bool = True
    thread_messages: int = 0
    channel_messages: int = 0
    cited_posts: int = 0
    attachments: int = 0
    pending_nudge: bool = False
    sources: list[LensSource] = field(default_factory=list)

    # persistence
    posts_reply: bool = False
    updates_settings: bool = False
    writes_media: bool = False
    emits_telemetry: bool = False
    caches_history: bool = False
    persistence_events: list[LensPersistenceEvent] = field(default_factory=list)

    # tools
    owner_only_available: list[str] = field(default_factory=list)
    tool_runs: list[LensToolRun] = field(default_factory=list)

    outputs: list[LensOutput] = field(default_factory=list)

    # lifecycle
    queued_at: Optional[int] = None
    dispatch_started_at: Optional[int] = None
    first_tool_started_at: Optional[int] = None
    completed_at: Optional[int] = None
    duration_ms: Optional[int] = None
    timeout_ms: Optional[int] = None
    timed_out: bool = False
    delivered_message_count: int = 0
    delivery_failed: bool = False

    def touch(self) -> None:
        self.updated_at = _now_ms()

    def set_status(self, status: str, error: Optional[str] = None) -> None:
        self.status = status
        if error:
            self.error = error
        if status in TERMINAL_STATUSES and self.completed_at is None:
            self.completed_at = _now_ms()
            start = self.dispatch_started_at or self.created_at
            self.duration_ms = max(0, self.completed_at - start)
            self.timed_out = self.timed_out or status == "timed_out"
        self.touch()

    def start_tool(
        self,
        name: str,
        *,
        tool_call_id: Optional[str] = None,
        argument_summary: Optional[str] = None,
        argument_detail: Optional[str] = None,
        phase: Optional[str] = None,
    ) -> LensToolRun:
        now = _now_ms()
        run = LensToolRun(
            id=str(uuid.uuid4()),
            name=name,
            call_index=len(self.tool_runs) + 1,
            started_at=now,
            tool_call_id=tool_call_id,
            argument_summary=argument_summary,
            argument_detail=argument_detail,
            phase=phase,
        )
        self.tool_runs.append(run)
        if self.first_tool_started_at is None:
            self.first_tool_started_at = now
        self.touch()
        return run

    def _find_open_tool(
        self, name: str, tool_call_id: Optional[str]
    ) -> Optional[LensToolRun]:
        for run in reversed(self.tool_runs):
            if run.status != "running":
                continue
            if tool_call_id is not None and run.tool_call_id == tool_call_id:
                return run
            if tool_call_id is None and run.name == name:
                return run
        return None

    def complete_tool(
        self,
        name: str,
        *,
        tool_call_id: Optional[str] = None,
        duration_ms: Optional[int] = None,
        result_summary: Optional[str] = None,
        error: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        run = self._find_open_tool(name, tool_call_id)
        if run is None:
            # A completion with no matching start (result-only hook): synthesize
            # a closed run so the tool still appears in the lens.
            run = self.start_tool(name, tool_call_id=tool_call_id)
        now = _now_ms()
        run.completed_at = now
        run.duration_ms = (
            duration_ms if duration_ms is not None else max(0, now - run.started_at)
        )
        if result_summary is not None:
            run.result_summary = result_summary
        if error:
            run.error = error
            run.status = status or "error"
        else:
            run.status = status or "completed"
        self.touch()

    def close_open_tools(self, status: str = "error") -> None:
        # ContextLensToolRun.status is 'running'|'completed'|'error'|'blocked'
        # (context-lens.ts) — a dangling tool at run end is reported as 'error',
        # never the run-level 'aborted' status.
        now = _now_ms()
        for run in self.tool_runs:
            if run.status == "running":
                run.completed_at = now
                run.duration_ms = max(0, now - run.started_at)
                run.status = status
        self.touch()

    def record_output(self, output: LensOutput) -> None:
        self.outputs.append(output)
        self.posts_reply = True
        self.touch()

    def record_source(self, source: LensSource) -> None:
        self.sources.append(source)
        self.touch()

    def record_persistence_event(self, event: LensPersistenceEvent) -> None:
        self.persistence_events.append(event)
        self.touch()

    @property
    def called_tools(self) -> list[str]:
        seen: list[str] = []
        for run in self.tool_runs:
            if run.name not in seen:
                seen.append(run.name)
        return seen

    @property
    def last_tool_started_at(self) -> Optional[int]:
        return self.tool_runs[-1].started_at if self.tool_runs else None

    def to_context_lens(self) -> dict[str, Any]:
        lens: dict[str, Any] = {
            "lensId": self.lens_id,
            "messageId": self.message_id,
            "sessionKeyHash": self.session_key_hash,
            "chatType": self.chat_type,
            "runKind": self.run_kind,
            "visibility": self.visibility,
            "trigger": self.trigger,
            "triggerDetails": {
                "type": self.trigger,
                "messageId": self.message_id,
                "conversationKind": self.conversation_kind,
                **({"authorShip": self.author_ship} if self.author_ship else {}),
                **(
                    {"conversationId": self.conversation_id}
                    if self.conversation_id
                    else {}
                ),
                **({"receivedAt": self.received_at} if self.received_at else {}),
                **({"preview": _truncate(self.preview)} if self.preview else {}),
            },
            "model": self.model,
            "provider": self.provider,
            "context": {
                "currentMessage": self.current_message,
                "threadMessages": self.thread_messages,
                "channelMessages": self.channel_messages,
                "citedPosts": self.cited_posts,
                "attachments": self.attachments,
                "pendingNudge": self.pending_nudge,
                "sources": [s.to_json() for s in self.sources],
            },
            "persistence": {
                "postsReply": self.posts_reply,
                "updatesSettings": self.updates_settings,
                "writesMedia": self.writes_media,
                "emitsTelemetry": self.emits_telemetry,
                "cachesHistory": self.caches_history,
                "events": [e.to_json() for e in self.persistence_events],
            },
            "tools": {
                "ownerOnlyAvailable": list(self.owner_only_available),
                "called": self.called_tools,
                "callCount": len(self.tool_runs),
                "lastStartedAt": self.last_tool_started_at,
                "runs": [r.to_json() for r in self.tool_runs],
            },
            "outputs": [o.to_json() for o in self.outputs],
            "lifecycle": {
                "queuedAt": self.queued_at,
                "queuedMs": max(0, (self.dispatch_started_at or self.created_at) - (self.queued_at or self.created_at)),
                "dispatchStartedAt": self.dispatch_started_at,
                "firstToolStartedAt": self.first_tool_started_at,
                "completedAt": self.completed_at,
                "durationMs": self.duration_ms,
                "timeoutMs": self.timeout_ms,
                "timedOut": self.timed_out,
                "deliveredMessageCount": self.delivered_message_count,
                "queuedFinal": False,
                "queuedFinalCount": 0,
                "queuedBlockCount": 0,
            },
            "status": self.status,
            "error": self.error,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "expiresAt": self.created_at + DEFAULT_TTL_MS,
        }
        if self.retry_of is not None:
            lens["retryOf"] = self.retry_of
        return lens


def build_lens_payload(lens: dict[str, Any]) -> dict[str, Any]:
    """Wrap a ContextLens dict as the steward run payload.

    Mirrors ``buildLensRunPayload`` (context-lens-ship-sync.ts): per-field
    truncation happens as the dict is built (``to_context_lens`` /
    ``_truncate``); here we enforce the total size cap, dropping the bulky
    arrays but keeping run identity and status when a run is oversized.
    """
    payload: dict[str, Any] = {"schemaVersion": PAYLOAD_SCHEMA_VERSION, "lens": lens}
    if len(json.dumps(payload, separators=(",", ":"))) <= MAX_PAYLOAD_CHARS:
        return payload
    skeleton = dict(lens)
    skeleton["context"] = {**lens["context"], "sources": []}
    skeleton["persistence"] = {**lens["persistence"], "events": []}
    skeleton["tools"] = {**lens["tools"], "runs": []}
    skeleton["outputs"] = []
    return {
        "schemaVersion": PAYLOAD_SCHEMA_VERSION,
        "lens": skeleton,
        "truncated": True,
    }


def context_lens_reference_blob(
    lens_id: str, bot_ship: Optional[str] = None
) -> str:
    """Post-blob field pointing a delivered reply at its lens run.

    Mirrors ``serializeContextLensReferenceBlob`` (openclaw/urbit/blob.ts): a
    JSON array with a single ``tlon-context-lens`` entry. The client's
    ``getContextLensStamp`` reads this off ``post.blob`` to surface the
    per-message lens entry point (badge / message actions).
    """
    entry: dict[str, Any] = {
        "type": "tlon-context-lens",
        "version": 1,
        "lensId": lens_id,
    }
    if bot_ship:
        entry["botShip"] = bot_ship
    return json.dumps([entry], separators=(",", ":"))


class TlonLensSync:
    """Pokes lens run records to the bot ship's ``%steward`` agent.

    Owns its own SSE client (like ``TlonGatewayStatus``) so lens traffic does
    not contend with the main event subscription. Gated on an owner ship being
    resolvable and ``TLON_CONTEXT_LENS`` being enabled; a no-op otherwise.
    """

    def __init__(
        self,
        config: TlonConfig,
        *,
        client_factory: ClientFactory = TlonSSEClient,
        on_error: Callable[[str, BaseException], None] | None = None,
    ) -> None:
        self.config = config
        self.owner = config.context_lens_owner_ship()
        self._client_factory = client_factory
        self._client: Optional[TlonSSEClient] = None
        self._configured = False
        self._on_error = on_error
        # Serialize pokes so a run's partial/final ordering is preserved.
        self._queue: asyncio.Lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.config.context_lens_enabled and self.owner)

    def _report_error(self, operation: str, exc: BaseException) -> None:
        if self._on_error is None:
            return
        try:
            self._on_error(operation, exc)
        except Exception as report_exc:
            logger.debug("[tlon] context-lens error reporter failed: %s", report_exc)

    async def start(self) -> bool:
        if not self.config.context_lens_enabled:
            logger.info("[tlon] context-lens disabled")
            return False
        if not self.owner:
            logger.info("[tlon] context-lens skipped: no owner configured")
            return False
        client = self._client_factory(self.config)
        self._client = client
        try:
            await client.authenticate()
            await client.open()
        except Exception:
            await self._safe_close_client()
            self._client = None
            raise
        logger.info("[tlon] context-lens sync active (owner=%s)", self.owner)
        return True

    async def stop(self) -> None:
        self._configured = False
        await self._safe_close_client()
        self._client = None

    async def push(self, run: LensRun, *, final: bool) -> None:
        if not self.enabled or self._client is None:
            return
        if run.visibility == "internal":
            return
        payload = build_lens_payload(run.to_context_lens())
        try:
            async with self._queue:
                await self._ensure_configured()
                await self._client.poke(
                    _STEWARD_APP,
                    _LENS_MARK,
                    {"entry": {"id": run.lens_id, "payload": payload, "final": final}},
                )
        except Exception as exc:
            # A failed %configure must re-run before the next entry poke.
            self._configured = False
            logger.warning("[tlon] context-lens push failed (%s): %s", run.lens_id, exc)
            self._report_error("push", exc)

    async def _ensure_configured(self) -> None:
        if self._configured or self._client is None:
            return
        await self._client.poke(
            _STEWARD_APP, _CONFIGURE_MARK, {"configure": {"owner": self.owner}}
        )
        self._configured = True

    async def _safe_close_client(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass


class TlonLensRecorder:
    """Per-conversation run accumulator + sink, held as a process singleton.

    The adapter drives lifecycle transitions (``begin`` / ``dispatching`` /
    ``delivering`` / ``finish``) from its async path and awaits pokes there;
    the sync tool/model hooks only mutate the in-memory run.
    """

    def __init__(self, sync: TlonLensSync) -> None:
        self._sync = sync
        self._runs: dict[str, LensRun] = {}

    @property
    def enabled(self) -> bool:
        return self._sync.enabled

    def get(self, conversation_id: str) -> Optional[LensRun]:
        return self._runs.get(conversation_id)

    def _prune(self) -> None:
        if len(self._runs) <= MAX_TRACKED_RUNS:
            return
        cutoff = _now_ms() - RUN_TTL_SECONDS * 1_000
        stale = [k for k, r in self._runs.items() if r.updated_at < cutoff]
        for key in stale:
            self._runs.pop(key, None)

    def begin(self, conversation_id: str, run: LensRun) -> LensRun:
        if not self.enabled or not conversation_id:
            return run
        self._prune()
        self._runs[conversation_id] = run
        return run

    def record_tool_start(self, conversation_id: str, name: str, **kwargs: Any) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            run.start_tool(name, **kwargs)

    def record_tool_complete(
        self, conversation_id: str, name: str, **kwargs: Any
    ) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            run.complete_tool(name, **kwargs)

    def record_model(
        self,
        conversation_id: str,
        *,
        model: Optional[str],
        provider: Optional[str],
    ) -> None:
        run = self._runs.get(conversation_id)
        if run is None:
            return
        run.model = model or run.model
        run.provider = provider or run.provider
        run.touch()

    def record_output(self, conversation_id: str, output: LensOutput) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            run.record_output(output)
            run.delivered_message_count += 1

    def record_delivery_failure(
        self, conversation_id: str, error: Optional[str] = None
    ) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            run.delivery_failed = True
            if error and not run.error:
                run.error = error
            run.touch()

    def set_status(
        self, conversation_id: str, status: str, error: Optional[str] = None
    ) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            run.set_status(status, error)

    async def push(self, conversation_id: str) -> None:
        run = self._runs.get(conversation_id)
        if run is not None:
            await self._sync.push(run, final=False)

    async def finish(
        self, conversation_id: str, *, status: Optional[str] = None
    ) -> None:
        run = self._runs.pop(conversation_id, None)
        if run is None:
            return
        run.close_open_tools(status="error")
        if status is not None:
            run.set_status(status)
        elif run.status not in TERMINAL_STATUSES:
            run.set_status("no_reply")
        await self._sync.push(run, final=True)


_active_recorder: Optional[TlonLensRecorder] = None


def set_active_recorder(recorder: TlonLensRecorder) -> None:
    global _active_recorder
    _active_recorder = recorder


def clear_active_recorder(recorder: TlonLensRecorder) -> None:
    global _active_recorder
    if _active_recorder is recorder:
        _active_recorder = None


def get_active_recorder() -> Optional[TlonLensRecorder]:
    return _active_recorder


# ── Hermes hook handlers ────────────────────────────────────────────────────
#
# These mirror the telemetry/presence hooks: they resolve the active run from
# the per-run session env (set by the gateway when it invokes Hermes for a Tlon
# conversation) and mutate the in-memory ``LensRun`` synchronously. The ship
# poke happens later from the adapter's async dispatch path.


def _session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def _lens_conversation(kwargs: Mapping[str, Any]) -> Optional[str]:
    platform = str(
        kwargs.get("platform") or _session_env("HERMES_SESSION_PLATFORM", "")
    ).lower()
    if platform != "tlon":
        return None
    conversation = str(_session_env("HERMES_SESSION_CHAT_ID", "") or "").strip()
    return conversation or None


def _summarize_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, separators=(",", ":"), default=str, sort_keys=True)
    except Exception:
        return str(value)


def _argument_summary(tool_name: str, args: Any) -> Optional[str]:
    if isinstance(args, Mapping):
        keys = ", ".join(sorted(str(k) for k in args.keys()))
        return f"{tool_name}({keys})" if keys else f"{tool_name}()"
    if args is None:
        return None
    return f"{tool_name}(…)"


def _active_run(kwargs: Mapping[str, Any]) -> tuple[Optional[TlonLensRecorder], Optional[str]]:
    recorder = get_active_recorder()
    if recorder is None or not recorder.enabled:
        return None, None
    conversation = _lens_conversation(kwargs)
    if conversation is None:
        return None, None
    return recorder, conversation


def handle_pre_tool_call_lens(**kwargs: Any) -> None:
    recorder, conversation = _active_run(kwargs)
    if recorder is None or conversation is None:
        return
    tool_name = str(kwargs.get("tool_name") or "").strip() or "unknown"
    args = kwargs.get("args")
    recorder.record_tool_start(
        conversation,
        tool_name,
        tool_call_id=str(kwargs.get("tool_call_id") or "") or None,
        argument_summary=_argument_summary(tool_name, args),
        argument_detail=_summarize_value(args),
    )


def handle_post_tool_call_lens(**kwargs: Any) -> None:
    recorder, conversation = _active_run(kwargs)
    if recorder is None or conversation is None:
        return
    tool_name = str(kwargs.get("tool_name") or "").strip() or "unknown"
    status = str(kwargs.get("status") or "").lower()
    # A non-ok status is a failure even if Hermes gives us no error_type, so key
    # the terminal tool status off `status`, not just the presence of an error.
    failed = status not in ("", "ok")
    error = str(kwargs.get("error_type") or "") if failed else ""
    try:
        duration_ms: Optional[int] = int(kwargs.get("duration_ms") or 0) or None
    except (TypeError, ValueError):
        duration_ms = None
    recorder.record_tool_complete(
        conversation,
        tool_name,
        tool_call_id=str(kwargs.get("tool_call_id") or "") or None,
        duration_ms=duration_ms,
        result_summary=_summarize_value(kwargs.get("result")),
        error=error or None,
        status="error" if failed else "completed",
    )


def handle_post_api_request_lens(**kwargs: Any) -> None:
    recorder, conversation = _active_run(kwargs)
    if recorder is None or conversation is None:
        return
    recorder.record_model(
        conversation,
        model=str(kwargs.get("model") or "") or None,
        provider=str(kwargs.get("provider") or "") or None,
    )
