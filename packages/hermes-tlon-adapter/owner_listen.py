"""Owner-listen state, settings-store codec, and control-plane command.

Ported from the OpenClaw Tlon plugin. The owner can be heard without a
mention in channels where owner-listen is effective: channels hosted by the
owner or bot ship are on by default; any other channel can be opted in with
``/owner-listen on``.

State persists in the ship's %settings store under the same desk, bucket, and
entry keys as OpenClaw, so existing OpenClaw deployments carry over:

- ``ownerListenEnabled`` (bool): global toggle, default true
- ``ownerListenDisabledChannels`` (list): owned channels opted out
- ``ownerListenEnabledChannels`` (list): non-owned channels opted in
  (additive Hermes key; OpenClaw ignores it)
- ``groupChannels`` (list): extra monitored channels, shared with OpenClaw
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Optional

from .tlon_api import normalize_ship

SETTINGS_DESK = "moltbot"
SETTINGS_BUCKET = "tlon"
SETTINGS_KEY_ENABLED = "ownerListenEnabled"
SETTINGS_KEY_DISABLED_CHANNELS = "ownerListenDisabledChannels"
SETTINGS_KEY_ENABLED_CHANNELS = "ownerListenEnabledChannels"
SETTINGS_KEY_GROUP_CHANNELS = "groupChannels"

NEST_PREFIXES = frozenset({"chat", "heap", "diary"})

OWNER_LISTEN_USAGE = (
    "Usage: /owner-listen [on|off|status|list] [<channel-nest>] | "
    "/owner-listen all [on|off]"
)

_COMMAND_RE = re.compile(r"^/owner-listen(?:\s|$)", re.IGNORECASE)


def _canonical_ship(ship: str) -> str:
    return normalize_ship(ship).lower()


def canonicalize_nest(raw: str) -> Optional[str]:
    """Canonical nest form: lowercase prefix and host, channel name unchanged."""
    parts = str(raw or "").strip().split("/")
    if len(parts) != 3:
        return None
    prefix, host, name = parts
    if prefix.lower() not in NEST_PREFIXES or not host.strip() or not name:
        return None
    return f"{prefix.lower()}/{_canonical_ship(host)}/{name}"


def is_owned_channel(nest: str, *, owner_ship: str, bot_ship: str) -> bool:
    canonical = canonicalize_nest(nest)
    if canonical is None:
        return False
    host = canonical.split("/", 2)[1]
    owners = {_canonical_ship(owner_ship), _canonical_ship(bot_ship)} - {""}
    return host in owners


@dataclass
class OwnerListenState:
    enabled: bool = True
    disabled_channels: set[str] = field(default_factory=set)
    enabled_channels: set[str] = field(default_factory=set)


def owner_listen_active(
    state: OwnerListenState,
    nest: str,
    *,
    owner_ship: str,
    bot_ship: str,
) -> bool:
    if not state.enabled or not str(owner_ship or "").strip():
        return False
    canonical = canonicalize_nest(nest)
    if canonical is None:
        return False
    if canonical in state.enabled_channels:
        return True
    if canonical in state.disabled_channels:
        return False
    return is_owned_channel(canonical, owner_ship=owner_ship, bot_ship=bot_ship)


def canonical_nest_set(values: Any) -> set[str]:
    if isinstance(values, str):
        values = values.split(",")
    if not isinstance(values, Iterable):
        return set()
    result: set[str] = set()
    for value in values:
        canonical = canonicalize_nest(str(value or ""))
        if canonical is not None:
            result.add(canonical)
    return result


def parse_settings_bucket(payload: Any) -> dict[str, Any]:
    """Extract the tlon bucket from a %settings scry response.

    The wrapper key follows the scry path: ``/settings/all`` responds with
    ``{"all": {desk: {bucket: entries}}}`` and the desk-scoped
    ``/settings/desk/<desk>`` responds with ``{"desk": {bucket: entries}}``.
    Both are accepted.
    """
    if not isinstance(payload, Mapping):
        return {}
    all_data = payload.get("all")
    if isinstance(all_data, Mapping):
        desk = all_data.get(SETTINGS_DESK)
    else:
        desk = payload.get("desk")
    if not isinstance(desk, Mapping):
        return {}
    bucket = desk.get(SETTINGS_BUCKET)
    return dict(bucket) if isinstance(bucket, Mapping) else {}


def owner_listen_state_from_settings(
    bucket: Mapping[str, Any],
    *,
    defaults: OwnerListenState,
) -> OwnerListenState:
    """Build state from a settings bucket, falling back per key to defaults."""
    enabled = bucket.get(SETTINGS_KEY_ENABLED)
    if not isinstance(enabled, bool):
        enabled = defaults.enabled

    if SETTINGS_KEY_DISABLED_CHANNELS in bucket:
        disabled = canonical_nest_set(bucket.get(SETTINGS_KEY_DISABLED_CHANNELS))
    else:
        disabled = set(defaults.disabled_channels)

    if SETTINGS_KEY_ENABLED_CHANNELS in bucket:
        enabled_channels = canonical_nest_set(bucket.get(SETTINGS_KEY_ENABLED_CHANNELS))
    else:
        enabled_channels = set(defaults.enabled_channels)

    return OwnerListenState(
        enabled=enabled,
        disabled_channels=disabled,
        enabled_channels=enabled_channels,
    )


def settings_group_channels(bucket: Mapping[str, Any]) -> set[str]:
    return canonical_nest_set(bucket.get(SETTINGS_KEY_GROUP_CHANNELS))


def settings_put_entry(key: str, value: Any) -> dict[str, Any]:
    """JSON payload for a %settings put-entry poke (mark settings-event)."""
    return {
        "put-entry": {
            "desk": SETTINGS_DESK,
            "bucket-key": SETTINGS_BUCKET,
            "entry-key": key,
            "value": value,
        }
    }


@dataclass(frozen=True)
class SettingsEvent:
    """A put or delete for one entry in our settings bucket.

    ``value`` is ``None`` for deletions; apply treats invalid-typed values the
    same as deletions (the override reverts to defaults), matching OpenClaw.
    """

    key: str
    value: Any = None


def parse_settings_event(raw: Any) -> Optional[SettingsEvent]:
    """Parse a %settings subscription event for our desk/bucket."""
    if not isinstance(raw, Mapping):
        return None
    event: Mapping[str, Any] = raw
    wrapper = event.get("settings-event")
    if isinstance(wrapper, Mapping):
        event = wrapper

    put = event.get("put-entry")
    if isinstance(put, Mapping):
        if put.get("desk") != SETTINGS_DESK or put.get("bucket-key") != SETTINGS_BUCKET:
            return None
        key = str(put.get("entry-key") or "")
        return SettingsEvent(key=key, value=put.get("value")) if key else None

    deleted = event.get("del-entry")
    if isinstance(deleted, Mapping):
        if deleted.get("desk") != SETTINGS_DESK or deleted.get("bucket-key") != SETTINGS_BUCKET:
            return None
        key = str(deleted.get("entry-key") or "")
        return SettingsEvent(key=key) if key else None

    return None


def _nest_set_or_default(value: Any, default: set[str]) -> set[str]:
    if isinstance(value, (list, tuple)):
        return canonical_nest_set(value)
    return set(default)


def apply_owner_listen_settings_event(
    state: OwnerListenState,
    event: SettingsEvent,
    *,
    defaults: OwnerListenState,
) -> bool:
    """Apply a settings event to owner-listen state; True if state changed."""
    if event.key == SETTINGS_KEY_ENABLED:
        enabled = event.value if isinstance(event.value, bool) else defaults.enabled
        changed = state.enabled != enabled
        state.enabled = enabled
        return changed
    if event.key == SETTINGS_KEY_DISABLED_CHANNELS:
        disabled = _nest_set_or_default(event.value, defaults.disabled_channels)
        changed = state.disabled_channels != disabled
        state.disabled_channels = disabled
        return changed
    if event.key == SETTINGS_KEY_ENABLED_CHANNELS:
        enabled_channels = _nest_set_or_default(event.value, defaults.enabled_channels)
        changed = state.enabled_channels != enabled_channels
        state.enabled_channels = enabled_channels
        return changed
    return False


def is_owner_listen_command(text: str) -> bool:
    return bool(_COMMAND_RE.match(str(text or "").strip()))


def owner_listen_command_args(text: str) -> str:
    return _COMMAND_RE.sub("", str(text or "").strip(), count=1).strip()


@dataclass(frozen=True)
class OwnerListenCommandOutcome:
    reply: str
    settings_changes: dict[str, Any] = field(default_factory=dict)
    monitor_nest: Optional[str] = None


def _channel_detail(state: OwnerListenState, canonical: str, owned: bool) -> str:
    if not state.enabled:
        return "global is off"
    if canonical in state.enabled_channels:
        return "explicitly enabled"
    if canonical in state.disabled_channels:
        return "channel is muted"
    if owned:
        return "active"
    return "not enabled for this channel"


def _channel_effective(state: OwnerListenState, canonical: str, owned: bool) -> bool:
    if not state.enabled:
        return False
    if canonical in state.enabled_channels:
        return True
    if canonical in state.disabled_channels:
        return False
    return owned


def apply_owner_listen_command(
    state: OwnerListenState,
    raw_args: str,
    *,
    ctx_nest: Optional[str],
    owner_ship: str,
    bot_ship: str,
    monitored_channels: frozenset[str] | set[str] = frozenset(),
) -> OwnerListenCommandOutcome:
    """Apply an /owner-listen command to state.

    Mutates ``state`` and reports the settings entries that changed so the
    caller can persist them. ``monitor_nest`` is set when a channel was just
    enabled but is not currently monitored.
    """
    args = [part for part in str(raw_args or "").split() if part]
    lowered = [part.lower() for part in args]
    changes: dict[str, Any] = {}

    # Global kill switch — accept either order: "all on", "on all", bare "all".
    if "all" in lowered:
        sub = next((part for part in lowered if part != "all"), "")
        if not sub:
            extras = []
            if state.disabled_channels:
                extras.append(f"{len(state.disabled_channels)} channel(s) muted")
            if state.enabled_channels:
                extras.append(f"{len(state.enabled_channels)} channel(s) explicitly enabled")
            suffix = f" {'; '.join(extras)}." if extras else ""
            return OwnerListenCommandOutcome(
                reply=f"Global owner-listen: {'on' if state.enabled else 'off'}.{suffix}"
            )
        if sub not in ("on", "off"):
            return OwnerListenCommandOutcome(reply="Usage: /owner-listen all [on|off]")
        state.enabled = sub == "on"
        changes[SETTINGS_KEY_ENABLED] = state.enabled
        return OwnerListenCommandOutcome(
            reply=f"Global owner-listen is now {'on' if state.enabled else 'off'}.",
            settings_changes=changes,
        )

    if lowered[:1] == ["list"]:
        head = f"Global owner-listen: {'on' if state.enabled else 'off'}."
        lines = [head]
        if state.disabled_channels:
            muted = "\n".join(f"• {nest}" for nest in sorted(state.disabled_channels))
            lines.append(f"Muted channels:\n{muted}")
        if state.enabled_channels:
            enabled = "\n".join(f"• {nest}" for nest in sorted(state.enabled_channels))
            lines.append(f"Explicitly enabled channels:\n{enabled}")
        if not state.disabled_channels and not state.enabled_channels:
            lines.append("No per-channel overrides.")
        return OwnerListenCommandOutcome(reply="\n".join(lines))

    action = lowered[0] if lowered else ""
    explicit_nest = args[1] if len(args) > 1 else None
    target = explicit_nest or ctx_nest
    if not target:
        return OwnerListenCommandOutcome(
            reply=(
                "Usage: /owner-listen [on|off|status|list] [<channel-nest>]\n"
                "Run inside a channel, pass a nest like chat/~sampel-palnet/foo, "
                "or use /owner-listen all [on|off] for the global toggle."
            )
        )

    canonical = canonicalize_nest(target)
    if canonical is None:
        return OwnerListenCommandOutcome(
            reply=f"{target} is not a valid channel nest (expected chat/~host/name)."
        )
    owned = is_owned_channel(canonical, owner_ship=owner_ship, bot_ship=bot_ship)

    if action in ("", "status"):
        effective = _channel_effective(state, canonical, owned)
        detail = _channel_detail(state, canonical, owned)
        return OwnerListenCommandOutcome(
            reply=f"Owner-listen for {canonical}: {'on' if effective else 'off'} ({detail})."
        )

    if action not in ("on", "off"):
        return OwnerListenCommandOutcome(reply=OWNER_LISTEN_USAGE)

    disabled_before = set(state.disabled_channels)
    enabled_before = set(state.enabled_channels)
    monitor_nest: Optional[str] = None

    if action == "on":
        state.disabled_channels.discard(canonical)
        if not owned:
            state.enabled_channels.add(canonical)
        if canonical not in monitored_channels:
            monitor_nest = canonical
    else:
        state.enabled_channels.discard(canonical)
        if owned:
            state.disabled_channels.add(canonical)

    if state.disabled_channels != disabled_before:
        changes[SETTINGS_KEY_DISABLED_CHANNELS] = sorted(state.disabled_channels)
    if state.enabled_channels != enabled_before:
        changes[SETTINGS_KEY_ENABLED_CHANNELS] = sorted(state.enabled_channels)

    if action == "on" and not state.enabled:
        return OwnerListenCommandOutcome(
            reply=(
                f"Owner-listen for {canonical}: off (global is off; channel override "
                "recorded). Run /owner-listen all on to enable it."
            ),
            settings_changes=changes,
            monitor_nest=monitor_nest,
        )

    effective = _channel_effective(state, canonical, owned)
    detail = _channel_detail(state, canonical, owned)
    reply = f"Owner-listen for {canonical}: {'on' if effective else 'off'} ({detail})."
    if monitor_nest and effective:
        reply += " Now monitoring this channel."
    return OwnerListenCommandOutcome(
        reply=reply,
        settings_changes=changes,
        monitor_nest=monitor_nest,
    )
