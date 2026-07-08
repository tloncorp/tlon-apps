"""Per-channel access mode: open vs restricted.

State lives in the same ``channelRules`` %settings key the OpenClaw plugin
uses (``{nest: {mode: "open"|"restricted", allowedShips?: [...]}}``), so
rules carry over between implementations. *Open* means any member's mention
wakes the bot in that channel; *restricted* (the default) limits mentions to
authorized ships, and unauthorized mentions queue for owner approval.

The owner toggles modes with the ``/channel-access`` chat command, handled
deterministically by the adapter like ``/owner-listen``. Rule entries are
preserved verbatim apart from the field being changed, so OpenClaw-managed
``allowedShips`` lists survive our writes.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Optional

from .owner_listen import canonicalize_nest
from .tlon_api import normalize_ship

SETTINGS_KEY_CHANNEL_RULES = "channelRules"
# The current key; solaris writes this one. OpenClaw also has a legacy
# duplicate "autoDiscover" key — deliberately not read here.
SETTINGS_KEY_AUTO_DISCOVER_CHANNELS = "autoDiscoverChannels"

CHANNEL_ACCESS_USAGE = (
    "Usage: /channel-access [open|restricted|status|list] [<channel-nest>]"
)

_COMMAND_RE = re.compile(r"^/channel-access(?:\s|$)", re.IGNORECASE)


def is_channel_access_command(text: str) -> bool:
    return bool(_COMMAND_RE.match(str(text or "").strip()))


def channel_access_command_args(text: str) -> str:
    return _COMMAND_RE.sub("", str(text or "").strip(), count=1).strip()


def parse_channel_rules(value: Any) -> dict[str, dict[str, Any]]:
    """Canonicalize nest keys; preserve rule dicts (and unknown fields) verbatim.

    %settings values cannot be objects, so the rules map is stored as a JSON
    string (same encoding as OpenClaw); accept both shapes.
    """
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}
    if not isinstance(value, Mapping):
        return {}
    rules: dict[str, dict[str, Any]] = {}
    for raw_nest, rule in value.items():
        canonical = canonicalize_nest(str(raw_nest or ""))
        if canonical is None or not isinstance(rule, Mapping):
            continue
        rules[canonical] = dict(rule)
    return rules


def channel_mode(rules: Mapping[str, Mapping[str, Any]], nest: str) -> str:
    canonical = canonicalize_nest(nest)
    if canonical is None:
        return "restricted"
    rule = rules.get(canonical)
    if not isinstance(rule, Mapping):
        return "restricted"
    mode = str(rule.get("mode") or "").strip().lower()
    return "open" if mode == "open" else "restricted"


def is_channel_open(rules: Mapping[str, Mapping[str, Any]], nest: str) -> bool:
    return channel_mode(rules, nest) == "open"


def channel_allowed_ships(
    rules: Mapping[str, Mapping[str, Any]],
    nest: str,
) -> frozenset[str]:
    canonical = canonicalize_nest(nest)
    if canonical is None:
        return frozenset()
    rule = rules.get(canonical)
    if not isinstance(rule, Mapping):
        return frozenset()
    ships = rule.get("allowedShips")
    if not isinstance(ships, list):
        return frozenset()
    return frozenset(
        normalize_ship(str(ship or "")) for ship in ships if str(ship or "").strip()
    )


def effective_allowed_ships(
    rules: Mapping[str, Mapping[str, Any]],
    nest: str,
    defaults: Iterable[str],
) -> frozenset[str]:
    """Allowed ships for a restricted channel, falling back to
    ``defaultAuthorizedShips`` when the rule doesn't pin its own list.

    Three distinct ``allowedShips`` cases (do not lump malformed in with
    nullish — a corrupt rule must fail closed, not broaden access):
    - missing / no rule / ``allowedShips is None`` -> inherit ``defaults``
      (OpenClaw's ``rule?.allowedShips ?? defaultShips``).
    - list-valued (incl. ``[]``) -> use the explicit list; ``[]`` blocks all.
    - explicit non-list, non-null garbage -> fail closed (empty set).
    An invalid/malformed ``nest`` also fails closed, matching
    ``channel_allowed_ships``.
    """
    canonical = canonicalize_nest(nest)
    if canonical is None:
        return frozenset()
    rule = rules.get(canonical)
    if isinstance(rule, Mapping) and "allowedShips" in rule:
        ships = rule.get("allowedShips")
        if isinstance(ships, list):
            return channel_allowed_ships(rules, nest)
        if ships is None:
            return frozenset(defaults)
        return frozenset()
    return frozenset(defaults)


def set_channel_mode(
    rules: Mapping[str, Mapping[str, Any]],
    nest: str,
    mode: str,
) -> dict[str, dict[str, Any]]:
    """Return a new rules dict with the nest's mode set, other fields preserved."""
    canonical = canonicalize_nest(nest)
    if canonical is None:
        raise ValueError(f"invalid nest: {nest}")
    updated = {key: dict(rule) for key, rule in rules.items()}
    rule = updated.setdefault(canonical, {})
    rule["mode"] = mode
    return updated


def add_channel_allowed_ship(
    rules: Mapping[str, Mapping[str, Any]],
    nest: str,
    ship: str,
) -> dict[str, dict[str, Any]]:
    canonical = canonicalize_nest(nest)
    if canonical is None:
        raise ValueError(f"invalid nest: {nest}")
    normalized = normalize_ship(ship)
    updated = {key: dict(rule) for key, rule in rules.items()}
    rule = updated.setdefault(canonical, {})
    ships = rule.get("allowedShips")
    ship_list = [str(item) for item in ships] if isinstance(ships, list) else []
    if normalized not in {normalize_ship(item) for item in ship_list}:
        ship_list.append(normalized)
    rule["allowedShips"] = ship_list
    return updated


@dataclass(frozen=True)
class ChannelAccessOutcome:
    reply: str
    new_rules: Optional[dict[str, dict[str, Any]]] = field(default=None)
    opened_nest: Optional[str] = None


def _mode_detail(rules: Mapping[str, Mapping[str, Any]], canonical: str) -> str:
    mode = channel_mode(rules, canonical)
    if mode == "open":
        return "open — anyone here can address the bot with a mention"
    allowed = channel_allowed_ships(rules, canonical)
    if allowed:
        return (
            "restricted — authorized ships plus "
            f"{len(allowed)} channel-approved ship(s) can address the bot"
        )
    return "restricted — only authorized ships can address the bot"


def apply_channel_access_command(
    rules: Mapping[str, Mapping[str, Any]],
    raw_args: str,
    *,
    ctx_nest: Optional[str],
) -> ChannelAccessOutcome:
    args = [part for part in str(raw_args or "").split() if part]
    lowered = [part.lower() for part in args]
    action = lowered[0] if lowered else ""

    if action == "list":
        if not rules:
            return ChannelAccessOutcome(reply="No per-channel access rules.")
        lines = ["Channel access rules:"]
        for nest in sorted(rules):
            lines.append(f"• {nest}: {_mode_detail(rules, nest)}")
        return ChannelAccessOutcome(reply="\n".join(lines))

    explicit_nest = args[1] if len(args) > 1 else None
    target = explicit_nest or ctx_nest
    if not target:
        return ChannelAccessOutcome(
            reply=(
                f"{CHANNEL_ACCESS_USAGE}\n"
                "Run inside a channel or pass a nest like chat/~sampel-palnet/foo."
            )
        )

    canonical = canonicalize_nest(target)
    if canonical is None:
        return ChannelAccessOutcome(
            reply=f"{target} is not a valid channel nest (expected chat/~host/name)."
        )

    if action in ("", "status"):
        return ChannelAccessOutcome(
            reply=f"Channel access for {canonical}: {_mode_detail(rules, canonical)}."
        )

    if action not in ("open", "restricted"):
        return ChannelAccessOutcome(reply=CHANNEL_ACCESS_USAGE)

    if channel_mode(rules, canonical) == action:
        return ChannelAccessOutcome(
            reply=f"Channel access for {canonical} is already {action}."
        )

    new_rules = set_channel_mode(rules, canonical, action)
    return ChannelAccessOutcome(
        reply=f"Channel access for {canonical}: {_mode_detail(new_rules, canonical)}.",
        new_rules=new_rules,
        opened_nest=canonical if action == "open" else None,
    )
