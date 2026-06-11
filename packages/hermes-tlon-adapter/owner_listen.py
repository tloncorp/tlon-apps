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
SETTINGS_KEY_DEFAULT = "ownerListenDefault"
SETTINGS_KEY_GROUP_CHANNELS = "groupChannels"

NEST_PREFIXES = frozenset({"chat", "heap", "diary"})

OWNER_LISTEN_USAGE = (
    "Usage: /owner-listen [on|off|status|list] [<channel-nest>|<~host/group>] | "
    "/owner-listen all [on|off] | /owner-listen default [owned|all]"
)

_GROUP_FLAG_RE = re.compile(r"^~[a-z][a-z-]*/[^/\s]+$", re.IGNORECASE)

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
    # False: only owner/bot-hosted channels listen by default ("owned");
    # True: every monitored channel listens by default ("all").
    default_all: bool = False


def parse_group_flag(raw: str) -> Optional[str]:
    """Canonical ~host/slug group flag, or None if it doesn't look like one."""
    candidate = str(raw or "").strip()
    if not _GROUP_FLAG_RE.match(candidate):
        return None
    host, slug = candidate.split("/", 1)
    return f"{_canonical_ship(host)}/{slug}"


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
    if state.default_all:
        return True
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
        default_all=_parse_default_all(
            bucket.get(SETTINGS_KEY_DEFAULT), defaults.default_all
        ),
    )


def _parse_default_all(value: Any, fallback: bool) -> bool:
    raw = str(value or "").strip().lower()
    if raw == "all":
        return True
    if raw == "owned":
        return False
    return fallback


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
    if event.key == SETTINGS_KEY_DEFAULT:
        default_all = _parse_default_all(event.value, defaults.default_all)
        changed = state.default_all != default_all
        state.default_all = default_all
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
    monitor_nests: tuple[str, ...] = ()


def _channel_detail(state: OwnerListenState, canonical: str, owned: bool) -> str:
    if not state.enabled:
        return "global is off"
    if canonical in state.enabled_channels:
        return "explicitly enabled"
    if canonical in state.disabled_channels:
        return "channel is muted"
    if state.default_all:
        return "active (all-channels default)"
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
    return state.default_all or owned


def _default_label(state: OwnerListenState) -> str:
    return "all monitored channels" if state.default_all else "owned channels only"


def _set_channel(state: OwnerListenState, canonical: str, *, on: bool, owned: bool) -> None:
    """Sticky per-channel override: explicit on/off survives default flips."""
    if on:
        state.disabled_channels.discard(canonical)
        if not owned:
            state.enabled_channels.add(canonical)
    else:
        state.enabled_channels.discard(canonical)
        state.disabled_channels.add(canonical)


def _override_changes(
    state: OwnerListenState,
    disabled_before: set[str],
    enabled_before: set[str],
) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    if state.disabled_channels != disabled_before:
        changes[SETTINGS_KEY_DISABLED_CHANNELS] = sorted(state.disabled_channels)
    if state.enabled_channels != enabled_before:
        changes[SETTINGS_KEY_ENABLED_CHANNELS] = sorted(state.enabled_channels)
    return changes


def owner_listen_group_target(raw_args: str) -> Optional[tuple[str, str]]:
    """Detect the group form of the command: ``<action> ~host/group``.

    Returns ``(action, canonical_flag)`` when the second token is a group flag
    (not a 3-part channel nest); the adapter expands it to the group's
    channels before applying.
    """
    args = [part for part in str(raw_args or "").split() if part]
    if len(args) != 2:
        return None
    flag = parse_group_flag(args[1])
    if flag is None or canonicalize_nest(args[1]) is not None:
        return None
    return args[0].lower(), flag


def apply_owner_listen_group_command(
    state: OwnerListenState,
    action: str,
    flag: str,
    channels: Iterable[str],
    *,
    owner_ship: str,
    bot_ship: str,
    monitored_channels: frozenset[str] | set[str] = frozenset(),
) -> OwnerListenCommandOutcome:
    """Apply on/off to every channel of a group at once."""
    if action not in ("on", "off"):
        return OwnerListenCommandOutcome(
            reply=f"Group targets support on|off only. {OWNER_LISTEN_USAGE}"
        )
    canonical_channels = sorted(canonical_nest_set(channels))
    if not canonical_channels:
        return OwnerListenCommandOutcome(
            reply=f"No channels found for {flag} (is the bot a member?)"
        )

    disabled_before = set(state.disabled_channels)
    enabled_before = set(state.enabled_channels)
    monitor_nests: list[str] = []
    for canonical in canonical_channels:
        owned = is_owned_channel(canonical, owner_ship=owner_ship, bot_ship=bot_ship)
        _set_channel(state, canonical, on=action == "on", owned=owned)
        if action == "on" and canonical not in monitored_channels:
            monitor_nests.append(canonical)

    count = len(canonical_channels)
    if action == "on":
        reply = f"Owner-listen on for {count} channel(s) in {flag}."
        if not state.enabled:
            reply += " Note: global owner-listen is off; run /owner-listen all on."
        if monitor_nests:
            reply += f" Now monitoring {len(monitor_nests)} of them."
    else:
        reply = f"Owner-listen muted for {count} channel(s) in {flag}."
    return OwnerListenCommandOutcome(
        reply=reply,
        settings_changes=_override_changes(state, disabled_before, enabled_before),
        monitor_nests=tuple(monitor_nests),
    )


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
    caller can persist them. ``monitor_nests`` lists channels that were just
    enabled but are not currently monitored.
    """
    args = [part for part in str(raw_args or "").split() if part]
    lowered = [part.lower() for part in args]
    changes: dict[str, Any] = {}

    # Default mode — checked before the global branch because "default all"
    # contains the "all" keyword.
    if lowered[:1] == ["default"]:
        sub = lowered[1] if len(lowered) > 1 else ""
        if not sub:
            return OwnerListenCommandOutcome(
                reply=f"Owner-listen default: {_default_label(state)}."
            )
        if sub not in ("owned", "all"):
            return OwnerListenCommandOutcome(
                reply="Usage: /owner-listen default [owned|all]"
            )
        state.default_all = sub == "all"
        changes[SETTINGS_KEY_DEFAULT] = sub
        return OwnerListenCommandOutcome(
            reply=(
                f"Owner-listen default is now {_default_label(state)}. "
                "Per-channel on/off overrides still apply."
            ),
            settings_changes=changes,
        )

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
        lines = [head, f"Default: {_default_label(state)}."]
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
                f"{OWNER_LISTEN_USAGE}\n"
                "Run inside a channel, pass a nest like chat/~sampel-palnet/foo "
                "or a group like ~sampel-palnet/my-group, or use "
                "/owner-listen all [on|off] for the global toggle."
            )
        )

    canonical = canonicalize_nest(target)
    if canonical is None:
        hint = ""
        if parse_group_flag(target) is not None:
            # Group flags are expanded by the adapter (it fetches the group's
            # channels); reaching here means that lookup wasn't available.
            hint = " Group targets need a connected gateway to expand."
        return OwnerListenCommandOutcome(
            reply=(
                f"{target} is not a valid channel nest "
                f"(expected chat/~host/name).{hint}"
            )
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
    monitor_nests: list[str] = []

    _set_channel(state, canonical, on=action == "on", owned=owned)
    if action == "on" and canonical not in monitored_channels:
        monitor_nests.append(canonical)

    changes.update(_override_changes(state, disabled_before, enabled_before))

    if action == "on" and not state.enabled:
        return OwnerListenCommandOutcome(
            reply=(
                f"Owner-listen for {canonical}: off (global is off; channel override "
                "recorded). Run /owner-listen all on to enable it."
            ),
            settings_changes=changes,
            monitor_nests=tuple(monitor_nests),
        )

    effective = _channel_effective(state, canonical, owned)
    detail = _channel_detail(state, canonical, owned)
    reply = f"Owner-listen for {canonical}: {'on' if effective else 'off'} ({detail})."
    if monitor_nests and effective:
        reply += " Now monitoring this channel."
    return OwnerListenCommandOutcome(
        reply=reply,
        settings_changes=changes,
        monitor_nests=tuple(monitor_nests),
    )
