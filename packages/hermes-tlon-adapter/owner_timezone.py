"""`set_timezone`: the owner's own choice of the bot's timezone.

The Hermes counterpart of the OpenClaw plugin's tool
(`packages/openclaw/src/owner-timezone-tool.ts`, TLON-6882). Hermes reads its
zone from `HERMES_TIMEZONE`, which the gateway sets at startup from
config.yaml's `timezone` (hosting renders that from `TLON_TIMEZONE`), and
caches it in `hermes_time`. Cron expressions, message timestamps and the
system prompt's date all read that cache.

The tool records the choice in the ship's %settings store under
`ownerTimezone`, so it survives restarts and redeploys, and applies it to the
running gateway at once. The adapter applies the same key on every settings
load and live update.
"""

from __future__ import annotations

import json
import os
import re
import threading
from collections.abc import Mapping
from datetime import datetime, timezone as dt_timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from .tlon_api import CommandRunner, TlonCLI, TlonConfig
from .tlon_tool import _get_session_env

SETTINGS_KEY_OWNER_TIMEZONE = "ownerTimezone"
HERMES_TIMEZONE_ENV = "HERMES_TIMEZONE"
MAX_TIMEZONE_LENGTH = 64

# Region/City names plus UTC, as OpenClaw's tool accepts. Excludes
# abbreviations and offsets, which zoneinfo may know (EST) but which don't
# follow daylight saving or name a place.
_IANA_NAME = re.compile(r"UTC|[A-Za-z]+(?:/[A-Za-z0-9_+-]+)+")

SET_TIMEZONE_TOOL_DESCRIPTION = (
    "Set the owner's timezone, which the bot uses for its clock and for "
    "scheduling. Takes an IANA zone name such as America/Los_Angeles or "
    "Asia/Tokyo. Owner-only. When the owner says where they are, that they "
    "moved or are traveling, or that your times are off, call it with the "
    "IANA zone for that place. Ask only if the place spans several zones."
)

SET_TIMEZONE_TOOL_SCHEMA = {
    "name": "set_timezone",
    "description": SET_TIMEZONE_TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "timezone": {
                "type": "string",
                "maxLength": MAX_TIMEZONE_LENGTH,
                "description": (
                    'IANA timezone name, for example "Asia/Tokyo" or '
                    '"Europe/Berlin". Not an abbreviation (PST) or offset '
                    "(+09:00)."
                ),
            },
        },
        "required": ["timezone"],
        "additionalProperties": False,
    },
}


def valid_timezone(raw: str) -> str:
    """`raw` trimmed, once it names a known IANA zone; raises ValueError otherwise."""
    name = raw.strip()
    if len(name) > MAX_TIMEZONE_LENGTH or not _IANA_NAME.fullmatch(name):
        raise ValueError(
            f'"{name}" is not an IANA timezone name; use one like Asia/Tokyo'
        )
    try:
        ZoneInfo(name)
    except (ValueError, LookupError):
        raise ValueError(f'Unknown timezone "{name}"; use one like Asia/Tokyo') from None
    return name


def settings_timezone(value: Any) -> Optional[str]:
    """The zone an `ownerTimezone` entry names, or None when absent or invalid."""
    if not isinstance(value, str):
        return None
    try:
        return valid_timezone(value)
    except ValueError:
        return None


_UNSET: Any = object()
_apply_lock = threading.Lock()
# HERMES_TIMEZONE as it stood before an owner choice first applied: the
# config.yaml zone (or none), which a deleted ownerTimezone reverts to.
_baseline: Any = _UNSET


def apply_owner_timezone(name: Optional[str]) -> None:
    """Point the running gateway's clock at `name`, or back at its boot zone.

    Called from the tool's worker thread and the adapter's event loop, so the
    environment write and cache reset happen under a lock.
    """
    global _baseline
    with _apply_lock:
        if _baseline is _UNSET:
            _baseline = os.environ.get(HERMES_TIMEZONE_ENV)
        target = name or _baseline
        if os.environ.get(HERMES_TIMEZONE_ENV) == target:
            return
        if target is None:
            os.environ.pop(HERMES_TIMEZONE_ENV, None)
        else:
            os.environ[HERMES_TIMEZONE_ENV] = target
        # Imported here so the module loads without Hermes, as in unit tests.
        import hermes_time

        hermes_time.reset_cache()


def describe_now(name: str, now: datetime) -> str:
    """e.g. "Saturday, October 17, 2026 at 03:00 GMT+09:00", as OpenClaw words it."""
    local = now.astimezone(ZoneInfo(name))
    offset = local.utcoffset()
    zone = "GMT"
    if offset:
        minutes = int(offset.total_seconds() // 60)
        sign = "+" if minutes > 0 else "-"
        zone += f"{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}"
    return (
        f"{local:%A, %B} {local.day}, {local.year} at {local:%H:%M} {zone}"
    )


def _json(data: Mapping[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


async def execute_set_timezone_tool(
    params: Mapping[str, Any],
    *,
    config: Optional[TlonConfig] = None,
    runner: Optional[CommandRunner] = None,
    now: Optional[datetime] = None,
) -> str:
    try:
        name = valid_timezone(str(params.get("timezone") or ""))
    except ValueError as exc:
        return _json({"success": False, "error": str(exc)})

    # Lazy import keeps this module importable standalone (no cycle at load).
    from .telemetry import cli_context, get_active_telemetry

    telemetry = get_active_telemetry()
    cli = TlonCLI(
        config or TlonConfig.from_env(),
        runner=runner,
        observer=telemetry.observe_cli if telemetry is not None else None,
    )
    with cli_context(
        "model_tool",
        conversation=_get_session_env("HERMES_SESSION_CHAT_ID", ""),
    ):
        result = await cli.run_command(
            ("settings", "set", SETTINGS_KEY_OWNER_TIMEZONE, json.dumps(name))
        )
    if not result.success:
        return _json(
            {
                "success": False,
                "error": (
                    "Could not save the timezone; nothing changed: "
                    + (result.error or result.stderr.strip() or "tlon settings set failed")
                ),
            }
        )

    apply_owner_timezone(name)
    at = now or datetime.now(dt_timezone.utc)
    return _json(
        {
            "success": True,
            "timezone": name,
            "result": (
                f"Timezone set to {name}. It is now {describe_now(name, at)} "
                "there. Your clock and new schedules use it from now on, "
                "including anything you schedule in this turn; give cron "
                "timestamps this zone's offset."
            ),
        }
    )


async def handle_set_timezone_tool(params: Mapping[str, Any], **_kwargs: Any) -> str:
    return await execute_set_timezone_tool(params)
