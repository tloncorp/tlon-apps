"""Pending-approval queue: codec, A2UI cards, and owner command parsing.

Ported from the OpenClaw Tlon plugin. Unknown ships that DM the bot or
mention it in restricted channels queue for owner approval instead of being
silently dropped. Pending requests persist in %settings under the same
``pendingApprovals`` key OpenClaw uses (approvals are stored as raw dicts and
unknown fields are preserved on round-trip), and approved DM senders land in
the shared ``dmAllowlist`` key.

Owner notifications carry an A2UI card (post-blob entry) whose buttons use
the ``tlon.sendMessage`` action to type ``/allow <id>`` / ``/reject <id>`` /
``/ban <id>`` back into the owner DM — the same deterministic commands the
adapter intercepts when typed by hand. Old clients fall back to the plain
text notification.
"""

from __future__ import annotations

import json
import math
import re
import uuid
from typing import Any, Iterable, Mapping, Optional

from .tlon_api import normalize_ship

SETTINGS_KEY_PENDING_APPROVALS = "pendingApprovals"
SETTINGS_KEY_DM_ALLOWLIST = "dmAllowlist"
SETTINGS_KEY_GROUP_INVITE_ALLOWLIST = "groupInviteAllowlist"
SETTINGS_KEY_DEFAULT_AUTHORIZED_SHIPS = "defaultAuthorizedShips"
SETTINGS_KEY_AUTO_ACCEPT_DM_INVITES = "autoAcceptDmInvites"

APPROVAL_TTL_MS = 48 * 60 * 60 * 1000
DM_INVITE_PREVIEW = "(DM invite - no message yet)"
PREVIEW_MAX_CHARS = 100
# Derived from the client's component budget, not a taste choice: each
# pending item with a preview line costs ~9 components (row + title +
# context + preview + actions row + 3 buttons + divider), so 4 items already
# renders a 43-component card and a 5th would push it past 50 — the a2ui
# validator's maxComponents (packages/api/src/client/a2ui.ts LIMITS).
MAX_PENDING_APPROVALS_A2UI = 4
MAX_PENDING_APPROVALS_TEXT = 25

_MAX_DISPLAY_SHIP_CHARS = 60
_MAX_DISPLAY_NEST_CHARS = 80
_MAX_DISPLAY_GROUP_CHARS = 80
_MAX_DISPLAY_TITLE_CHARS = 80
_MAX_DISPLAY_PREVIEW_CHARS = 100
_APPROVAL_ID_RE = re.compile(r"^[a-z0-9]{1,16}$")

A2UI_CATALOG_ID = "tlon.a2ui.basic.v1"
A2UI_MESSAGE_VERSION = "v0.9"
A2UI_ACTION_SEND_MESSAGE = "tlon.sendMessage"
A2UI_ACTION_NAVIGATE = "tlon.navigate"

_ALLOW_RE = re.compile(r"^/allow(?:\s+(?P<arg>\S+))?\s*$", re.IGNORECASE)
_REJECT_RE = re.compile(r"^/reject(?:\s+(?P<arg>\S+))?\s*$", re.IGNORECASE)
_BAN_RE = re.compile(r"^/ban(?:\s+(?P<arg>\S+))?\s*$", re.IGNORECASE)
_UNBAN_RE = re.compile(r"^/unban(?:\s+(?P<arg>\S+))?\s*$", re.IGNORECASE)
_PENDING_RE = re.compile(r"^/pending\s*$", re.IGNORECASE)
_BANNED_RE = re.compile(r"^/banned\s*$", re.IGNORECASE)


def truncate(text: str, max_chars: int = PREVIEW_MAX_CHARS) -> str:
    text = str(text or "")
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


# ── codec ────────────────────────────────────────────────────────────────


def approval_id(approval: Mapping[str, Any]) -> str:
    return str(approval.get("id") or "")


def approval_type(approval: Mapping[str, Any]) -> str:
    return str(approval.get("type") or "")


def approval_ship(approval: Mapping[str, Any]) -> str:
    return normalize_ship(str(approval.get("requestingShip") or ""))


def approval_nest(approval: Mapping[str, Any]) -> str:
    return str(approval.get("channelNest") or "")


def approval_group_flag(approval: Mapping[str, Any]) -> str:
    return str(approval.get("groupFlag") or "")


def _timestamp_ms(approval: Mapping[str, Any]) -> Optional[float]:
    try:
        return float(approval.get("timestamp"))
    except (TypeError, ValueError):
        return None


def is_expired(approval: Mapping[str, Any], now_ms: float) -> bool:
    timestamp = _timestamp_ms(approval)
    if timestamp is None:
        return True
    return now_ms - timestamp > APPROVAL_TTL_MS


def prune_expired(approvals: Iterable[Any], now_ms: float) -> list[dict[str, Any]]:
    return [
        dict(approval)
        for approval in approvals
        if isinstance(approval, Mapping) and not is_expired(approval, now_ms)
    ]


def parse_pending_approvals(value: Any) -> list[dict[str, Any]]:
    # %settings values cannot be objects, so the list of approvals is stored
    # as a JSON string (same encoding as OpenClaw); accept both shapes.
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []
    return [dict(item) for item in value if isinstance(item, Mapping)]


def generate_approval_id(approval_kind: str, existing_ids: Iterable[str]) -> str:
    existing = {str(item).lower() for item in existing_ids}
    prefix = (approval_kind or "x")[0].lower()
    for _ in range(10):
        candidate = f"{prefix}{uuid.uuid4().hex[:4]}"
        if candidate.lower() not in existing:
            return candidate
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def create_pending_approval(
    *,
    approval_kind: str,
    requesting_ship: str,
    now_ms: float,
    existing_ids: Iterable[str] = (),
    channel_nest: Optional[str] = None,
    group_flag: Optional[str] = None,
    group_title: Optional[str] = None,
    message_preview: Optional[str] = None,
    original_message: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    approval: dict[str, Any] = {
        "id": generate_approval_id(approval_kind, existing_ids),
        "type": approval_kind,
        "requestingShip": normalize_ship(requesting_ship),
        "timestamp": int(now_ms),
    }
    if channel_nest:
        approval["channelNest"] = channel_nest
    if group_flag:
        approval["groupFlag"] = group_flag
    if group_title:
        approval["groupTitle"] = truncate(group_title, 80)
    if message_preview:
        approval["messagePreview"] = truncate(message_preview)
    if original_message:
        approval["originalMessage"] = dict(original_message)
    return approval


def find_approval(
    approvals: Iterable[Mapping[str, Any]],
    ref: str,
) -> Optional[dict[str, Any]]:
    needle = str(ref or "").strip().lstrip("#").lower()
    if not needle:
        return None
    for approval in approvals:
        if approval_id(approval).lower() == needle:
            return dict(approval)
    return None


def find_duplicate(
    approvals: Iterable[Mapping[str, Any]],
    candidate: Mapping[str, Any],
) -> Optional[dict[str, Any]]:
    kind = approval_type(candidate)
    for approval in approvals:
        if approval_type(approval) != kind:
            continue
        # Group requests dedup by group flag (not inviter); DM/channel dedup by
        # ship, and channels additionally by nest.
        if kind == "group":
            if approval_group_flag(approval) == approval_group_flag(candidate):
                return dict(approval)
            continue
        if approval_ship(approval) != approval_ship(candidate):
            continue
        if kind == "channel" and approval_nest(approval) != approval_nest(candidate):
            continue
        return dict(approval)
    return None


def remove_approval(
    approvals: Iterable[Mapping[str, Any]],
    ref: str,
) -> list[dict[str, Any]]:
    needle = str(ref or "").strip().lstrip("#").lower()
    return [
        dict(approval)
        for approval in approvals
        if approval_id(approval).lower() != needle
    ]


def parse_foreigns(payload: Any) -> list[dict[str, str]]:
    """Pending valid group invites from a %groups foreigns map.

    Shape: ``{groupFlag: {invites: [{from, valid, preview: {meta: {title}}}]}}``.
    Returns one entry per group flag that has at least one valid invite, using
    the most recent valid invite for inviter/title.
    """
    if not isinstance(payload, Mapping):
        return []
    invites: list[dict[str, str]] = []
    for flag, foreign in payload.items():
        if not isinstance(foreign, Mapping):
            continue
        raw_invites = foreign.get("invites")
        if not isinstance(raw_invites, list):
            continue
        valid = [
            invite
            for invite in raw_invites
            if isinstance(invite, Mapping) and invite.get("valid")
        ]
        if not valid:
            continue
        chosen = max(valid, key=lambda invite: invite.get("time") or 0)
        inviter = normalize_ship(str(chosen.get("from") or ""))
        if not inviter:
            continue
        preview = chosen.get("preview")
        title = ""
        if isinstance(preview, Mapping):
            meta = preview.get("meta")
            if isinstance(meta, Mapping):
                title = str(meta.get("title") or "")
        invites.append(
            {"groupFlag": str(flag), "from": inviter, "title": title}
        )
    return invites


def parse_dm_allowlist(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    result: set[str] = set()
    for item in value:
        ship = normalize_ship(str(item or ""))
        if ship:
            result.add(ship)
    return result


def parse_ship_list(value: Any) -> set[str]:
    """Strict ship-list parser: only string list entries are accepted.

    Unlike ``parse_dm_allowlist`` (which coerces any item through ``str()``),
    non-string entries are ignored rather than coerced, so malformed settings
    data (e.g. ``[7]``) cannot silently broaden authorization.
    """
    if not isinstance(value, list):
        return set()
    result: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        ship = normalize_ship(item)
        if ship:
            result.add(ship)
    return result


def settings_bool(value: Any, default: bool) -> bool:
    """Typed boolean coercion for %settings values: only a genuine bool is
    accepted; anything else (strings, numbers, None from a del-entry) falls
    back to ``default`` rather than being truthy-coerced (``bool("false")``
    is ``True``)."""
    return value if isinstance(value, bool) else default


# ── owner commands ───────────────────────────────────────────────────────


def parse_approval_command(text: str) -> Optional[tuple[str, str]]:
    """Parse an approval admin command into (action, arg). Arg may be ''."""
    clean = str(text or "").strip()
    for action, pattern in (
        ("allow", _ALLOW_RE),
        ("reject", _REJECT_RE),
        ("ban", _BAN_RE),
        ("unban", _UNBAN_RE),
        ("pending", _PENDING_RE),
        ("banned", _BANNED_RE),
    ):
        match = pattern.match(clean)
        if match:
            arg = match.groupdict().get("arg") or ""
            return action, arg.strip()
    return None


# ── text formatting (fallback under the A2UI card) ──────────────────────


def _approval_descriptor(approval: Mapping[str, Any]) -> str:
    kind = approval_type(approval)
    if kind == "dm":
        return "DM request"
    if kind == "channel":
        return "channel request"
    if kind == "group":
        return "group invite"
    return f"{kind} request"


def _group_label(approval: Mapping[str, Any]) -> str:
    return str(approval.get("groupTitle") or "") or approval_group_flag(approval)


def format_approval_request(approval: Mapping[str, Any]) -> str:
    kind = approval_type(approval)
    lines = [f"🔔 New {_approval_descriptor(approval)} #{approval_id(approval)}"]
    if kind == "group":
        lines.append(f"Inviter: {approval_ship(approval)}")
        lines.append(f"Group: {_group_label(approval)}")
    else:
        lines.append(f"From: {approval_ship(approval)}")
        nest = approval_nest(approval)
        if nest:
            lines.append(f"Channel: {nest}")
        preview = str(approval.get("messagePreview") or "")
        if preview:
            lines.append(f'Message: "{truncate(preview)}"')
    request_id = approval_id(approval)
    lines.append("")
    lines.append(
        f"Reply /allow {request_id} · /reject {request_id} · /ban {request_id}"
    )
    return "\n".join(lines)


def _bounded_display_text(value: Any, max_chars: int, fallback: str = "") -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    return truncate(text, max_chars)


def approval_id_is_actionable(approval: Mapping[str, Any]) -> bool:
    """Whether an approval ID can round-trip through the owner command parser."""
    return bool(_APPROVAL_ID_RE.fullmatch(approval_id(approval)))


def _pending_approval_type(approval: Mapping[str, Any]) -> str:
    kind = approval_type(approval)
    return kind if kind in {"dm", "channel", "group"} else "unknown"


def _pending_approval_descriptor(approval: Mapping[str, Any]) -> str:
    return {
        "dm": "DM request",
        "channel": "channel request",
        "group": "group invite",
    }.get(_pending_approval_type(approval), "request")


def _pending_display_id(approval: Mapping[str, Any]) -> str:
    if approval_id_is_actionable(approval):
        return f"#{approval_id(approval)}"
    return "[unactionable approval ID]"


def _pending_display_ship(approval: Mapping[str, Any]) -> str:
    value = _bounded_display_text(
        approval.get("requestingShip"), _MAX_DISPLAY_SHIP_CHARS
    )
    return normalize_ship(value) if value else "[unknown ship]"


def _pending_display_nest(approval: Mapping[str, Any]) -> str:
    return _bounded_display_text(approval.get("channelNest"), _MAX_DISPLAY_NEST_CHARS)


def _pending_display_group_flag(approval: Mapping[str, Any]) -> str:
    return _bounded_display_text(approval.get("groupFlag"), _MAX_DISPLAY_GROUP_CHARS)


def _pending_group_label(approval: Mapping[str, Any]) -> str:
    return _bounded_display_text(
        approval.get("groupTitle"), _MAX_DISPLAY_TITLE_CHARS
    ) or _pending_display_group_flag(approval) or "[unknown group]"


def _pending_display_preview(approval: Mapping[str, Any]) -> str:
    return _bounded_display_text(
        approval.get("messagePreview"), _MAX_DISPLAY_PREVIEW_CHARS
    )


def format_pending_list(approvals: Iterable[Mapping[str, Any]]) -> str:
    """Render a bounded, actionable fallback for persisted approval data.

    Pending approvals are stored as untrusted JSON in %settings. Never let a
    corrupt record crowd the owner-facing command guidance out of the reply;
    malformed IDs are deliberately labeled rather than truncated into commands
    that could not resolve to the stored record.
    """
    entries = list(approvals)
    if not entries:
        return "No pending approvals."
    lines = [f"{len(entries)} pending approval(s):"]
    for approval in entries[:MAX_PENDING_APPROVALS_TEXT]:
        descriptor = _pending_approval_descriptor(approval)
        request_id = _pending_display_id(approval)
        # An unactionable ID can never resolve via /allow, /reject, or /ban;
        # tell the owner it will still self-clear once its TTL elapses.
        expiry_hint = (
            "" if approval_id_is_actionable(approval) else "; expires automatically"
        )
        if _pending_approval_type(approval) == "group":
            detail = (
                f" {_pending_group_label(approval)} "
                f"(from {_pending_display_ship(approval)})"
            )
            lines.append(f"• {request_id} {descriptor}:{detail}{expiry_hint}")
            continue
        nest = _pending_display_nest(approval)
        where = f" in {nest}" if nest else ""
        preview = _pending_display_preview(approval)
        suffix = f' — "{truncate(preview, 60)}"' if preview else ""
        lines.append(
            f"• {request_id} {descriptor} from {_pending_display_ship(approval)}"
            f"{where}{suffix}{expiry_hint}"
        )
    remaining = len(entries) - MAX_PENDING_APPROVALS_TEXT
    if remaining > 0:
        lines.append(f"• … {remaining} more pending approval(s) not shown.")
    lines.append("")
    lines.append("Reply /allow <id> · /reject <id> · /ban <id>")
    return "\n".join(lines)


def format_confirmation(approval: Mapping[str, Any], action: str) -> str:
    ship = approval_ship(approval)
    kind = approval_type(approval)
    nest = approval_nest(approval)
    request_id = approval_id(approval)
    if action == "allow":
        if kind == "channel":
            return f"Approved #{request_id}: {ship} can now address the bot in {nest}."
        if kind == "group":
            return f"Approved #{request_id}: joining {_group_label(approval)}."
        return f"Approved #{request_id}: {ship} can now DM the bot."
    if action == "reject":
        if kind == "group":
            return f"Rejected #{request_id}: declined invite to {_group_label(approval)}."
        return f"Rejected #{request_id} from {ship}."
    if action == "ban":
        return f"Blocked {ship} and removed #{request_id}."
    return f"{action} #{request_id}"


def format_blocked_list(ships: Iterable[str]) -> str:
    entries = sorted(normalize_ship(ship) for ship in ships if str(ship or "").strip())
    if not entries:
        return "No blocked ships."
    lines = ["Blocked ships:"]
    lines.extend(f"• {ship}" for ship in entries)
    lines.append("")
    lines.append("Reply /unban ~ship to unblock.")
    return "\n".join(lines)


# ── A2UI card ────────────────────────────────────────────────────────────


def make_a2ui_blob_entry(
    surface_id: str,
    root: str,
    components: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "type": "a2ui",
        "version": 1,
        "messages": [
            {
                "version": A2UI_MESSAGE_VERSION,
                "createSurface": {
                    "surfaceId": surface_id,
                    "catalogId": A2UI_CATALOG_ID,
                },
            },
            {
                "version": A2UI_MESSAGE_VERSION,
                "updateComponents": {
                    "surfaceId": surface_id,
                    "root": root,
                    "components": components,
                },
            },
        ],
    }


def serialize_blob(entry: Mapping[str, Any]) -> str:
    """Post blob field format: a JSON array of blob entries."""
    return json.dumps([dict(entry)], ensure_ascii=False, separators=(",", ":"))


def _send_message_button(
    button_id: str,
    label: str,
    command: str,
    *,
    variant: Optional[str] = None,
) -> list[dict[str, Any]]:
    button: dict[str, Any] = {
        "id": button_id,
        "component": "Button",
        "child": f"{button_id}Label",
        "action": {
            "event": {
                "name": A2UI_ACTION_SEND_MESSAGE,
                "context": {"text": command},
            }
        },
    }
    if variant:
        button["variant"] = variant
    return [button, {"id": f"{button_id}Label", "component": "Text", "text": label}]


def _approval_nav_target(approval: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    original = approval.get("originalMessage")
    if not isinstance(original, Mapping):
        return None
    message_id = str(original.get("messageId") or "")
    if not message_id:
        return None
    target: dict[str, Any] = {
        "type": "message",
        "postId": message_id,
        "authorId": approval_ship(approval),
    }
    parent_id = str(original.get("parentId") or "")
    if parent_id:
        target["parentId"] = parent_id
    kind = approval_type(approval)
    if kind == "dm":
        target["channelId"] = approval_ship(approval)
    elif kind == "channel" and approval_nest(approval):
        target["channelId"] = approval_nest(approval)
    else:
        return None
    return target


def _approval_card_title(approval: Mapping[str, Any]) -> str:
    # Pending approvals are untrusted persisted JSON (see module docstring);
    # bound every field the same way the pending-list card does so a
    # corrupted/oversized channelNest or groupTitle can't blow the a2ui
    # validator's per-card size limits and knock the card back to plain text.
    ship = _pending_display_ship(approval)
    kind = approval_type(approval)
    if kind == "channel":
        return f"Let the bot reply to {ship} in {_pending_display_nest(approval) or 'this channel'}?"
    if kind == "group":
        return f"Let the bot join {truncate(_pending_group_label(approval), 60)}?"
    return f"Allow {ship} to DM the bot?"


def _approval_card_eyebrow(approval: Mapping[str, Any]) -> str:
    kind = approval_type(approval)
    if kind == "channel":
        return "Channel access"
    if kind == "group":
        return "Group invite"
    return "DM access"


def _approval_card_allow_note(approval: Mapping[str, Any]) -> str:
    kind = approval_type(approval)
    if kind == "channel":
        return "The bot will be able to read and reply to this user in this channel."
    if kind == "group":
        return "The bot will join and be able to read and respond in the group's channels."
    return "The bot will be able to read and reply to future DMs from this user."


def _approval_card_context_lines(approval: Mapping[str, Any]) -> list[str]:
    if approval_type(approval) == "group":
        return [
            f"Inviter: {_pending_display_ship(approval)}",
            f"Group: {_pending_group_label(approval)}",
        ]
    lines = [f"Sender: {_pending_display_ship(approval)}"]
    nest = _pending_display_nest(approval)
    if nest:
        lines.append(f"Channel: {nest}")
    return lines


def build_approval_card(approval: Mapping[str, Any]) -> dict[str, Any]:
    request_id = approval_id(approval)
    context_lines = _approval_card_context_lines(approval)
    preview = str(approval.get("messagePreview") or "")
    nav_target = _approval_nav_target(approval)

    body_children = [
        "eyebrow",
        "title",
        "titleDivider",
        *[f"context{index}" for index in range(len(context_lines))],
        *(["copy"] if preview else []),
        "divider",
        "allowNote",
        "actions",
    ]
    action_children = [
        *(["viewMessage"] if nav_target else []),
        "allow",
        "reject",
        "ban",
    ]

    components: list[dict[str, Any]] = [
        {"id": "root", "component": "Card", "child": "body"},
        {"id": "body", "component": "Column", "children": body_children},
        {
            "id": "eyebrow",
            "component": "Text",
            "variant": "caption",
            "text": _approval_card_eyebrow(approval),
        },
        {
            "id": "title",
            "component": "Text",
            "variant": "h3",
            "text": _approval_card_title(approval),
        },
        {"id": "titleDivider", "component": "Divider"},
        *[
            {
                "id": f"context{index}",
                "component": "Text",
                "variant": "caption",
                "text": line,
            }
            for index, line in enumerate(context_lines)
        ],
        *(
            [
                {
                    "id": "copy",
                    "component": "Text",
                    "variant": "caption",
                    "text": f'Message: "{truncate(preview)}"',
                }
            ]
            if preview
            else []
        ),
        {"id": "divider", "component": "Divider"},
        {
            "id": "allowNote",
            "component": "Text",
            "variant": "caption",
            "text": _approval_card_allow_note(approval),
        },
        {"id": "actions", "component": "Row", "children": action_children},
    ]

    if nav_target:
        components.extend(
            [
                {
                    "id": "viewMessage",
                    "component": "Button",
                    "child": "viewMessageLabel",
                    "action": {
                        "event": {
                            "name": A2UI_ACTION_NAVIGATE,
                            "context": {"target": nav_target},
                        }
                    },
                },
                {"id": "viewMessageLabel", "component": "Text", "text": "View message"},
            ]
        )
    components.extend(
        _send_message_button("allow", "Allow", f"/allow {request_id}", variant="primary")
    )
    components.extend(_send_message_button("reject", "Reject", f"/reject {request_id}"))
    components.extend(
        _send_message_button("ban", "Block", f"/ban {request_id}", variant="borderless")
    )

    return make_a2ui_blob_entry(f"approval-{request_id}", "root", components)


# ── Pending approvals A2UI ──────────────────────────────────────────────


def _pending_item_fields(approval: Mapping[str, Any]) -> tuple[str, str, Optional[str]]:
    """Return bounded display fields for one persisted pending approval."""
    kind = _pending_approval_type(approval)
    ship = _pending_display_ship(approval)
    preview = _pending_display_preview(approval)
    preview_line = f'Message: "{preview}"' if preview else None
    if kind == "dm":
        return f"DM from {ship}", f"Sender: {ship}", preview_line
    if kind == "channel":
        return (
            f"Channel access for {ship}",
            f"Channel: {_pending_display_nest(approval) or 'this channel'}",
            preview_line,
        )
    return f"Group invite from {ship}", f"Group: {_pending_group_label(approval)}", None


def _pending_text_component(
    component_id: str, text: str, *, variant: Optional[str] = None
) -> dict[str, Any]:
    component: dict[str, Any] = {"id": component_id, "component": "Text", "text": text}
    if variant is not None:
        component["variant"] = variant
    return component


def _pending_button(
    component_id: str,
    label_id: str,
    command: str,
    *,
    variant: Optional[str] = None,
) -> dict[str, Any]:
    component: dict[str, Any] = {
        "id": component_id,
        "component": "Button",
        "child": label_id,
        "action": {
            "event": {
                "name": A2UI_ACTION_SEND_MESSAGE,
                "context": {"text": command},
            }
        },
    }
    if variant is not None:
        component["variant"] = variant
    return component


def build_pending_approvals_card(
    approvals: Iterable[Mapping[str, Any]],
) -> Optional[dict[str, Any]]:
    """Build the bounded pending-approvals card from OpenClaw #5939.

    Action IDs are intentionally strict: a malformed persisted ID is shown in
    the text fallback as unactionable instead of being shortened into a button
    command that could address a different record.
    """
    active = list(approvals)
    if not 0 < len(active) <= MAX_PENDING_APPROVALS_A2UI:
        return None
    if any(
        not approval_id_is_actionable(approval)
        or _pending_approval_type(approval) == "unknown"
        for approval in active
    ):
        return None

    body_children = ["eyebrow", "title", "titleDivider"]
    components: list[dict[str, Any]] = [
        {"id": "root", "component": "Card", "child": "body"},
        {"id": "body", "component": "Column", "children": body_children},
        _pending_text_component("eyebrow", "Pending requests", variant="caption"),
        _pending_text_component(
            "title",
            f"{len(active)} approval {'request' if len(active) == 1 else 'requests'}",
            variant="h3",
        ),
        {"id": "titleDivider", "component": "Divider"},
        _pending_text_component("allowLabel", "Allow"),
        _pending_text_component("rejectLabel", "Reject"),
        _pending_text_component("blockLabel", "Block"),
    ]

    for index, approval in enumerate(active):
        prefix = f"item{index}"
        title, context, preview = _pending_item_fields(approval)
        request_id = approval_id(approval)
        if index:
            divider_id = f"{prefix}Divider"
            body_children.append(divider_id)
            components.append({"id": divider_id, "component": "Divider"})
        body_children.append(prefix)
        item_children = [f"{prefix}Title", f"{prefix}Context"]
        if preview:
            item_children.append(f"{prefix}Preview")
        item_children.append(f"{prefix}Actions")
        components.extend(
            [
                {"id": prefix, "component": "Column", "children": item_children},
                _pending_text_component(f"{prefix}Title", title, variant="h4"),
                _pending_text_component(f"{prefix}Context", context, variant="caption"),
                *(
                    [_pending_text_component(f"{prefix}Preview", preview, variant="caption")]
                    if preview
                    else []
                ),
                {
                    "id": f"{prefix}Actions",
                    "component": "Row",
                    "children": [
                        f"{prefix}Allow",
                        f"{prefix}Reject",
                        f"{prefix}Block",
                    ],
                },
                _pending_button(
                    f"{prefix}Allow",
                    "allowLabel",
                    f"/allow {request_id}",
                    variant="primary",
                ),
                _pending_button(
                    f"{prefix}Reject", "rejectLabel", f"/reject {request_id}"
                ),
                _pending_button(
                    f"{prefix}Block",
                    "blockLabel",
                    f"/ban {request_id}",
                    variant="borderless",
                ),
            ]
        )

    return make_a2ui_blob_entry("pending-approvals", "root", components)


def _is_plain_object(value: Any) -> bool:
    return isinstance(value, Mapping)


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_valid_target_id(value: Any) -> bool:
    return _is_non_empty_string(value) and len(value) <= 500


def _is_valid_navigation_target(target: Any) -> bool:
    if not _is_plain_object(target):
        return False
    target_type = target.get("type")

    def optional_id(name: str) -> bool:
        return name not in target or _is_valid_target_id(target.get(name))

    if target_type == "message":
        return (
            _is_valid_target_id(target.get("channelId"))
            and _is_valid_target_id(target.get("postId"))
            and all(optional_id(name) for name in ("parentId", "parentAuthorId", "authorId", "groupId"))
        )
    if target_type == "channel":
        return _is_valid_target_id(target.get("channelId")) and all(
            optional_id(name) for name in ("groupId", "selectedPostId")
        )
    if target_type == "group":
        return _is_valid_target_id(target.get("groupId"))
    if target_type == "profile":
        return _is_valid_target_id(target.get("userId")) and all(
            optional_id(name) for name in ("groupId", "channelId")
        )
    if target_type in {"chatDetails", "chatVolume"}:
        return (
            target.get("chatType") in {"group", "channel"}
            and _is_valid_target_id(target.get("chatId"))
            and optional_id("groupId")
        )
    return False


def _is_valid_button_action(action: Any) -> bool:
    if not _is_plain_object(action) or not _is_plain_object(action.get("event")):
        return False
    event = action["event"]
    context = event.get("context")
    if event.get("name") == A2UI_ACTION_SEND_MESSAGE:
        return (
            _is_plain_object(context)
            and _is_non_empty_string(context.get("text"))
            and len(context["text"]) <= 1000
        )
    if event.get("name") == A2UI_ACTION_NAVIGATE:
        return _is_plain_object(context) and _is_valid_navigation_target(context.get("target"))
    return False


def _is_valid_a2ui_component(component: Any) -> bool:
    if not _is_plain_object(component) or not _is_non_empty_string(component.get("id")):
        return False
    weight = component.get("weight")
    if "weight" in component and (not _is_finite_number(weight) or not 0 <= weight <= 12):
        return False
    kind = component.get("component")
    if kind == "Text":
        return (
            isinstance(component.get("text"), str)
            and len(component["text"]) <= 1000
            and component.get("variant") in {None, "body", "caption", "h1", "h2", "h3", "h4", "h5"}
        )
    if kind in {"Row", "Column"}:
        children = component.get("children")
        return (
            isinstance(children, list)
            and len(children) <= 12
            and all(_is_non_empty_string(child) for child in children)
            and len(set(children)) == len(children)
            and component.get("justify") in {None, "start", "center", "end", "spaceBetween", "spaceAround"}
            and component.get("align") in {None, "start", "center", "end", "stretch"}
        )
    if kind == "Card":
        return _is_non_empty_string(component.get("child"))
    if kind == "Divider":
        return True
    if kind == "Button":
        return (
            _is_non_empty_string(component.get("child"))
            and ("disabled" not in component or isinstance(component["disabled"], bool))
            and component.get("variant") in {None, "default", "primary", "secondary", "borderless"}
            and _is_valid_button_action(component.get("action"))
        )
    return False


def validate_a2ui_card(entry: Any) -> bool:
    """Conservative Python port of ``A2UI.validateBlobEntry``.

    This keeps a malformed card from replacing the plain-text `/pending`
    response. It covers the client envelope, component, and reachable-tree
    invariants without accepting a shape the renderer would reject.
    """
    if not _is_plain_object(entry) or entry.get("type") != "a2ui" or entry.get("version") != 1:
        return False
    try:
        # ASCII escaping is intentionally conservative for the browser's
        # JSON.stringify length budget and also catches non-serializable data.
        if len(json.dumps(entry, ensure_ascii=True, separators=(",", ":")).encode("ascii")) > 32 * 1024:
            return False
    except (TypeError, ValueError):
        return False

    messages = entry.get("messages")
    if not isinstance(messages, list):
        return False
    create_message = next(
        (message for message in messages if _is_plain_object(message) and "createSurface" in message),
        None,
    )
    update_message = next(
        (message for message in messages if _is_plain_object(message) and "updateComponents" in message),
        None,
    )
    if (
        not _is_plain_object(create_message)
        or not _is_plain_object(update_message)
        or create_message.get("version") != A2UI_MESSAGE_VERSION
        or update_message.get("version") != A2UI_MESSAGE_VERSION
        or not _is_plain_object(create_message.get("createSurface"))
        or not _is_plain_object(update_message.get("updateComponents"))
    ):
        return False
    create_surface = create_message["createSurface"]
    update = update_message["updateComponents"]
    components = update.get("components")
    if (
        not _is_non_empty_string(create_surface.get("surfaceId"))
        or create_surface.get("surfaceId") != update.get("surfaceId")
        or not _is_non_empty_string(create_surface.get("catalogId"))
        or not isinstance(components, list)
        or not 0 < len(components) <= 50
        or not all(_is_valid_a2ui_component(component) for component in components)
    ):
        return False

    by_id: dict[str, Mapping[str, Any]] = {}
    total_text = 0
    for component in components:
        component_id = component["id"]
        if component_id in by_id:
            return False
        by_id[component_id] = component
        if component["component"] == "Text":
            total_text += len(component["text"])
        elif component["component"] == "Button":
            action = component["action"]
            event = action["event"]
            if event["name"] == A2UI_ACTION_SEND_MESSAGE:
                total_text += len(event["context"]["text"])
    if total_text > 8000:
        return False

    root = update.get("root", components[0]["id"])
    if not _is_non_empty_string(root) or root not in by_id:
        return False
    visiting: set[str] = set()
    expanded = 0

    def visit(component_id: str, depth: int) -> bool:
        nonlocal expanded
        if depth > 8 or component_id in visiting:
            return False
        expanded += 1
        if expanded > 50 * 12:
            return False
        component = by_id.get(component_id)
        if component is None:
            return False
        visiting.add(component_id)
        if component["component"] in {"Row", "Column"}:
            children = component["children"]
        elif component["component"] in {"Card", "Button"}:
            children = [component["child"]]
        else:
            children = []
        if len(children) > 12 or not all(visit(child, depth + 1) for child in children):
            return False
        visiting.remove(component_id)
        return True

    return visit(root, 1)


def build_pending_approvals_response(
    approvals: Iterable[Mapping[str, Any]], *, is_dm: bool
) -> tuple[str, Optional[str]]:
    """Return the self-sufficient text fallback and optional pending-card blob."""
    active = list(approvals)
    text = format_pending_list(active)
    if not is_dm:
        return text, None
    card = build_pending_approvals_card(active)
    if card is None or not validate_a2ui_card(card):
        return text, None
    try:
        return text, serialize_blob(card)
    except (TypeError, ValueError):
        return text, None
