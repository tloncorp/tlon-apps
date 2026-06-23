"""Channel and thread history context for group dispatches.

Mirrors the OpenClaw Tlon plugin's context enrichment: when the bot wakes in a
group channel it gets recent channel activity (or thread history for thread
replies) prepended to the message text, so it can answer in context instead of
seeing one isolated line.

Reads use the same `/channels/v4` scry surface as OpenClaw.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional, Sequence

from .media import render_content_with_blob
from .tlon_api import extract_message_text, normalize_ship

logger = logging.getLogger(__name__)

ScryFn = Callable[[str], Awaitable[Any]]

# Neutralize role tags so history content cannot impersonate envelope framing.
_ROLE_TAG_RE = re.compile(r"\[(owner|user|admin|system)\]", re.IGNORECASE)


def sanitize_context_text(text: str) -> str:
    return _ROLE_TAG_RE.sub(r"(\1)", str(text or ""))


def format_ud(post_id: Any) -> str:
    """Format a post id as @ud with dots every 3 digits from the right."""
    digits = str(post_id or "").replace(".", "")
    if not digits:
        return ""
    chunks: list[str] = []
    for end in range(len(digits), 0, -3):
        chunks.append(digits[max(0, end - 3) : end])
    return ".".join(reversed(chunks))


def _normalize_id(post_id: Any) -> str:
    return str(post_id or "").replace(".", "")


@dataclass(frozen=True)
class HistoryEntry:
    author: str
    content: str
    timestamp: float
    post_id: str = ""
    blob: Optional[str] = None


def _entry_from_content(content: Any, seal: Any, fallback_id: Any = None) -> Optional[HistoryEntry]:
    if not isinstance(content, dict):
        return None
    text = extract_message_text(content.get("content"))
    raw_blob = content.get("blob")
    blob = raw_blob if isinstance(raw_blob, str) and raw_blob.strip() else None
    if not text.strip() and not blob:
        return None
    post_id = ""
    if isinstance(seal, dict):
        post_id = str(seal.get("id") or "")
    if not post_id and fallback_id is not None:
        post_id = str(fallback_id or "")
    try:
        timestamp = float(content.get("sent") or 0)
    except (TypeError, ValueError):
        timestamp = 0.0
    return HistoryEntry(
        author=normalize_ship(str(content.get("author") or "")) or "unknown",
        content=text,
        timestamp=timestamp,
        post_id=post_id,
        blob=blob,
    )


def parse_channel_history(payload: Any) -> list[HistoryEntry]:
    if isinstance(payload, list):
        posts: Sequence[Any] = payload
    elif isinstance(payload, dict):
        raw_posts = payload.get("posts")
        posts = list(raw_posts.values()) if isinstance(raw_posts, dict) else list(payload.values())
    else:
        return []

    entries: list[HistoryEntry] = []
    for item in posts:
        if not isinstance(item, dict):
            continue
        post_set = item.get("r-post", {}).get("set") if isinstance(item.get("r-post"), dict) else None
        essay = item.get("essay") or (post_set or {}).get("essay")
        seal = item.get("seal") or (post_set or {}).get("seal")
        entry = _entry_from_content(essay, seal)
        if entry is not None:
            entries.append(entry)
    entries.sort(key=lambda entry: entry.timestamp)
    return entries


def parse_thread_replies(payload: Any) -> list[HistoryEntry]:
    if isinstance(payload, list):
        replies: Sequence[Any] = payload
    elif isinstance(payload, dict):
        raw_replies = payload.get("replies")
        if isinstance(raw_replies, list):
            replies = raw_replies
        elif isinstance(raw_replies, dict):
            replies = list(raw_replies.values())
        else:
            replies = list(payload.values())
    else:
        return []

    entries: list[HistoryEntry] = []
    for item in replies:
        if not isinstance(item, dict):
            continue
        reply_set = item.get("r-reply", {}).get("set") if isinstance(item.get("r-reply"), dict) else None
        memo = item.get("memo") or (reply_set or {}).get("memo")
        seal = item.get("seal") or (reply_set or {}).get("seal")
        entry = _entry_from_content(memo, seal, fallback_id=item.get("id"))
        if entry is not None:
            entries.append(entry)
    entries.sort(key=lambda entry: entry.timestamp)
    return entries


def parse_parent_post(payload: Any, parent_id: str) -> Optional[HistoryEntry]:
    if not isinstance(payload, dict):
        return None
    post = payload.get("post") if isinstance(payload.get("post"), dict) else payload
    post_set = post.get("r-post", {}).get("set") if isinstance(post.get("r-post"), dict) else None
    content = post.get("essay") or post.get("memo") or (post_set or {}).get("essay")
    seal = post.get("seal") or (post_set or {}).get("seal")
    return _entry_from_content(content, seal, fallback_id=parent_id)


async def fetch_channel_history(scry: ScryFn, nest: str, count: int) -> list[HistoryEntry]:
    payload = await scry(f"/channels/v4/{nest}/posts/newest/{count}/outline")
    return parse_channel_history(payload)


async def fetch_thread_context(
    scry: ScryFn,
    nest: str,
    parent_id: str,
    count: int,
) -> list[HistoryEntry]:
    """Parent post first, then replies oldest-first, deduplicated."""
    parent_ud = format_ud(parent_id)

    async def fetch_parent() -> Optional[HistoryEntry]:
        try:
            payload = await scry(f"/channels/v4/{nest}/posts/post/{parent_ud}")
        except Exception as exc:
            logger.debug("[tlon] parent post fetch failed for %s: %s", parent_id, exc)
            return None
        return parse_parent_post(payload, parent_id)

    async def fetch_replies() -> list[HistoryEntry]:
        try:
            payload = await scry(
                f"/channels/v4/{nest}/posts/post/id/{parent_ud}/replies/newest/{count}"
            )
        except Exception as exc:
            logger.debug("[tlon] thread replies fetch failed for %s: %s", parent_id, exc)
            return []
        return parse_thread_replies(payload)

    parent, replies = await asyncio.gather(fetch_parent(), fetch_replies())
    ordered = ([parent] if parent else []) + replies
    seen: set[str] = set()
    deduped: list[HistoryEntry] = []
    for entry in ordered:
        key = (
            _normalize_id(entry.post_id)
            or f"{entry.author}:{entry.timestamp}:{entry.content}:{entry.blob or ''}"
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def render_history_content(entry: HistoryEntry) -> str:
    return render_content_with_blob(entry.content, entry.blob, compact=True)


def _context_line_items(entries: Sequence[HistoryEntry]) -> list[tuple[HistoryEntry, str]]:
    items: list[tuple[HistoryEntry, str]] = []
    for entry in entries:
        rendered = sanitize_context_text(render_history_content(entry))
        if rendered.strip():
            items.append((entry, rendered))
    return items


def _context_lines(entries: Sequence[HistoryEntry]) -> str:
    return "\n".join(
        f"{entry.author}: {rendered}" for entry, rendered in _context_line_items(entries)
    )


def build_channel_context(
    entries: Sequence[HistoryEntry],
    *,
    current_text: str,
    current_id: str,
    is_mention: bool,
    limit: int,
) -> Optional[str]:
    """Prepend recent channel activity to the current message text."""
    if limit <= 0:
        return None
    current_key = _normalize_id(current_id)
    context_entries = [
        entry
        for entry in entries
        if not current_key or _normalize_id(entry.post_id) != current_key
    ]
    context = _context_line_items(context_entries)[-limit:]
    if not context:
        return None

    note = (
        f"[Recent channel activity - {len(context)} messages. "
        "Use this context to understand what's being discussed.]"
    )
    current_label = "[Current message (mentioned you)]" if is_mention else "[Current message]"
    lines = "\n".join(f"{entry.author}: {rendered}" for entry, rendered in context)
    return f"{note}\n\n{lines}\n\n{current_label}\n{current_text}"


def build_thread_context(
    entries: Sequence[HistoryEntry],
    *,
    current_text: str,
    current_id: str,
    limit: int,
) -> Optional[str]:
    """Prepend thread history (parent post first) to the current message text."""
    if limit <= 0:
        return None
    current_key = _normalize_id(current_id)
    context_entries = [
        entry
        for entry in entries
        if not current_key or _normalize_id(entry.post_id) != current_key
    ]
    context = _context_line_items(context_entries)
    if not context:
        return None
    if len(context) > limit:
        # limit == 1 keeps only the parent: [-(limit - 1):] would be [-0:],
        # which is the whole list.
        context = [context[0]] if limit == 1 else [context[0], *context[-(limit - 1) :]]

    note = (
        f"[Thread conversation - {len(context)} messages including the parent post. "
        "You are participating in this thread. Only respond if relevant or helpful - "
        "you don't need to reply to every message.]"
    )
    lines = "\n".join(f"{entry.author}: {rendered}" for entry, rendered in context)
    return (
        f"{note}\n\n[Previous messages]\n{lines}\n\n"
        f"[Current message]\n{current_text}"
    )
