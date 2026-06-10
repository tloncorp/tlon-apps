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
import re
import uuid
from typing import Any, Iterable, Mapping, Optional

from .tlon_api import normalize_ship

SETTINGS_KEY_PENDING_APPROVALS = "pendingApprovals"
SETTINGS_KEY_DM_ALLOWLIST = "dmAllowlist"

APPROVAL_TTL_MS = 48 * 60 * 60 * 1000
DM_INVITE_PREVIEW = "(DM invite - no message yet)"
PREVIEW_MAX_CHARS = 100

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
    for approval in approvals:
        if (
            approval_type(approval) == approval_type(candidate)
            and approval_ship(approval) == approval_ship(candidate)
            and (
                approval_type(candidate) != "channel"
                or approval_nest(approval) == approval_nest(candidate)
            )
        ):
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


def parse_dm_allowlist(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    result: set[str] = set()
    for item in value:
        ship = normalize_ship(str(item or ""))
        if ship:
            result.add(ship)
    return result


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
    return f"{kind} request"


def format_approval_request(approval: Mapping[str, Any]) -> str:
    lines = [f"🔔 New {_approval_descriptor(approval)} #{approval_id(approval)}"]
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


def format_pending_list(approvals: Iterable[Mapping[str, Any]]) -> str:
    entries = list(approvals)
    if not entries:
        return "No pending approvals."
    lines = [f"{len(entries)} pending approval(s):"]
    for approval in entries:
        descriptor = _approval_descriptor(approval)
        nest = approval_nest(approval)
        where = f" in {nest}" if nest else ""
        preview = str(approval.get("messagePreview") or "")
        suffix = f' — "{truncate(preview, 60)}"' if preview else ""
        lines.append(
            f"• #{approval_id(approval)} {descriptor} from {approval_ship(approval)}{where}{suffix}"
        )
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
        return f"Approved #{request_id}: {ship} can now DM the bot."
    if action == "reject":
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
    ship = approval_ship(approval)
    if approval_type(approval) == "channel":
        return f"Let the bot reply to {ship} in {approval_nest(approval) or 'this channel'}?"
    return f"Allow {ship} to DM the bot?"


def _approval_card_eyebrow(approval: Mapping[str, Any]) -> str:
    return "Channel access" if approval_type(approval) == "channel" else "DM access"


def _approval_card_allow_note(approval: Mapping[str, Any]) -> str:
    if approval_type(approval) == "channel":
        return "The bot will be able to read and reply to this user in this channel."
    return "The bot will be able to read and reply to future DMs from this user."


def build_approval_card(approval: Mapping[str, Any]) -> dict[str, Any]:
    request_id = approval_id(approval)
    context_lines = [f"Sender: {approval_ship(approval)}"]
    nest = approval_nest(approval)
    if nest:
        context_lines.append(f"Channel: {nest}")
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
