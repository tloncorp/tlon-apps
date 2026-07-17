"""Inbound channel-cite resolution for Hermes Tlon messages.

Ports OpenClaw's cite enrichment while using Hermes' existing ``/channels/v4``
history parsing and rendering helpers. Cites are parsed synchronously from the
story, then resolved through an injected scry function so callers can bound
the work and tests can provide small fakes.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from .history import (
    ScryFn,
    format_ud,
    parse_parent_post,
    render_history_content,
    sanitize_context_text,
)

logger = logging.getLogger(__name__)

_NEST_RE = re.compile(r"(?:chat|heap|diary)/~[a-z-]+/[a-z0-9-]+")
_UD_RE = re.compile(r"[0-9]+(?:\.[0-9]+)*")
_WHERE_RE = re.compile(r"^/(?:msg|note|curio)/([^/]+)(?:/([^/]+))?$")
_LEGACY_WHERE_RE = re.compile(r"^/msg/(~[a-z-]+)/([^/]+)$")


@dataclass(frozen=True)
class ParsedCite:
    type: str
    nest: Optional[str] = None
    where: Optional[str] = None
    post_id: Optional[str] = None
    reply_id: Optional[str] = None
    legacy_author: Optional[str] = None


def extract_cites(content: Any) -> list[ParsedCite]:
    """Return cite blocks from a Story without rejecting malformed siblings."""
    if not isinstance(content, list):
        return []

    cites: list[ParsedCite] = []
    for verse in content:
        if not isinstance(verse, dict):
            continue
        block = verse.get("block")
        if not isinstance(block, dict):
            continue
        raw_cite = block.get("cite")
        if not isinstance(raw_cite, dict):
            continue

        for cite_type in ("chan", "group", "desk", "bait"):
            if cite_type not in raw_cite:
                continue
            if cite_type != "chan":
                cites.append(ParsedCite(type=cite_type))
                break

            chan = raw_cite.get("chan")
            nest = chan.get("nest") if isinstance(chan, dict) else None
            where = chan.get("where") if isinstance(chan, dict) else None
            post_id, reply_id, legacy_author = _parse_channel_where(where)
            cites.append(
                ParsedCite(
                    type="chan",
                    nest=nest if isinstance(nest, str) else None,
                    where=where if isinstance(where, str) else None,
                    post_id=post_id,
                    reply_id=reply_id,
                    legacy_author=legacy_author,
                )
            )
            break
    return cites


def _parse_channel_where(
    where: Any,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    if not isinstance(where, str):
        return None, None, None
    legacy = _LEGACY_WHERE_RE.fullmatch(where)
    if legacy is not None:
        return legacy.group(2), None, legacy.group(1)
    current = _WHERE_RE.fullmatch(where)
    if current is None:
        return None, None, None
    return current.group(1), current.group(2), None


def _validated_scry_path(cite: ParsedCite) -> Optional[str]:
    """Build a channels-v4 route only from route-safe cite components."""
    if cite.type != "chan" or not _valid_nest(cite.nest) or not _valid_ud(cite.post_id):
        return None

    post_ud = format_ud(cite.post_id)
    if cite.reply_id is None:
        return f"/channels/v4/{cite.nest}/posts/post/{post_ud}"
    if not _valid_ud(cite.reply_id):
        return None
    reply_ud = format_ud(cite.reply_id)
    return (
        f"/channels/v4/{cite.nest}/posts/post/id/{post_ud}/"
        f"replies/reply/id/{reply_ud}"
    )


def _valid_nest(nest: Optional[str]) -> bool:
    return isinstance(nest, str) and _NEST_RE.fullmatch(nest) is not None


def _valid_ud(value: Optional[str]) -> bool:
    if not isinstance(value, str) or _UD_RE.fullmatch(value) is None:
        return False
    return "." not in value or format_ud(value) == value


async def resolve_cites(scry: ScryFn, content: Any, *, max_attempts: int = 3) -> str:
    """Resolve up to ``max_attempts`` valid channel cites in story order.

    A failed scry is an expected miss and does not consume a replacement from
    later cites. Cancellation intentionally propagates to the caller's budget.
    """
    if max_attempts <= 0:
        return ""

    attempts: list[tuple[ParsedCite, str]] = []
    for cite in extract_cites(content):
        path = _validated_scry_path(cite)
        if path is None:
            continue
        attempts.append((cite, path))
        if len(attempts) == max_attempts:
            break

    lines: list[str] = []
    for cite, path in attempts:
        try:
            payload = await scry(path)
            entry = parse_parent_post(payload, cite.post_id or "", cite.nest)
            if entry is None:
                continue
            text = sanitize_context_text(render_history_content(entry))
            if text.strip():
                lines.append(f"> {entry.author} wrote: {text}")
        except Exception as exc:
            logger.debug("[tlon] cite resolution failed for %s: %s", path, exc)
    return "\n".join(lines)
