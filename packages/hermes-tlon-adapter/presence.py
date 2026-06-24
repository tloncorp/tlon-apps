"""Computing presence for Hermes turns on Tlon.

This mirrors OpenClaw's ``tlon.computing-status.v1`` presence payloads while
staying inside the Hermes plugin boundary. Adapter lifecycle methods own
turn start/stop, and plugin hooks add tool names / clear tool labels.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Optional, Sequence

from .tlon_api import TlonConfig, TlonSSEClient, normalize_ship, parse_channel_nest

logger = logging.getLogger(__name__)

COMPUTING_STATUS_PROTOCOL = "tlon.computing-status.v1"
DEFAULT_MIN_UPDATE_INTERVAL_MS = 1_000
ACTIVE_PRESENCE_TIMEOUT = "~m1.s30"
DEFAULT_MAX_PUBLISH_AGE_MS = 30_000
DEFAULT_KEEPALIVE_INTERVAL_MS = 20_000
STOPPED_RUN_MEMORY = 8

TOOL_LABELS = {
    "exec": "Running a command",
    "image_search": "Searching images",
    "read": "Reading files",
    "tlon": "Using Tlon",
    "web_extract": "Checking the web",
    "web_fetch": "Checking the web",
    "web_search": "Searching the web",
}


def conversation_id_to_presence_context(conversation_id: str) -> str:
    conversation_id = str(conversation_id or "").strip()
    if not conversation_id:
        raise ValueError("Missing Tlon conversation id for computing presence")

    normalized_ship = normalize_ship(conversation_id)
    if conversation_id.startswith("~") and normalized_ship == conversation_id:
        return f"/dm/{conversation_id}"

    parsed = parse_channel_nest(conversation_id)
    if parsed is not None:
        return f"/channel/{parsed['type']}/{parsed['host']}/{parsed['name']}"

    raise ValueError(f'Presence only supports Tlon DMs and channels, got "{conversation_id}"')


def format_computing_tool_call_label(tool_name: str | None = None) -> str:
    if not tool_name:
        return "Using a tool"
    return TOOL_LABELS.get(tool_name) or f"Using {tool_name.replace('_', ' ')}"


def create_computing_status(
    *,
    thinking: bool,
    tool_names: Sequence[str | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    seen: set[str] = set()
    tool_calls: list[dict[str, str]] = []
    for raw_tool_call in tool_names:
        if isinstance(raw_tool_call, Mapping):
            raw_name = raw_tool_call.get("toolName", raw_tool_call.get("tool_name"))
            label = str(raw_tool_call.get("label") or "").strip()
        else:
            raw_name = raw_tool_call
            label = ""

        tool_name = str(raw_name or "").strip()
        if not tool_name or tool_name in seen:
            continue
        seen.add(tool_name)
        tool_calls.append(
            {
                "toolName": tool_name,
                "label": label or format_computing_tool_call_label(tool_name),
            }
        )

    return {
        "protocol": COMPUTING_STATUS_PROTOCOL,
        "thinking": bool(thinking),
        "toolCalls": tool_calls,
    }


def get_computing_status_text(status: Mapping[str, Any]) -> Optional[str]:
    tool_calls = status.get("toolCalls")
    if not isinstance(tool_calls, list):
        tool_calls = []

    if len(tool_calls) == 1:
        label = tool_calls[0].get("label") if isinstance(tool_calls[0], dict) else None
        return str(label) if label else "Using a tool"

    if len(tool_calls) > 1:
        return "Using tools..."

    return "Thinking..." if bool(status.get("thinking")) else None


def serialize_computing_status(*, thinking: bool, tool_names: Sequence[str] = ()) -> str:
    return json.dumps(
        create_computing_status(thinking=thinking, tool_names=tool_names),
        ensure_ascii=False,
        separators=(",", ":"),
    )


class TlonComputingPresenceReporter:
    def __init__(
        self,
        config: TlonConfig,
        *,
        client_factory: Callable[[TlonConfig], TlonSSEClient] = TlonSSEClient,
    ) -> None:
        self.config = config
        self._client_factory = client_factory
        self._client: Optional[TlonSSEClient] = None
        self._lock = asyncio.Lock()

    async def publish(
        self,
        *,
        conversation_id: str,
        thinking: bool,
        tool_names: Sequence[str],
    ) -> None:
        context = conversation_id_to_presence_context(conversation_id)
        key = {
            "context": context,
            "ship": normalize_ship(self.config.ship_name),
            "topic": "computing",
        }

        if not thinking:
            payload = {"clear": key}
            async with self._lock:
                client = await self._ensure_client()
                await client.poke("presence", "presence-action-1", payload)
            return

        status = create_computing_status(thinking=thinking, tool_names=tool_names)
        payload = {
            "set": {
                "disclose": [],
                "key": key,
                "timeout": ACTIVE_PRESENCE_TIMEOUT,
                "display": {
                    "icon": None,
                    "text": get_computing_status_text(status),
                    "blob": json.dumps(
                        status,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                },
            }
        }

        async with self._lock:
            client = await self._ensure_client()
            await client.poke("presence", "presence-action-1", payload)

    async def close(self) -> None:
        async with self._lock:
            if self._client is not None:
                try:
                    await self._client.close()
                finally:
                    self._client = None

    async def _ensure_client(self) -> TlonSSEClient:
        if self._client is None:
            self._client = self._client_factory(self.config)
            await self._client.authenticate()
            await self._client.open()
        return self._client


@dataclass
class _RunState:
    tool_names: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class _PublishedState:
    thinking: bool
    tool_names: tuple[str, ...]


class TlonComputingPresenceTracker:
    def __init__(
        self,
        *,
        reporter: TlonComputingPresenceReporter,
        min_update_interval_ms: int = DEFAULT_MIN_UPDATE_INTERVAL_MS,
        max_publish_age_ms: int = DEFAULT_MAX_PUBLISH_AGE_MS,
        keepalive_interval_ms: int = DEFAULT_KEEPALIVE_INTERVAL_MS,
        on_error: Optional[Callable[[str, BaseException], None]] = None,
    ) -> None:
        self._reporter = reporter
        self._min_update_interval_ms = max(0, int(min_update_interval_ms))
        self._max_publish_age_ms = max(
            self._min_update_interval_ms,
            int(max_publish_age_ms),
        )
        self._keepalive_interval_ms = max(0, int(keepalive_interval_ms))
        self._on_error = on_error
        self._conversations: dict[str, dict[str, _RunState]] = {}
        self._last_published_state: dict[str, _PublishedState] = {}
        self._last_published_at: dict[str, float] = {}
        self._pending_state: dict[str, _PublishedState] = {}
        self._pending_tasks: dict[str, asyncio.Task] = {}
        self._keepalive_tasks: dict[str, asyncio.Task] = {}
        self._stopped_runs: dict[str, list[str]] = {}
        self._lock = asyncio.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def schedule(self, coroutine_factory: Callable[[], Any]) -> bool:
        loop = self._loop
        if loop is None or loop.is_closed():
            return False

        def create_coro():
            result = coroutine_factory()
            if not asyncio.iscoroutine(result):
                raise TypeError("presence schedule factory must return a coroutine")
            return result

        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        try:
            if running_loop is loop:
                loop.create_task(create_coro())
            else:
                asyncio.run_coroutine_threadsafe(create_coro(), loop)
            return True
        except Exception as exc:
            logger.debug("[tlon] failed to schedule computing presence update: %s", exc)
            return False

    async def refresh_run(self, *, conversation_id: str, run_id: str) -> None:
        await self._safely_sync(
            conversation_id,
            "refresh",
            lambda: self._refresh_run(conversation_id, run_id),
        )

    async def add_tool_call(
        self,
        *,
        conversation_id: str,
        run_id: str,
        tool_name: str | None,
    ) -> None:
        normalized = str(tool_name or "").strip()
        if not normalized:
            return
        await self._safely_sync(
            conversation_id,
            "update",
            lambda: self._add_tool_call(conversation_id, run_id, normalized),
        )

    async def clear_tool_calls(self, *, conversation_id: str, run_id: str) -> None:
        await self._safely_sync(
            conversation_id,
            "clear tools for",
            lambda: self._clear_tool_calls(conversation_id, run_id),
        )

    async def stop_run(self, *, conversation_id: str, run_id: str) -> None:
        await self._safely_sync(
            conversation_id,
            "clear",
            lambda: self._stop_run(conversation_id, run_id),
        )

    async def close(self) -> None:
        async with self._lock:
            for task in self._pending_tasks.values():
                task.cancel()
            for task in self._keepalive_tasks.values():
                task.cancel()
            self._pending_tasks.clear()
            self._pending_state.clear()
            self._keepalive_tasks.clear()
            conversations = list(self._conversations)
            self._conversations.clear()
            self._stopped_runs.clear()

        for conversation_id in conversations:
            state = self._last_published_state.get(conversation_id)
            if state and state.thinking:
                try:
                    await self._publish_now(
                        conversation_id,
                        _PublishedState(thinking=False, tool_names=()),
                    )
                except Exception as exc:
                    logger.warning(
                        "[tlon] Failed to clear computing presence for %s during close: %s",
                        conversation_id,
                        exc,
                    )

        await self._reporter.close()

    async def _refresh_run(self, conversation_id: str, run_id: str) -> None:
        async with self._lock:
            if self._is_run_stopped_unlocked(conversation_id, run_id):
                return
            self._ensure_run(conversation_id, run_id)
            state = self._current_state_unlocked(conversation_id)
        await self._sync_conversation(conversation_id, state)

    async def _add_tool_call(
        self,
        conversation_id: str,
        run_id: str,
        tool_name: str,
    ) -> None:
        async with self._lock:
            self._clear_run_stopped_unlocked(conversation_id, run_id)
            run = self._ensure_run(conversation_id, run_id)
            if tool_name not in run.tool_names:
                run.tool_names.append(tool_name)
            state = self._current_state_unlocked(conversation_id)
        await self._sync_conversation(conversation_id, state)

    async def _clear_tool_calls(self, conversation_id: str, run_id: str) -> None:
        async with self._lock:
            run = self._get_run(conversation_id, run_id)
            if run is None or not run.tool_names:
                return
            run.tool_names = []
            state = self._current_state_unlocked(conversation_id)
        await self._sync_conversation(conversation_id, state)

    async def _stop_run(self, conversation_id: str, run_id: str) -> None:
        async with self._lock:
            self._mark_run_stopped_unlocked(conversation_id, run_id)
            runs = self._conversations.get(conversation_id)
            if not runs:
                previous = self._last_published_state.get(conversation_id)
                state = (
                    _PublishedState(thinking=False, tool_names=())
                    if previous and previous.thinking
                    else None
                )
            else:
                runs.pop(run_id, None)
                if runs:
                    state = self._current_state_unlocked(conversation_id)
                else:
                    self._conversations.pop(conversation_id, None)
                    previous = self._last_published_state.get(conversation_id)
                    state = (
                        _PublishedState(thinking=False, tool_names=())
                        if previous and previous.thinking
                        else None
                    )

        if state is not None:
            await self._sync_conversation(conversation_id, state)

    async def _sync_conversation(self, conversation_id: str, state: _PublishedState) -> None:
        previous = self._last_published_state.get(conversation_id)
        if previous == state:
            published_at = self._last_published_at.get(conversation_id, 0.0)
            publish_age_ms = time.monotonic() * 1000.0 - published_at
            if not state.thinking or publish_age_ms < self._max_publish_age_ms:
                self._clear_pending(conversation_id)
                return

        if (
            not state.thinking
            or not previous
            or not previous.thinking
            or self._min_update_interval_ms == 0
        ):
            await self._publish_now(conversation_id, state)
            return

        now = time.monotonic() * 1000.0
        next_allowed_at = (
            self._last_published_at.get(conversation_id, 0.0)
            + self._min_update_interval_ms
        )
        if now >= next_allowed_at:
            await self._publish_now(conversation_id, state)
            return

        self._pending_state[conversation_id] = state
        if conversation_id in self._pending_tasks:
            return

        delay = max(0.0, (next_allowed_at - now) / 1000.0)
        self._pending_tasks[conversation_id] = asyncio.create_task(
            self._flush_pending_later(conversation_id, delay)
        )

    async def _flush_pending_later(self, conversation_id: str, delay: float) -> None:
        try:
            await asyncio.sleep(delay)
            state = self._pending_state.pop(conversation_id, None)
            self._pending_tasks.pop(conversation_id, None)
            if state is None or self._last_published_state.get(conversation_id) == state:
                return
            await self._publish_now(conversation_id, state)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "[tlon] Failed to flush computing presence for %s: %s",
                conversation_id,
                exc,
            )
            self._report_error("flush", exc)

    async def _publish_now(self, conversation_id: str, state: _PublishedState) -> None:
        self._clear_pending(conversation_id)
        await self._reporter.publish(
            conversation_id=conversation_id,
            thinking=state.thinking,
            tool_names=list(state.tool_names),
        )
        self._last_published_state[conversation_id] = state
        self._last_published_at[conversation_id] = time.monotonic() * 1000.0
        if state.thinking:
            self._ensure_keepalive(conversation_id)
        else:
            self._last_published_state.pop(conversation_id, None)
            self._last_published_at.pop(conversation_id, None)
            self._cancel_keepalive(conversation_id)

    def _clear_pending(self, conversation_id: str) -> None:
        task = self._pending_tasks.pop(conversation_id, None)
        if task is not None:
            task.cancel()
        self._pending_state.pop(conversation_id, None)

    def _ensure_keepalive(self, conversation_id: str) -> None:
        if self._keepalive_interval_ms <= 0:
            return
        task = self._keepalive_tasks.get(conversation_id)
        if task is not None and not task.done():
            return
        self._keepalive_tasks[conversation_id] = asyncio.create_task(
            self._keepalive_loop(conversation_id)
        )

    def _cancel_keepalive(self, conversation_id: str) -> None:
        task = self._keepalive_tasks.pop(conversation_id, None)
        if task is not None:
            task.cancel()

    async def _keepalive_loop(self, conversation_id: str) -> None:
        try:
            while True:
                await asyncio.sleep(self._keepalive_interval_ms / 1000.0)
                async with self._lock:
                    runs = list(self._conversations.get(conversation_id, {}).keys())
                if not runs:
                    return
                for run_id in runs:
                    await self.refresh_run(
                        conversation_id=conversation_id,
                        run_id=run_id,
                    )
        except asyncio.CancelledError:
            raise
        finally:
            if self._keepalive_tasks.get(conversation_id) is asyncio.current_task():
                self._keepalive_tasks.pop(conversation_id, None)

    def _ensure_run(self, conversation_id: str, run_id: str) -> _RunState:
        runs = self._conversations.setdefault(conversation_id, {})
        return runs.setdefault(run_id, _RunState())

    def _mark_run_stopped_unlocked(self, conversation_id: str, run_id: str) -> None:
        stopped = self._stopped_runs.setdefault(conversation_id, [])
        if run_id in stopped:
            stopped.remove(run_id)
        stopped.append(run_id)
        del stopped[:-STOPPED_RUN_MEMORY]

    def _is_run_stopped_unlocked(self, conversation_id: str, run_id: str) -> bool:
        return run_id in self._stopped_runs.get(conversation_id, [])

    def _clear_run_stopped_unlocked(self, conversation_id: str, run_id: str) -> None:
        stopped = self._stopped_runs.get(conversation_id)
        if not stopped or run_id not in stopped:
            return
        stopped.remove(run_id)
        if not stopped:
            self._stopped_runs.pop(conversation_id, None)

    def _get_run(self, conversation_id: str, run_id: str) -> Optional[_RunState]:
        return self._conversations.get(conversation_id, {}).get(run_id)

    def _current_state_unlocked(self, conversation_id: str) -> _PublishedState:
        tool_names: list[str] = []
        seen: set[str] = set()
        for run in self._conversations.get(conversation_id, {}).values():
            for tool_name in run.tool_names:
                if tool_name in seen:
                    continue
                seen.add(tool_name)
                tool_names.append(tool_name)
        return _PublishedState(thinking=True, tool_names=tuple(tool_names))

    def _report_error(self, action: str, exc: BaseException) -> None:
        if self._on_error is None:
            return
        try:
            self._on_error(action, exc)
        except Exception as report_exc:
            logger.debug("[tlon] presence error reporter failed: %s", report_exc)

    async def _safely_sync(
        self,
        conversation_id: str,
        action: str,
        fn: Callable[[], Any],
    ) -> None:
        try:
            result = fn()
            if asyncio.iscoroutine(result):
                await result
        except Exception as exc:
            logger.warning(
                "[tlon] Failed to %s computing presence for %s: %s",
                action,
                conversation_id,
                exc,
            )
            self._report_error(action, exc)


_active_tracker: Optional[TlonComputingPresenceTracker] = None
_active_tracker_lock = threading.RLock()


def set_active_computing_presence_tracker(tracker: TlonComputingPresenceTracker) -> None:
    global _active_tracker
    with _active_tracker_lock:
        _active_tracker = tracker


def clear_active_computing_presence_tracker(tracker: TlonComputingPresenceTracker) -> None:
    global _active_tracker
    with _active_tracker_lock:
        if _active_tracker is tracker:
            _active_tracker = None


def _get_active_tracker() -> Optional[TlonComputingPresenceTracker]:
    with _active_tracker_lock:
        return _active_tracker


def _get_session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def _current_tlon_presence_target(kwargs: Mapping[str, Any]) -> Optional[tuple[str, str]]:
    platform = str(kwargs.get("platform") or _get_session_env("HERMES_SESSION_PLATFORM", "")).lower()
    if platform != "tlon":
        return None

    conversation_id = str(_get_session_env("HERMES_SESSION_CHAT_ID", "") or "").strip()
    if not conversation_id:
        return None

    run_id = (
        str(_get_session_env("HERMES_SESSION_MESSAGE_ID", "") or "").strip()
        or str(kwargs.get("task_id") or "").strip()
        or str(kwargs.get("session_id") or "").strip()
    )
    if not run_id:
        return None

    return conversation_id, run_id


def handle_pre_tool_call(**kwargs: Any) -> None:
    target = _current_tlon_presence_target(kwargs)
    tracker = _get_active_tracker()
    if target is None or tracker is None:
        return

    conversation_id, run_id = target
    tool_name = str(kwargs.get("tool_name") or "").strip()
    tracker.schedule(
        lambda: tracker.add_tool_call(
            conversation_id=conversation_id,
            run_id=run_id,
            tool_name=tool_name,
        )
    )


def handle_post_api_request(**kwargs: Any) -> None:
    target = _current_tlon_presence_target(kwargs)
    tracker = _get_active_tracker()
    if target is None or tracker is None:
        return

    try:
        assistant_content_chars = int(kwargs.get("assistant_content_chars") or 0)
    except (TypeError, ValueError):
        assistant_content_chars = 0
    if assistant_content_chars <= 0:
        return

    conversation_id, run_id = target
    tracker.schedule(
        lambda: tracker.clear_tool_calls(
            conversation_id=conversation_id,
            run_id=run_id,
        )
    )
