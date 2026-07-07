"""Tlon Story/blob media helpers for the Hermes adapter.

This module intentionally keeps Hermes imports lazy so parsing and formatting
can be tested without booting the gateway runtime.
"""

from __future__ import annotations

import asyncio
import inspect
import ipaddress
import json
import logging
import mimetypes
import os
import socket
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional, Sequence
from urllib.parse import ParseResult, unquote, urljoin, urlparse

logger = logging.getLogger(__name__)

MAX_BLOB_DOWNLOAD_BYTES = 100 * 1024 * 1024
MAX_REDIRECTS = 5


@dataclass(frozen=True)
class BlobEntry:
    type: str
    version: int
    file_uri: str
    name: str = ""
    mime_type: str = ""
    size: Optional[int] = None
    duration: Optional[float] = None
    transcription: str = ""


@dataclass(frozen=True)
class StoryImage:
    url: str
    alt: str = ""


@dataclass(frozen=True)
class DownloadableMedia:
    uri: str
    source_type: str
    label: str
    filename: str = ""
    mime_type: str = ""
    size: Optional[int] = None
    default_kind: Optional[str] = None


@dataclass(frozen=True)
class FetchedMedia:
    data: bytes
    content_type: str = ""
    final_url: str = ""
    filename: str = ""


@dataclass(frozen=True)
class CachedAttachment:
    path: str
    media_type: str
    kind: str
    source_type: str


@dataclass(frozen=True)
class PreparedMedia:
    text_prefix: str = ""
    media_urls: tuple[str, ...] = ()
    media_types: tuple[str, ...] = ()
    message_type: str = "text"


FetchMediaFn = Callable[[str, int], Awaitable[FetchedMedia]]
CacheMediaFn = Callable[..., Any]


class MediaDownloadError(Exception):
    pass


class MediaTooLargeError(MediaDownloadError):
    def __init__(self, observed_size_bytes: int, max_bytes: int):
        super().__init__(f"media exceeds {max_bytes} byte limit")
        self.observed_size_bytes = observed_size_bytes
        self.max_bytes = max_bytes


class UnsafeMediaUrlError(MediaDownloadError):
    pass


def parse_blob_data(blob: str | None) -> list[BlobEntry]:
    """Parse supported post blob entries.

    Unknown, a2ui, malformed, or future-version entries are intentionally
    invisible to media handling and history rendering.
    """
    if not blob:
        return []
    try:
        parsed = json.loads(blob)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []

    entries: list[BlobEntry] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        entry_type = str(item.get("type") or "").strip()
        if entry_type not in {"file", "voicememo", "video"}:
            continue
        if _parse_int(item.get("version")) != 1:
            continue
        entries.append(
            BlobEntry(
                type=entry_type,
                version=1,
                file_uri=str(item.get("fileUri") or "").strip(),
                name=str(item.get("name") or "").strip(),
                mime_type=str(item.get("mimeType") or "").strip(),
                size=_parse_non_negative_int(item.get("size")),
                duration=_parse_positive_float(item.get("duration")),
                transcription=str(item.get("transcription") or "").strip(),
            )
        )
    return entries


def extract_story_images(content: Any) -> list[StoryImage]:
    if not isinstance(content, list):
        return []
    images: list[StoryImage] = []
    for verse in content:
        if not isinstance(verse, dict):
            continue
        block = verse.get("block")
        if not isinstance(block, dict):
            continue
        image = block.get("image")
        if not isinstance(image, dict):
            continue
        src = str(image.get("src") or "").strip()
        if src:
            images.append(StoryImage(url=src, alt=str(image.get("alt") or "").strip()))
    return images


def format_blob_annotations(blob_data: Sequence[BlobEntry]) -> str:
    lines: list[str] = []
    for entry in blob_data:
        lines.extend(_format_blob_entry(entry, mode="annotation"))
    return "\n".join(lines)


def format_blob_for_history(blob_data: Sequence[BlobEntry]) -> str:
    lines: list[str] = []
    for entry in blob_data:
        lines.extend(_format_blob_entry(entry, mode="history"))
    return "\n".join(lines)


def render_content_with_blob(text: str, blob: str | None, *, compact: bool) -> str:
    entries = parse_blob_data(blob)
    annotation = (
        format_blob_for_history(entries) if compact else format_blob_annotations(entries)
    )
    parts = [part for part in (annotation, str(text or "").strip()) if part]
    return "\n".join(parts)


async def prepare_inbound_media(
    content: Any,
    blob: str | None,
    *,
    fetcher: FetchMediaFn | None = None,
    cache_media: CacheMediaFn | None = None,
    max_bytes: int = MAX_BLOB_DOWNLOAD_BYTES,
) -> PreparedMedia:
    blob_entries = parse_blob_data(blob)
    annotation = format_blob_annotations(blob_entries)
    downloads = [
        *_story_image_downloads(extract_story_images(content)),
        *_blob_downloads(blob_entries),
    ]

    cached: list[CachedAttachment] = []
    notices: list[str] = []
    fetch = fetcher or fetch_media_bytes
    cache = cache_media or _cache_media_bytes

    for media in downloads:
        if not _is_http_url(media.uri):
            continue
        if media.size is not None and media.size > max_bytes:
            notices.append(_too_large_notice(media, media.size, max_bytes))
            continue
        try:
            fetched = await fetch(media.uri, max_bytes)
        except MediaTooLargeError as exc:
            notices.append(_too_large_notice(media, exc.observed_size_bytes, max_bytes))
            continue
        except Exception as exc:
            logger.debug("[tlon-media] failed to fetch %s: %s", media.uri, exc)
            notices.append(f"[blob not downloaded: {media.label} could not be fetched]")
            continue

        mime_type = _clean_mime(media.mime_type) or _clean_mime(fetched.content_type)
        filename = (
            media.filename
            or fetched.filename
            or _filename_from_url(fetched.final_url or media.uri)
            or _fallback_filename(media, mime_type)
        )
        try:
            result = cache(
                fetched.data,
                filename=filename,
                mime_type=mime_type,
                default_kind=media.default_kind,
            )
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:
            logger.debug("[tlon-media] failed to cache %s: %s", media.uri, exc)
            notices.append(f"[blob not downloaded: {media.label} could not be cached]")
            continue

        if result is None:
            notices.append(_unsupported_notice(media, mime_type or filename))
            continue
        cached.append(
            CachedAttachment(
                path=str(getattr(result, "path", "") or ""),
                media_type=str(getattr(result, "media_type", "") or mime_type),
                kind=str(getattr(result, "kind", "") or _kind_from_mime(mime_type)),
                source_type=media.source_type,
            )
        )

    media_urls = tuple(item.path for item in cached if item.path)
    media_types = tuple(item.media_type for item in cached if item.path)
    prefix_parts = [part for part in (annotation, *notices) if part]
    return PreparedMedia(
        text_prefix="\n".join(prefix_parts),
        media_urls=media_urls,
        media_types=media_types,
        message_type=_message_type_for_cached(cached),
    )


async def fetch_media_bytes(url: str, max_bytes: int) -> FetchedMedia:
    try:
        import aiohttp
    except ImportError as exc:  # pragma: no cover - adapter connect already checks this
        raise MediaDownloadError("aiohttp is not installed") from exc

    current = url
    timeout = aiohttp.ClientTimeout(total=90, connect=15, sock_read=60)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for _ in range(MAX_REDIRECTS + 1):
            await _assert_safe_http_url(current)
            async with session.get(current, allow_redirects=False) as response:
                if 300 <= response.status < 400:
                    location = response.headers.get("location")
                    if not location:
                        raise MediaDownloadError("redirect missing location")
                    current = urljoin(current, location)
                    continue
                if response.status < 200 or response.status >= 300:
                    raise MediaDownloadError(f"download returned HTTP {response.status}")

                declared = _parse_non_negative_int(response.headers.get("content-length"))
                if declared is not None and declared > max_bytes:
                    raise MediaTooLargeError(declared, max_bytes)

                data = bytearray()
                async for chunk in response.content.iter_chunked(64 * 1024):
                    data.extend(chunk)
                    if len(data) > max_bytes:
                        raise MediaTooLargeError(len(data), max_bytes)

                content_type = response.headers.get("content-type") or ""
                final_url = str(response.url or current)
                filename = _filename_from_content_disposition(
                    response.headers.get("content-disposition")
                )
                return FetchedMedia(
                    data=bytes(data),
                    content_type=content_type,
                    final_url=final_url,
                    filename=filename,
                )
        raise MediaDownloadError("too many redirects")


def _format_blob_entry(entry: BlobEntry, *, mode: str) -> list[str]:
    if entry.type == "file":
        name = entry.name or _filename_from_url(entry.file_uri) or "file"
        if mode == "history":
            return [f"[📎 {name}]"]
        mime = entry.mime_type or _mime_from_url(entry.file_uri) or "unknown"
        size = format_file_size(entry.size) if entry.size is not None else "?"
        return [f"📎 [{name}] ({mime}, {size}) {entry.file_uri}".rstrip()]

    if entry.type == "voicememo":
        if mode == "history":
            if entry.transcription:
                return [f'[🎙️ voice memo: "{entry.transcription}"]']
            dur = f", {_round_seconds(entry.duration)}s" if entry.duration else ""
            return [f"[🎙️ voice memo{dur}]"]

        dur = f"{_round_seconds(entry.duration)}s" if entry.duration else "?"
        lines = [f"🎙️ [voice memo] ({dur}) {entry.file_uri}".rstrip()]
        if entry.transcription:
            lines.append(f'  "{entry.transcription}"')
        return lines

    if entry.type == "video":
        name = entry.name or _filename_from_url(entry.file_uri) or "video"
        if mode == "history":
            return [f"[🎬 {name}]"]
        mime = entry.mime_type or _mime_from_url(entry.file_uri) or "video"
        size = format_file_size(entry.size) if entry.size is not None else "?"
        return [f"🎬 [{name}] ({mime}, {size}) {entry.file_uri}".rstrip()]

    return []


def format_file_size(size_bytes: int | None) -> str:
    if size_bytes is None:
        return "?"
    if size_bytes < 1024:
        return f"{size_bytes}B"
    if size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024)}KB"
    return f"{size_bytes / (1024 * 1024):.1f}MB"


def _round_seconds(value: float) -> int:
    return int(value + 0.5)


def _story_image_downloads(images: Sequence[StoryImage]) -> list[DownloadableMedia]:
    downloads: list[DownloadableMedia] = []
    for image in images:
        filename = _filename_from_url(image.url)
        label = image.alt or filename or "image"
        downloads.append(
            DownloadableMedia(
                uri=image.url,
                source_type="story-image",
                label=label,
                filename=filename,
                mime_type=_mime_from_url(image.url),
                default_kind="image",
            )
        )
    return downloads


def _blob_downloads(entries: Sequence[BlobEntry]) -> list[DownloadableMedia]:
    downloads: list[DownloadableMedia] = []
    for entry in entries:
        filename = entry.name or _filename_from_url(entry.file_uri)
        mime = entry.mime_type or _mime_from_url(entry.file_uri)
        if entry.type == "voicememo":
            downloads.append(
                DownloadableMedia(
                    uri=entry.file_uri,
                    source_type=entry.type,
                    label="voice memo",
                    filename=filename or "voice-memo.m4a",
                    mime_type=mime,
                    size=entry.size,
                    default_kind="audio",
                )
            )
        elif entry.type == "video":
            downloads.append(
                DownloadableMedia(
                    uri=entry.file_uri,
                    source_type=entry.type,
                    label=entry.name or filename or "video",
                    filename=filename or "video.mp4",
                    mime_type=mime,
                    size=entry.size,
                    default_kind="video",
                )
            )
        else:
            downloads.append(
                DownloadableMedia(
                    uri=entry.file_uri,
                    source_type=entry.type,
                    label=entry.name or filename or "blob attachment",
                    filename=filename,
                    mime_type=mime,
                    size=entry.size,
                    default_kind=_kind_from_mime(mime),
                )
            )
    return downloads


def _message_type_for_cached(cached: Sequence[CachedAttachment]) -> str:
    if not cached:
        return "text"
    kinds = [item.kind for item in cached]
    if all(kind == "image" for kind in kinds):
        return "photo"
    if all(item.source_type == "voicememo" and item.kind == "audio" for item in cached):
        return "voice"
    if all(kind == "audio" for kind in kinds):
        return "audio"
    if all(kind == "video" for kind in kinds):
        return "video"
    return "document"


def _cache_media_bytes(data: bytes, **kwargs: Any) -> Any:
    from gateway.platforms.base import cache_media_bytes

    return cache_media_bytes(data, **kwargs)


async def _assert_safe_http_url(url: str) -> ParseResult:
    parsed = _parse_http_url(url)
    if parsed is None:
        raise UnsafeMediaUrlError("media URL must be http(s)")
    host = parsed.hostname or ""
    if host.lower() in {"localhost", "ip6-localhost", "ip6-loopback"}:
        raise UnsafeMediaUrlError("media URL resolves to a local host")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        infos = await asyncio.to_thread(
            socket.getaddrinfo, host, port, type=socket.SOCK_STREAM
        )
        for info in infos:
            address = info[4][0]
            if not _is_public_ip(address):
                raise UnsafeMediaUrlError("media URL resolves to a private address")
    else:
        if not _is_public_ip(str(ip)):
            raise UnsafeMediaUrlError("media URL points to a private address")
    return parsed


def _is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return ip.is_global and not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _is_http_url(url: str) -> bool:
    return _parse_http_url(url) is not None


def _parse_http_url(url: str) -> ParseResult | None:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.netloc or not parsed.hostname:
        return None
    return parsed


def _clean_mime(value: str | None) -> str:
    return str(value or "").split(";", 1)[0].strip().lower()


def _mime_from_url(url: str) -> str:
    path = urlparse(str(url or "")).path
    mime, _ = mimetypes.guess_type(path)
    return mime or ""


def _filename_from_url(url: str) -> str:
    path = urlparse(str(url or "")).path
    name = unquote(os.path.basename(path))
    return name if name and "." in name else ""


def _filename_from_content_disposition(value: str | None) -> str:
    if not value:
        return ""
    for part in str(value).split(";"):
        part = part.strip()
        if part.lower().startswith("filename="):
            return part.split("=", 1)[1].strip().strip('"')
    return ""


def _fallback_filename(media: DownloadableMedia, mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type) if mime_type else ""
    if media.source_type == "story-image":
        return f"image{ext or '.jpg'}"
    if media.source_type == "voicememo":
        return f"voice-memo{ext or '.m4a'}"
    if media.source_type == "video":
        return f"video{ext or '.mp4'}"
    return f"attachment{ext or ''}"


def _kind_from_mime(mime_type: str) -> Optional[str]:
    mime = _clean_mime(mime_type)
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("audio/"):
        return "audio"
    if mime.startswith("video/"):
        return "video"
    return None


def _unsupported_notice(media: DownloadableMedia, detail: str) -> str:
    suffix = f" ({detail})" if detail else ""
    return f"[blob not downloaded: {media.label} has unsupported type{suffix}]"


def _too_large_notice(media: DownloadableMedia, size_bytes: int, max_bytes: int) -> str:
    return (
        f"[blob not downloaded: {media.label} is {format_file_size(size_bytes)}, "
        f"over the {format_file_size(max_bytes)} limit]"
    )


def _parse_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_non_negative_int(value: Any) -> Optional[int]:
    parsed = _parse_int(value)
    return parsed if parsed is not None and parsed >= 0 else None


def _parse_positive_float(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None
