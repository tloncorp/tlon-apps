"""OpenClaw-compatible re-engagement nudge decisions and scheduling."""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Deque, Iterable, Mapping, Optional, Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .owner_listen import settings_del_entry, settings_put_entry
from .tlon_api import TlonTerminalActionError, format_post_id

logger = logging.getLogger(__name__)

DEFAULT_ACTIVE_HOURS_START = "09:00"
DEFAULT_ACTIVE_HOURS_END = "21:00"
DEFAULT_ACTIVE_HOURS_TIMEZONE = "America/New_York"
DEFAULT_NUDGE_TICK_INTERVAL_MS = 15 * 60 * 1000
DEFAULT_ATTRIBUTION_WINDOW_MS = 72 * 60 * 60 * 1000
NUDGE_ACCOUNT_ID = "hermes"

SETTINGS_KEY_LAST_OWNER_MESSAGE_AT = "lastOwnerMessageAt"
SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE = "lastOwnerMessageDate"
SETTINGS_KEY_PENDING_NUDGE = "pendingNudge"
SETTINGS_KEY_LAST_NUDGE_STAGE = "lastNudgeStage"
SETTINGS_KEY_NUDGE_ACTIVE_HOURS_START = "nudgeActiveHoursStart"
SETTINGS_KEY_NUDGE_ACTIVE_HOURS_END = "nudgeActiveHoursEnd"
SETTINGS_KEY_NUDGE_ACTIVE_HOURS_TIMEZONE = "nudgeActiveHoursTimezone"

NUDGE_MESSAGES: dict[int, str] = {
    1: (
        "Hey! Quick ideas for your week:\n"
        '• "Make me a group about cooking" — I\'ll set it up, then give you a link to invite your friends\n'
        '• "Tell me the weather every morning at 8am"\n'
        '• "Send me a daily digest with breaking news about AI"\n\n'
        "Just reply with any of these or ask me anything 🌱"
    ),
    2: (
        "A few things I can do for you:\n"
        "• Create a group — tell me what you're into and I'll set it up. Invite your friends and get a conversation going.\n"
        '• Run recurring jobs — "track AAPL and tell me if it moves more than 5%", "summarize the news every morning", "help me track my meals"\n'
        "• Watch a channel and ping you when something important comes up\n\n"
        "What sounds useful?"
    ),
    3: (
        "Still here! Here's what I can do:\n\n"
        "**Groups** — I'll create groups for you, help brainstorm ideas, and manage permissions. Invite your friends and hang out.\n"
        "**Recurring jobs** — daily weather, news alerts, meal tracking, stock tracking, scheduled reminders — just tell me what and when.\n"
        "**Catch up** — summarize threads, watch channels for keywords\n"
        "**Research** — web search, fact-check, find recipes/flights/etc.\n\n"
        "Just say the word 🌱"
    ),
}

_TIME_RE = re.compile(r"^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$")
_DECIMAL_NUMBER_RE = re.compile(
    r"^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$"
)
_LOCAL_TIMEZONE = "local"


@dataclass
class NudgeSettingsSnapshot:
    last_owner_message_at: Any = None
    last_owner_message_date: Any = None
    pending_nudge_raw: Any = None
    last_nudge_stage: Any = None
    active_hours_start: Any = None
    active_hours_end: Any = None
    active_hours_timezone: Any = None

    @classmethod
    def from_bucket(cls, bucket: Mapping[str, Any]) -> "NudgeSettingsSnapshot":
        return cls(
            last_owner_message_at=bucket.get(SETTINGS_KEY_LAST_OWNER_MESSAGE_AT),
            last_owner_message_date=bucket.get(SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE),
            pending_nudge_raw=bucket.get(SETTINGS_KEY_PENDING_NUDGE),
            last_nudge_stage=bucket.get(SETTINGS_KEY_LAST_NUDGE_STAGE),
            active_hours_start=bucket.get(SETTINGS_KEY_NUDGE_ACTIVE_HOURS_START),
            active_hours_end=bucket.get(SETTINGS_KEY_NUDGE_ACTIVE_HOURS_END),
            active_hours_timezone=bucket.get(SETTINGS_KEY_NUDGE_ACTIVE_HOURS_TIMEZONE),
        )

    def apply(self, key: str, value: Any) -> bool:
        fields = {
            SETTINGS_KEY_LAST_OWNER_MESSAGE_AT: "last_owner_message_at",
            SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE: "last_owner_message_date",
            SETTINGS_KEY_PENDING_NUDGE: "pending_nudge_raw",
            SETTINGS_KEY_LAST_NUDGE_STAGE: "last_nudge_stage",
            SETTINGS_KEY_NUDGE_ACTIVE_HOURS_START: "active_hours_start",
            SETTINGS_KEY_NUDGE_ACTIVE_HOURS_END: "active_hours_end",
            SETTINGS_KEY_NUDGE_ACTIVE_HOURS_TIMEZONE: "active_hours_timezone",
        }
        field = fields.get(key)
        if field is None:
            return False
        setattr(self, field, value)
        return True


@dataclass(frozen=True)
class ActiveHoursBaseline:
    start: Optional[str] = None
    end: Optional[str] = None
    timezone: Optional[str] = None
    user_timezone: Optional[str] = None


@dataclass(frozen=True)
class ActiveHours:
    start: str
    end: str
    timezone: str


@dataclass(frozen=True)
class PendingNudge:
    sent_at: float
    stage: int
    owner_ship: str
    account_id: str
    content: Optional[str] = None

    def to_settings_value(self) -> str:
        value: dict[str, Any] = {
            "sentAt": self.sent_at,
            "stage": self.stage,
            "ownerShip": self.owner_ship,
            "accountId": self.account_id,
        }
        if self.content is not None:
            value["content"] = self.content
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

    def to_wire(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "sentAt": self.sent_at,
            "stage": self.stage,
            "ownerShip": self.owner_ship,
            "accountId": self.account_id,
        }
        if self.content is not None:
            value["content"] = self.content
        return value


def days_between(earlier_ms: Any, later_ms: Any) -> int:
    if isinstance(earlier_ms, bool) or isinstance(later_ms, bool):
        return 0
    if not isinstance(earlier_ms, (int, float)) or not isinstance(later_ms, (int, float)):
        return 0
    if not math.isfinite(earlier_ms) or not math.isfinite(later_ms):
        return 0
    difference = later_ms - earlier_ms
    return max(0, math.floor(difference / 86_400_000)) if difference > 0 else 0


def compute_target_stage(days_idle: Any) -> Optional[int]:
    if not isinstance(days_idle, (int, float)) or isinstance(days_idle, bool):
        return None
    if days_idle < 7:
        return None
    if days_idle < 14:
        return 1
    if days_idle < 30:
        return 2
    return 3


def parse_active_hours_time(raw: Any, allow_24: bool = False) -> Optional[int]:
    if not isinstance(raw, str):
        return None
    match = _TIME_RE.fullmatch(raw.strip())
    if match is None:
        return None
    if raw.strip() == "24:00":
        return 24 * 60 if allow_24 else None
    assert match.group(1) is not None and match.group(2) is not None
    return int(match.group(1)) * 60 + int(match.group(2))


def _valid_time(raw: Any, allow_24: bool) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    return value if value and parse_active_hours_time(value, allow_24) is not None else None


def _valid_zone(raw: Any, user_timezone: Optional[str]) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    if value == "local":
        return _LOCAL_TIMEZONE
    if value == "user":
        return _valid_zone(user_timezone, None) or _LOCAL_TIMEZONE
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        return None
    return value


def resolve_active_hours(
    snapshot: NudgeSettingsSnapshot,
    baseline: ActiveHoursBaseline | Mapping[str, Any] | None = None,
) -> ActiveHours:
    if baseline is None:
        source = ActiveHoursBaseline()
    elif isinstance(baseline, ActiveHoursBaseline):
        source = baseline
    else:
        source = ActiveHoursBaseline(
            start=baseline.get("start"),
            end=baseline.get("end"),
            timezone=baseline.get("timezone"),
            user_timezone=baseline.get("user_timezone"),
        )
    start = _valid_time(snapshot.active_hours_start, False) or _valid_time(source.start, False) or DEFAULT_ACTIVE_HOURS_START
    end = _valid_time(snapshot.active_hours_end, True) or _valid_time(source.end, True) or DEFAULT_ACTIVE_HOURS_END
    tz = _valid_zone(snapshot.active_hours_timezone, source.user_timezone)
    tz = tz or _valid_zone(source.timezone, source.user_timezone)
    tz = tz or DEFAULT_ACTIVE_HOURS_TIMEZONE
    return ActiveHours(start=start, end=end, timezone=tz)


def in_active_hours(now_ms: Any, active_hours: ActiveHours) -> bool:
    start = parse_active_hours_time(active_hours.start, False)
    end = parse_active_hours_time(active_hours.end, True)
    if start is None or end is None:
        return True
    if start == end:
        return False
    if not isinstance(now_ms, (int, float)) or isinstance(now_ms, bool) or not math.isfinite(now_ms):
        return True
    try:
        if active_hours.timezone == _LOCAL_TIMEZONE:
            current = datetime.fromtimestamp(now_ms / 1000).astimezone()
        else:
            current = datetime.fromtimestamp(now_ms / 1000, ZoneInfo(active_hours.timezone))
        now = current.hour * 60 + current.minute
    except Exception:
        return True
    if end > start:
        return start <= now < end
    return now >= start or now < end


def _parse_date_at_utc_midnight(raw: Any) -> Optional[int]:
    if not isinstance(raw, str):
        return None
    try:
        parsed = datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return int(parsed.timestamp() * 1000)


def resolve_last_owner_instant(
    shadow: Optional[tuple[int, str]], snapshot: NudgeSettingsSnapshot
) -> Optional[int]:
    if shadow is not None:
        at = shadow[0]
        if isinstance(at, (int, float)) and not isinstance(at, bool) and math.isfinite(at):
            return int(at)
    at = snapshot.last_owner_message_at
    if isinstance(at, (int, float)) and not isinstance(at, bool) and math.isfinite(at):
        return int(at)
    return _parse_date_at_utc_midnight(snapshot.last_owner_message_date)


def owner_activity_from_snapshot(
    snapshot: NudgeSettingsSnapshot,
) -> Optional[tuple[int, str]]:
    at = snapshot.last_owner_message_at
    if isinstance(at, (int, float)) and not isinstance(at, bool) and math.isfinite(at):
        instant = int(at)
        date = snapshot.last_owner_message_date
        if not isinstance(date, str) or _parse_date_at_utc_midnight(date) is None:
            date = datetime.fromtimestamp(instant / 1000, timezone.utc).date().isoformat()
        return instant, date
    date_instant = _parse_date_at_utc_midnight(snapshot.last_owner_message_date)
    if date_instant is None:
        return None
    return date_instant, str(snapshot.last_owner_message_date)


def should_send(
    target_stage: Optional[int], last_stage: int, owner_ship: str, in_hours: bool
) -> bool:
    return bool(target_stage is not None and owner_ship and in_hours and target_stage > last_stage)


def parse_pending_nudge(raw: Any) -> Optional[PendingNudge]:
    if not raw:
        return None
    value = raw
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    if not isinstance(value, Mapping):
        return None
    sent_at = value.get("sentAt")
    stage = value.get("stage")
    owner_ship = value.get("ownerShip")
    account_id = value.get("accountId")
    if (
        not isinstance(sent_at, (int, float))
        or isinstance(sent_at, bool)
        or not math.isfinite(sent_at)
        or stage not in (1, 2, 3)
        or isinstance(stage, bool)
        or not isinstance(owner_ship, str)
        or not isinstance(account_id, str)
    ):
        return None
    content = value.get("content")
    return PendingNudge(
        sent_at=sent_at,
        stage=stage,
        owner_ship=owner_ship,
        account_id=account_id,
        content=content if isinstance(content, str) else None,
    )


def parse_last_nudge_stage(raw: Any) -> Optional[int]:
    if isinstance(raw, bool):
        return None
    value: Any = raw
    if isinstance(raw, str):
        text = raw.strip()
        if not text or not _DECIMAL_NUMBER_RE.fullmatch(text):
            return None
        try:
            value = float(text)
        except ValueError:
            return None
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return int(value) if math.isfinite(value) and value in (1, 2, 3) else None


def is_nudge_eligible(
    nudge: PendingNudge,
    now_ms: int | float,
    window_ms: int = DEFAULT_ATTRIBUTION_WINDOW_MS,
) -> bool:
    return now_ms - nudge.sent_at <= window_ms


class Poke(Protocol):
    def __call__(
        self,
        app: str,
        mark: str,
        payload: Any,
    ) -> Awaitable[Any]: ...


@dataclass
class _QueuedWrite:
    payload: Any
    completed: bool = False


class _PersistenceQueue:
    def __init__(
        self,
        *,
        poke: Poke,
        error: Callable[[str], None] | None = None,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
    ) -> None:
        self._poke = poke
        self._error = error or (lambda message: logger.warning("%s", message))
        self._sleep = sleep
        self._items: Deque[Any] = deque()
        self._task: Optional[asyncio.Task[None]] = None

    def _start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._drain())

    async def _drain(self) -> None:
        while self._items:
            item = self._items[0]
            try:
                completed = await self._persist(item)
            except asyncio.CancelledError:
                raise
            except ConnectionError:
                await self._sleep(0.25)
                continue
            except Exception as exc:
                self._error(f"[tlon] nudge settings persistence failed: {exc}")
                completed = True
            if completed:
                self._items.popleft()

    async def _persist(self, item: Any) -> bool:
        raise NotImplementedError

    def _new_write(self, key: str, operation: str, value: Any = None) -> _QueuedWrite:
        payload = (
            settings_put_entry(key, value)
            if operation == "put-entry"
            else settings_del_entry(key)
        )
        return _QueuedWrite(payload=payload)

    async def _poke_write(self, write: _QueuedWrite) -> Any:
        return await self._poke("settings", "settings-event", write.payload)

    async def flush(self, *, final: bool = False) -> None:
        task = self._task
        if task is not None and not task.done():
            if final:
                # The resolver remains available during adapter teardown. If it
                # is already gone, discard after one terminal attempt.
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=2)
                except asyncio.TimeoutError:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                    self._abandon()
            else:
                await task
        if final and self._items:
            self._abandon()

    def _abandon(self) -> None:
        self._items.clear()
        self._error("[tlon] abandoning retained nudge settings writes at shutdown")


class OwnerActivityPersistence(_PersistenceQueue):
    def enqueue(self, at_ms: int, iso_date: str, clear_stage: bool) -> None:
        self._items.append(
            (
                self._new_write(
                    SETTINGS_KEY_LAST_OWNER_MESSAGE_AT, "put-entry", at_ms
                ),
                self._new_write(
                    SETTINGS_KEY_LAST_OWNER_MESSAGE_DATE, "put-entry", iso_date
                ),
                self._new_write(SETTINGS_KEY_LAST_NUDGE_STAGE, "del-entry")
                if clear_stage
                else None,
            )
        )
        self._start()

    def enqueue_stage_clear(self) -> None:
        """Append the runner's race repair after already-queued activity puts."""
        self._items.append(
            (None, None, self._new_write(SETTINGS_KEY_LAST_NUDGE_STAGE, "del-entry"))
        )
        self._start()

    async def _persist(
        self,
        item: tuple[
            Optional[_QueuedWrite], Optional[_QueuedWrite], Optional[_QueuedWrite]
        ],
    ) -> bool:
        at_write, date_write, stage_write = item
        activity_writes = [
            write
            for write in (at_write, date_write)
            if write is not None and not write.completed
        ]
        writes = await asyncio.gather(
            *(self._poke_write(write) for write in activity_writes),
            return_exceptions=True,
        )
        for write, result in zip(activity_writes, writes):
            if not isinstance(result, BaseException):
                write.completed = True
        terminal = next(
            (result for result in writes if isinstance(result, TlonTerminalActionError)),
            None,
        )
        if terminal is not None:
            self._error(
                f"[tlon] nudge activity write rejected; retaining stage to prevent duplicates: {terminal}"
            )
            return True
        transient = next(
            (result for result in writes if isinstance(result, ConnectionError)), None
        )
        if transient is not None:
            raise transient
        if any(isinstance(result, BaseException) for result in writes):
            self._error("[tlon] nudge activity write failed; retaining stage to prevent duplicates")
            return True
        if stage_write is not None and not stage_write.completed:
            try:
                await self._poke_write(stage_write)
                stage_write.completed = True
            except TlonTerminalActionError as exc:
                self._error(
                    f"[tlon] nudge stage clear rejected; retaining stage: {exc}"
                )
                return True
        return True


class PendingNudgePersistence(_PersistenceQueue):
    def enqueue(self, nudge: Optional[PendingNudge]) -> None:
        self._items.append(
            self._new_write(
                SETTINGS_KEY_PENDING_NUDGE,
                "del-entry" if nudge is None else "put-entry",
                None if nudge is None else nudge.to_settings_value(),
            )
        )
        self._start()

    async def _persist(self, write: _QueuedWrite) -> bool:
        try:
            await self._poke_write(write)
        except TlonTerminalActionError as exc:
            self._error(f"[tlon] nudge pending write rejected: {exc}")
            return True
        write.completed = True
        return True


class TlonNudgeScheduler:
    def __init__(
        self,
        *,
        enabled: bool,
        owner_ship: str,
        bot_ship: str,
        interval_ms: int = DEFAULT_NUDGE_TICK_INTERVAL_MS,
        get_snapshot: Callable[[], NudgeSettingsSnapshot],
        settings_ready: Callable[[], bool],
        get_activity: Callable[[], Optional[tuple[int, str]]],
        set_activity: Callable[[Optional[tuple[int, str]]], None],
        get_stage: Callable[[], int],
        set_stage: Callable[[int], None],
        get_active_hours_baseline: Callable[[], ActiveHoursBaseline],
        get_pending: Callable[[], Optional[PendingNudge]],
        set_pending: Callable[[Optional[PendingNudge]], None],
        send_dm: Callable[[str, int], Awaitable[Any]],
        activity_persistence: OwnerActivityPersistence,
        pending_persistence: PendingNudgePersistence,
        poke: Poke,
        telemetry: Any = None,
        now_ms: Callable[[], int] | None = None,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
        log: Callable[[str], None] | None = None,
        error: Callable[[str], None] | None = None,
    ) -> None:
        self.enabled = enabled
        self.owner_ship = owner_ship
        self.bot_ship = bot_ship
        self.interval_ms = interval_ms if interval_ms > 0 else DEFAULT_NUDGE_TICK_INTERVAL_MS
        self._get_snapshot = get_snapshot
        self._settings_ready = settings_ready
        self._get_activity = get_activity
        self._set_activity = set_activity
        self._get_stage = get_stage
        self._set_stage = set_stage
        self._get_baseline = get_active_hours_baseline
        self._get_pending = get_pending
        self._set_pending = set_pending
        self._send_dm = send_dm
        self._activity_persistence = activity_persistence
        self._pending_persistence = pending_persistence
        self._poke = poke
        self._telemetry = telemetry
        self._now_ms = now_ms or (lambda: int(time.time() * 1000))
        self._sleep = sleep
        self._log = log or (lambda message: logger.info("%s", message))
        self._error = error or (lambda message: logger.warning("%s", message))
        self._timer_task: Optional[asyncio.Task[None]] = None
        self._active_tick: Optional[asyncio.Task[None]] = None
        self._ticking = False

    @property
    def is_running(self) -> bool:
        return self._ticking

    def start(self) -> None:
        if self._timer_task is None or self._timer_task.done():
            self._timer_task = asyncio.create_task(self._run_timer())

    async def stop(self) -> None:
        if self._timer_task is not None:
            self._timer_task.cancel()
            try:
                await self._timer_task
            except asyncio.CancelledError:
                pass
            self._timer_task = None
        if self._active_tick is not None:
            await self._active_tick

    async def _run_timer(self) -> None:
        await self._sleep(0)
        deadline = time.monotonic()
        while True:
            self._start_tick()
            deadline += self.interval_ms / 1000
            while deadline <= time.monotonic():
                deadline += self.interval_ms / 1000
            await self._sleep(deadline - time.monotonic())

    def _start_tick(self) -> Optional[asyncio.Task[None]]:
        if self._ticking or (
            self._active_tick is not None and not self._active_tick.done()
        ):
            return None
        task = asyncio.create_task(self._guarded_tick())
        self._active_tick = task
        task.add_done_callback(self._clear_active_tick)
        return task

    def _clear_active_tick(self, task: asyncio.Task[None]) -> None:
        if self._active_tick is task:
            self._active_tick = None

    async def tick_now(self) -> None:
        task = self._start_tick()
        if task is not None:
            await task

    async def _guarded_tick(self) -> None:
        if self._ticking:
            return
        self._ticking = True
        try:
            await self.tick()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._error(f"[tlon] nudge tick failed: {exc}")
        finally:
            self._ticking = False

    def _activity_advanced(self, threshold: int) -> Optional[tuple[int, str]]:
        activity = resolve_last_owner_instant(self._get_activity(), self._get_snapshot())
        if activity is not None and activity > threshold:
            shadow = self._get_activity()
            if shadow is not None:
                return shadow
            return (
                activity,
                datetime.fromtimestamp(activity / 1000, timezone.utc).date().isoformat(),
            )
        return None

    async def tick(self) -> None:
        if not self.enabled or not self.owner_ship or not self._settings_ready():
            return
        snapshot = self._get_snapshot()
        if not in_active_hours(self._now_ms(), resolve_active_hours(snapshot, self._get_baseline())):
            return
        last_activity = resolve_last_owner_instant(self._get_activity(), snapshot)
        if last_activity is None:
            return
        target_stage = compute_target_stage(days_between(last_activity, self._now_ms()))
        if not should_send(target_stage, self._get_stage(), self.owner_ship, True):
            return
        assert target_stage is not None
        try:
            await self._poke(
                "settings",
                "settings-event",
                settings_put_entry(SETTINGS_KEY_LAST_NUDGE_STAGE, target_stage),
            )
        except Exception as exc:
            self._error(f"[tlon] nudge stage persistence failed: {exc}")
            return
        raced_activity = self._activity_advanced(last_activity)
        if raced_activity is not None:
            self._set_stage(0)
            self._activity_persistence.enqueue_stage_clear()
            return
        self._set_stage(target_stage)
        sent_at = int(self._now_ms())
        result: Any = None
        try:
            result = await self._send_dm(NUDGE_MESSAGES[target_stage], sent_at)
        except Exception as exc:
            self._error(f"[tlon] nudge send failed: {exc}")
        success = bool(getattr(result, "success", False))
        message_id = format_post_id(self.bot_ship, sent_at) if success else None
        try:
            if self._telemetry is not None:
                self._telemetry.nudge_sent(
                    stage=target_stage,
                    target=self.owner_ship,
                    success=success,
                    message_id=message_id,
                    sent_at_ms=sent_at if success else None,
                )
        except Exception as exc:
            self._error(f"[tlon] nudge telemetry failed: {exc}")
        if not success or self._activity_advanced(last_activity) is not None:
            return
        nudge = PendingNudge(
            sent_at=sent_at,
            stage=target_stage,
            owner_ship=self.owner_ship,
            account_id=NUDGE_ACCOUNT_ID,
            content=NUDGE_MESSAGES[target_stage],
        )
        self._set_pending(nudge)
        self._pending_persistence.enqueue(nudge)
