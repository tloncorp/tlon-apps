"""Plugin-owned image search tool for Tlon profile/media workflows."""

from __future__ import annotations

import json
import os
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, Optional

BRAVE_IMAGE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/images/search"
DEFAULT_IMAGE_SEARCH_COUNT = 5
MAX_IMAGE_SEARCH_COUNT = 10

IMAGE_SEARCH_TOOL_DESCRIPTION = (
    "Search Brave Images for direct raster image URLs suitable for Tlon uploads. "
    "Use this when a Tlon user asks for an avatar, cover, image post, meme, "
    "photo, or other visual asset. Pick an Image URL from the results, run "
    "tlon upload on that URL, then use the uploaded URL for Tlon profile or "
    "media operations. Do not pass source/page URLs to tlon upload."
)

IMAGE_SEARCH_TOOL_SCHEMA = {
    "name": "image_search",
    "description": IMAGE_SEARCH_TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Image search query, for example 'smiley face png'.",
            },
            "count": {
                "type": "integer",
                "description": "Maximum number of image candidates to return.",
                "minimum": 1,
                "maximum": MAX_IMAGE_SEARCH_COUNT,
                "default": DEFAULT_IMAGE_SEARCH_COUNT,
            },
        },
        "required": ["query"],
    },
}

FetchJson = Callable[
    [str, Mapping[str, str], Mapping[str, str]],
    Awaitable[Mapping[str, Any]],
]


def _json(data: Mapping[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def brave_image_api_key(env: Optional[Mapping[str, str | None]] = None) -> str:
    values = os.environ if env is None else env
    return str(values.get("BRAVE_SEARCH_API_KEY") or values.get("BRAVE_API_KEY") or "").strip()


def check_image_search_requirements() -> bool:
    if not brave_image_api_key():
        return False
    try:
        import aiohttp as _aiohttp  # noqa: F401
    except Exception:
        return False
    return True


def _coerce_count(raw_count: Any) -> int:
    try:
        count = int(raw_count)
    except (TypeError, ValueError):
        count = DEFAULT_IMAGE_SEARCH_COUNT
    return max(1, min(count, MAX_IMAGE_SEARCH_COUNT))


async def _fetch_brave_image_json(
    url: str,
    params: Mapping[str, str],
    headers: Mapping[str, str],
) -> Mapping[str, Any]:
    import aiohttp

    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url, params=params, headers=headers) as response:
            text = await response.text()
            if response.status >= 400:
                return {
                    "_http_error": True,
                    "status": response.status,
                    "body": text[:500],
                }
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {
                    "_parse_error": True,
                    "body": text[:500],
                }


def _first_non_empty(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _normalize_image_result(raw: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    props = raw.get("properties") if isinstance(raw.get("properties"), Mapping) else {}
    props = props or {}
    thumbnail = raw.get("thumbnail") if isinstance(raw.get("thumbnail"), Mapping) else {}
    profile = raw.get("profile") if isinstance(raw.get("profile"), Mapping) else {}

    image_url = _first_non_empty(props.get("url"), raw.get("url"), thumbnail.get("src"))
    if not image_url.startswith(("http://", "https://")):
        return None

    source_url = _first_non_empty(raw.get("source"), raw.get("page_url"), profile.get("url"))
    result: dict[str, Any] = {
        "title": _first_non_empty(raw.get("title"), raw.get("description")),
        "image_url": image_url,
        "url": image_url,
        "source_url": source_url,
    }

    for key in ("width", "height"):
        value = props.get(key)
        if value not in (None, ""):
            result[key] = value

    content_type = _first_non_empty(props.get("type"), props.get("format"))
    if content_type:
        result["content_type"] = content_type

    return result


def normalize_image_results(payload: Mapping[str, Any], *, limit: int) -> list[dict[str, Any]]:
    raw_results = payload.get("results")
    if not isinstance(raw_results, list):
        return []

    results: list[dict[str, Any]] = []
    for raw in raw_results:
        if not isinstance(raw, Mapping):
            continue
        normalized = _normalize_image_result(raw)
        if normalized is None:
            continue
        results.append(normalized)
        if len(results) >= limit:
            break
    return results


async def execute_image_search_tool(
    params: Mapping[str, Any],
    *,
    env: Optional[Mapping[str, str | None]] = None,
    fetch_json: Optional[FetchJson] = None,
) -> str:
    query = str(params.get("query") or "").strip()
    if not query:
        return _json({"success": False, "error": "Missing required parameter: query"})

    api_key = brave_image_api_key(env)
    if not api_key:
        return _json(
            {
                "success": False,
                "error": "Set BRAVE_SEARCH_API_KEY or BRAVE_API_KEY to enable image_search.",
            }
        )

    count = _coerce_count(params.get("count", DEFAULT_IMAGE_SEARCH_COUNT))
    fetch = fetch_json or _fetch_brave_image_json
    payload = await fetch(
        BRAVE_IMAGE_SEARCH_ENDPOINT,
        {"q": query, "count": str(count)},
        {"X-Subscription-Token": api_key},
    )

    if payload.get("_http_error"):
        return _json(
            {
                "success": False,
                "query": query,
                "error": f"Brave Image Search returned HTTP {payload.get('status')}",
                "details": payload.get("body", ""),
            }
        )
    if payload.get("_parse_error"):
        return _json(
            {
                "success": False,
                "query": query,
                "error": "Brave Image Search returned a non-JSON response.",
                "details": payload.get("body", ""),
            }
        )

    results = normalize_image_results(payload, limit=count)
    return _json(
        {
            "success": True,
            "query": query,
            "results": results,
            "usage": (
                "Use result.image_url (also copied to result.url) with tlon "
                "upload, then use the uploaded URL returned by tlon upload. "
                "Do not use result.source_url for Tlon upload or profile fields."
            ),
        }
    )


async def handle_image_search_tool(params: Mapping[str, Any], **_kwargs: Any) -> str:
    return await execute_image_search_tool(params)
