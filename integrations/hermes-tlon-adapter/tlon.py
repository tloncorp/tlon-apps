"""
Tlon (Urbit) platform adapter for Hermes Gateway.

Connects to a Tlon ship via Eyre HTTP API:
- Authenticates with ship +code
- Subscribes to channel messages (channels /v2) and DMs (chat /v3) via SSE
- Sends messages back via pokes

Requires: aiohttp (pip install aiohttp)

Environment variables:
  TLON_SHIP_URL    - Ship URL (e.g. https://sampel-palnet.tlon.network)
  TLON_SHIP_NAME   - Ship name (e.g. ~sampel-palnet)
  TLON_SHIP_CODE   - Ship +code for authentication
  TLON_CHANNELS    - Comma-separated channel nests to monitor (e.g. chat/~host/channel)
  TLON_DM_ALLOWLIST - Comma-separated ships allowed to DM (empty = all allowed)
  TLON_HOME_CHANNEL - Default channel for cron delivery
  TLON_ALLOWED_USERS - Comma-separated ships allowed to interact
  TLON_ALLOW_ALL_USERS - Set to "true" to allow all users (default: false)
  TLON_AUTO_DISCOVER - Set to "true" to auto-discover all group channels
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageType,
    SendResult,
    cache_image_from_bytes,
)

# Maximum message length for Tlon (generous - Tlon handles long messages well)
MAX_MESSAGE_LENGTH = 10000


def check_tlon_requirements() -> bool:
    """Check if aiohttp is available for HTTP/SSE communication."""
    try:
        import aiohttp
        return True
    except ImportError:
        logger.warning("Tlon adapter requires aiohttp. Install with: pip install aiohttp")
        return False


def _normalize_ship(ship: str) -> str:
    """Normalize a ship name to include ~ prefix."""
    ship = ship.strip()
    if ship and not ship.startswith("~"):
        ship = "~" + ship
    return ship


def _parse_channel_nest(nest: str) -> Optional[Dict[str, str]]:
    """Parse a channel nest like 'chat/~host/channel-name'."""
    parts = nest.split("/", 2)
    if len(parts) != 3:
        return None
    return {
        "type": parts[0],       # chat, heap, diary
        "host": parts[1],       # ~host-ship
        "name": parts[2],       # channel-name
    }


def _extract_message_text(content: Any) -> str:
    """
    Extract plain text from Tlon's story/content format.

    Tlon messages use a 'story' format: an array of blocks.
    Each block is either:
      - {"inline": [...]} with text strings, links, mentions, etc.
      - {"block": {"image": {...}}} for images
      - {"block": {"cite": {...}}} for quotes
    """
    if not content:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Inline block: {"inline": [...]}
                if "inline" in block:
                    for inline in block["inline"]:
                        if isinstance(inline, str):
                            parts.append(inline)
                        elif isinstance(inline, dict):
                            # Bold, italic, etc.
                            if "bold" in inline:
                                parts.append(_extract_inline_text(inline["bold"]))
                            elif "italics" in inline:
                                parts.append(_extract_inline_text(inline["italics"]))
                            elif "strike" in inline:
                                parts.append(_extract_inline_text(inline["strike"]))
                            elif "blockquote" in inline:
                                parts.append(_extract_inline_text(inline["blockquote"]))
                            elif "inline-code" in inline:
                                parts.append(inline["inline-code"])
                            elif "code" in inline:
                                parts.append(inline["code"])
                            elif "link" in inline:
                                link = inline["link"]
                                href = link.get("href", "")
                                link_content = link.get("content", href)
                                parts.append(link_content if link_content else href)
                            elif "ship" in inline:
                                parts.append(_normalize_ship(inline["ship"]))
                            elif "break" in inline:
                                parts.append("\n")
                            elif "tag" in inline:
                                parts.append(f"#{inline['tag']}")
                # Block types
                elif "block" in block:
                    b = block["block"]
                    if isinstance(b, dict):
                        if "image" in b:
                            img = b["image"]
                            alt = img.get("alt", "")
                            src = img.get("src", "")
                            parts.append(f"[image: {alt or src}]")
                        elif "cite" in b:
                            parts.append("[quoted message]")
                        elif "code" in b:
                            code = b["code"]
                            lang = code.get("lang", "")
                            body = code.get("code", "")
                            parts.append(f"```{lang}\n{body}\n```")
        return " ".join(p for p in parts if p).strip()

    return str(content)


def _extract_inline_text(inlines: Any) -> str:
    """Recursively extract text from inline content."""
    if isinstance(inlines, str):
        return inlines
    if isinstance(inlines, list):
        parts = []
        for item in inlines:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if "ship" in item:
                    parts.append(_normalize_ship(item["ship"]))
                elif "link" in item:
                    parts.append(item["link"].get("content", item["link"].get("href", "")))
                elif "bold" in item:
                    parts.append(_extract_inline_text(item["bold"]))
                elif "italics" in item:
                    parts.append(_extract_inline_text(item["italics"]))
                elif "inline-code" in item:
                    parts.append(item["inline-code"])
                elif "break" in item:
                    parts.append("\n")
        return "".join(parts)
    return ""


def _text_to_story(text: str) -> list:
    """
    Convert plain text/markdown to Tlon's story format.

    Returns a list of story blocks suitable for use as post content.
    """
    # Simple conversion: wrap text as inline blocks, split on double newlines
    # for paragraph breaks
    blocks = []
    paragraphs = text.split("\n\n")
    for i, para in enumerate(paragraphs):
        if not para.strip():
            continue
        # Convert each paragraph to an inline block
        inlines = []
        # Handle @mentions (ship names)
        parts = re.split(r'(~[a-z][\w-]*)', para)
        for part in parts:
            if re.match(r'^~[a-z][\w-]*$', part):
                inlines.append({"ship": part if part.startswith("~") else f"~{part}"})
            elif part:
                inlines.append(part)
        if inlines:
            blocks.append({"inline": inlines})
        # Add line break between paragraphs (except after last)
        if i < len(paragraphs) - 1:
            blocks.append({"inline": [{"break": None}]})
    if not blocks:
        blocks = [{"inline": [""]}]
    return blocks


def _format_ud(num: int) -> str:
    """
    Format a number as Urbit @ud (dot-separated groups of 3 digits).

    Example: 170141184505128523237 → "170.141.184.505.128.523.237"
    """
    s = str(num)
    # Insert dots every 3 digits from the right
    groups = []
    while len(s) > 3:
        groups.append(s[-3:])
        s = s[:-3]
    groups.append(s)
    return ".".join(reversed(groups))


# Urbit @da epoch offset and second size (from @urbit/aura)
_DA_UNIX_EPOCH = 170141184475152167957503069145530368000
_DA_SECOND = 18446744073709551616


def _da_from_unix(unix_ms: int) -> str:
    """
    Convert Unix timestamp (ms) to Urbit @da bigint, returned as @ud string.

    Replicates: formatUd(da.fromUnix(sentAt).toString()) from @urbit/aura.
    """
    time_since_epoch = unix_ms * _DA_SECOND // 1000
    da_value = _DA_UNIX_EPOCH + time_since_epoch
    return _format_ud(da_value)


class TlonSSEClient:
    """
    Manages an Eyre SSE channel for subscribing to Tlon events.

    Handles:
    - Authentication via POST /~/login
    - Channel creation via PUT /~/channel/{id}
    - SSE event streaming via GET /~/channel/{id}
    - Event acknowledgement
    - Reconnection with exponential backoff
    """

    def __init__(
        self,
        url: str,
        code: str,
        ship: str,
        *,
        auto_reconnect: bool = True,
        max_reconnect_attempts: int = 10,
        reconnect_delay: float = 1.0,
        max_reconnect_delay: float = 30.0,
    ):
        self.url = url.rstrip("/")
        self.code = code
        self.ship = _normalize_ship(ship)
        self.auto_reconnect = auto_reconnect
        self.max_reconnect_attempts = max_reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_delay = max_reconnect_delay

        self.cookie: Optional[str] = None
        self.channel_id: Optional[str] = None
        self.channel_url: Optional[str] = None
        self._session: Optional[Any] = None  # aiohttp.ClientSession
        self._sse_task: Optional[asyncio.Task] = None
        self._aborted = False
        self._connected = False
        self._reconnect_attempts = 0
        self._action_counter = 0

        # Subscription tracking
        self._subscriptions: List[Dict[str, Any]] = []
        self._event_handlers: Dict[int, Dict[str, Any]] = {}

        # Event ack tracking
        self._last_heard_event_id = -1
        self._last_acked_event_id = -1
        self._ack_threshold = 20

    async def authenticate(self) -> str:
        """Authenticate with the ship and return the cookie."""
        import aiohttp

        if not self._session:
            self._session = aiohttp.ClientSession()

        async with self._session.post(
            f"{self.url}/~/login",
            data={"password": self.code},
            allow_redirects=False,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status not in (200, 204, 302, 303, 307):
                raise ConnectionError(f"Auth failed: HTTP {resp.status}")
            cookie = resp.headers.get("set-cookie", "")
            if not cookie:
                # Try from cookies jar
                for c in self._session.cookie_jar:
                    if c.key.startswith("urbauth"):
                        cookie = f"{c.key}={c.value}"
                        break
            if not cookie:
                raise ConnectionError("No auth cookie received")
            self.cookie = cookie
            logger.info("[tlon] Authenticated as %s", self.ship)
            return cookie

    async def _new_channel_id(self) -> str:
        """Generate a new unique channel ID."""
        ts = int(time.time())
        uid = uuid.uuid4().hex[:8]
        return f"{ts}-{uid}"

    def _next_action_id(self) -> int:
        """Get the next action ID for channel operations."""
        self._action_counter += 1
        return self._action_counter

    async def subscribe(
        self,
        app: str,
        path: str,
        on_event: Optional[Any] = None,
        on_error: Optional[Any] = None,
        on_quit: Optional[Any] = None,
    ) -> int:
        """
        Subscribe to a Gall agent path.

        Returns the subscription ID.
        """
        sub_id = self._next_action_id()
        sub = {
            "id": sub_id,
            "action": "subscribe",
            "ship": self.ship.lstrip("~"),
            "app": app,
            "path": path,
        }
        self._subscriptions.append(sub)
        self._event_handlers[sub_id] = {
            "event": on_event,
            "err": on_error,
            "quit": on_quit,
        }

        # If already connected, send subscription immediately
        if self._connected:
            await self._send_actions([sub])

        return sub_id

    async def _send_actions(self, actions: List[Dict[str, Any]]) -> None:
        """Send actions to the Eyre channel."""
        import aiohttp

        action_types = [a.get("action", "?") for a in actions]
        logger.debug("[tlon] Sending %d action(s) to %s: %s",
                     len(actions), self.channel_url, action_types)

        # Let the cookie jar handle auth (set by authenticate())
        async with self._session.put(
            self.channel_url,
            json=actions,
            headers={"Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status not in (200, 204):
                text = await resp.text()
                logger.error("[tlon] Channel action failed: HTTP %d - %s",
                            resp.status, text[:200])
                raise ConnectionError(
                    f"Channel action failed: HTTP {resp.status} - {text[:200]}"
                )
            logger.debug("[tlon] Action(s) sent OK: HTTP %d", resp.status)

    async def connect(self) -> None:
        """
        Create the Eyre channel with initial subscriptions and start
        the SSE event stream.
        """
        self.channel_id = await self._new_channel_id()
        self.channel_url = f"{self.url}/~/channel/{self.channel_id}"

        # Create channel with all pending subscriptions
        if self._subscriptions:
            await self._send_actions(self._subscriptions)

        # Start SSE stream
        await self._open_stream()
        self._connected = True
        self._reconnect_attempts = 0
        logger.info("[tlon] SSE connected on channel %s", self.channel_id)

    async def _open_stream(self) -> None:
        """Open the SSE GET stream."""
        # Let cookie jar handle auth
        headers = {"Accept": "text/event-stream"}
        self._sse_task = asyncio.create_task(self._stream_loop(headers))

    async def _stream_loop(self, headers: Dict[str, str]) -> None:
        """Read the SSE stream and dispatch events."""
        import aiohttp

        try:
            async with self._session.get(
                self.channel_url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(
                    total=None,  # No total timeout for SSE
                    sock_read=None,  # No read timeout
                    connect=60,
                ),
            ) as resp:
                if resp.status != 200:
                    raise ConnectionError(f"SSE stream failed: HTTP {resp.status}")

                buffer = ""
                async for chunk in resp.content.iter_any():
                    if self._aborted:
                        break
                    buffer += chunk.decode("utf-8", errors="replace")

                    while "\n\n" in buffer:
                        event_data, buffer = buffer.split("\n\n", 1)
                        await self._process_event(event_data)

        except asyncio.CancelledError:
            return
        except Exception as e:
            if not self._aborted:
                logger.error("[tlon] SSE stream error: %s", e)
                self._connected = False
                if self.auto_reconnect:
                    await self._attempt_reconnect()

    async def _process_event(self, event_data: str) -> None:
        """Parse and dispatch a single SSE event."""
        lines = event_data.split("\n")
        data = None
        event_id = None

        for line in lines:
            if line.startswith("id: "):
                try:
                    event_id = int(line[4:])
                except ValueError:
                    pass
            elif line.startswith("data: "):
                data = line[6:]

        if not data:
            return

        logger.debug("[tlon] SSE event id=%s, data=%s", event_id, data[:120])

        # Track and ack events
        if event_id is not None and event_id > self._last_heard_event_id:
            self._last_heard_event_id = event_id
            if event_id - self._last_acked_event_id > self._ack_threshold:
                asyncio.create_task(self._ack(event_id))

        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            logger.debug("[tlon] Non-JSON SSE data: %s", data[:100])
            return

        # Handle quit events (agent kicked us)
        if parsed.get("response") == "quit":
            sub_id = parsed.get("id")
            if sub_id and sub_id in self._event_handlers:
                handler = self._event_handlers[sub_id]
                if handler.get("quit"):
                    handler["quit"]()
                # Auto-resubscribe
                asyncio.create_task(self._resubscribe(sub_id))
            return

        # Dispatch to handlers
        sub_id = parsed.get("id")
        event_json = parsed.get("json")
        resp_type = parsed.get("response", "")

        logger.debug("[tlon] Dispatching: sub_id=%s, response=%s, has_json=%s, handlers=%s",
                     sub_id, resp_type, event_json is not None, list(self._event_handlers.keys()))

        if sub_id and sub_id in self._event_handlers:
            handler = self._event_handlers[sub_id]
            if handler.get("event") and event_json is not None:
                try:
                    await handler["event"](event_json)
                except Exception as e:
                    logger.error("[tlon] Event handler error: %s", e)
        elif event_json is not None:
            logger.debug("[tlon] Ignoring event with unknown sub_id=%s", sub_id)

    async def _ack(self, event_id: int) -> None:
        """Acknowledge events up to event_id."""
        self._last_acked_event_id = event_id
        try:
            await self._send_actions([{
                "id": self._next_action_id(),
                "action": "ack",
                "event-id": event_id,
            }])
        except Exception as e:
            logger.debug("[tlon] Ack failed: %s", e)

    async def _resubscribe(self, old_sub_id: int) -> None:
        """Re-subscribe after a quit event."""
        old_sub = None
        for sub in self._subscriptions:
            if sub["id"] == old_sub_id:
                old_sub = sub
                break
        if not old_sub:
            return

        handlers = self._event_handlers.get(old_sub_id)
        if not handlers:
            return

        for attempt in range(5):
            delay = min(2.0 * (2 ** attempt), 30.0)
            logger.info("[tlon] Resubscribing to %s%s in %.0fs...",
                       old_sub["app"], old_sub["path"], delay)
            await asyncio.sleep(delay)

            if self._aborted or not self._connected:
                return

            try:
                new_id = self._next_action_id()
                new_sub = {**old_sub, "id": new_id}
                self._subscriptions.append(new_sub)
                self._event_handlers[new_id] = handlers
                del self._event_handlers[old_sub_id]
                await self._send_actions([new_sub])
                logger.info("[tlon] Resubscribed to %s%s", old_sub["app"], old_sub["path"])
                return
            except Exception as e:
                logger.error("[tlon] Resubscribe failed: %s", e)

    async def _attempt_reconnect(self) -> None:
        """Reconnect with exponential backoff."""
        if self._aborted:
            return

        while self._reconnect_attempts < self.max_reconnect_attempts:
            self._reconnect_attempts += 1
            delay = min(
                self.reconnect_delay * (2 ** (self._reconnect_attempts - 1)),
                self.max_reconnect_delay,
            )
            logger.info("[tlon] Reconnecting in %.1fs (attempt %d/%d)...",
                       delay, self._reconnect_attempts, self.max_reconnect_attempts)
            await asyncio.sleep(delay)

            if self._aborted:
                return

            try:
                # Re-authenticate
                await self.authenticate()
                # New channel
                self.channel_id = await self._new_channel_id()
                self.channel_url = f"{self.url}/~/channel/{self.channel_id}"
                # Reconnect
                await self.connect()
                logger.info("[tlon] Reconnected successfully!")
                return
            except Exception as e:
                logger.error("[tlon] Reconnect failed: %s", e)

        # Reset and keep trying
        logger.warning("[tlon] Max reconnect attempts reached, resetting counter...")
        await asyncio.sleep(10)
        self._reconnect_attempts = 0
        await self._attempt_reconnect()

    async def poke(self, app: str, mark: str, json_data: Any) -> None:
        """
        Send a poke via a one-shot Eyre channel.

        Uses a separate channel from the SSE stream (matching openclaw-tlon's
        http-poke.ts pattern). Sending pokes on the SSE channel can cause
        them to be silently dropped.
        """
        import aiohttp

        poke_channel_id = await self._new_channel_id()
        poke_url = f"{self.url}/~/channel/{poke_channel_id}"

        action = {
            "id": int(time.time() * 1000),
            "action": "poke",
            "ship": self.ship.lstrip("~"),
            "app": app,
            "mark": mark,
            "json": json_data,
        }

        logger.info("[tlon] One-shot poke to %s mark=%s json=%s",
                    poke_url, mark, json.dumps(json_data)[:300])
        async with self._session.put(
            poke_url,
            json=[action],
            headers={"Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status not in (200, 204):
                text = await resp.text()
                logger.error("[tlon] Poke failed: HTTP %d - %s", resp.status, text[:200])
                raise ConnectionError(f"Poke failed: HTTP {resp.status}")
            logger.debug("[tlon] Poke PUT OK: HTTP %d", resp.status)

        # Read SSE ack/nack from the one-shot channel
        try:
            ack_url = f"{poke_url}?msg=0"
            async with self._session.get(
                ack_url,
                headers={"Accept": "text/event-stream"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as ack_resp:
                async for line in ack_resp.content:
                    decoded = line.decode("utf-8", errors="replace").strip()
                    if not decoded:
                        continue
                    if decoded.startswith("data:"):
                        data_str = decoded[5:].strip()
                        try:
                            data = json.loads(data_str)
                            if data.get("ok") is not None:
                                logger.info("[tlon] Poke ACK: %s", data)
                                break
                            elif data.get("err"):
                                logger.error("[tlon] Poke NACK: %s", data)
                                break
                            elif "ok" in str(data) or "err" in str(data):
                                logger.info("[tlon] Poke response: %s", data)
                                break
                        except json.JSONDecodeError:
                            if "ok" in data_str or "err" in data_str:
                                logger.info("[tlon] Poke SSE raw: %s", data_str[:200])
                                break
        except asyncio.TimeoutError:
            logger.warning("[tlon] Poke ack read timed out (5s)")
        except Exception as e:
            logger.warning("[tlon] Poke ack read error: %s", e)

    async def scry(self, path: str) -> Any:
        """Scry a path and return the JSON response."""
        import aiohttp

        full_path = path if path.endswith(".json") else f"{path}.json"
        # Use /~/scry prefix for Eyre scry endpoint
        scry_url = f"{self.url}/~/scry{full_path}"
        async with self._session.get(
            scry_url,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Scry failed: HTTP {resp.status} - {text[:200]}")
            return await resp.json()

    async def close(self) -> None:
        """Close the SSE connection and clean up."""
        self._aborted = True
        self._connected = False

        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass

        # Try to clean up the Eyre channel
        if self._session and self.channel_url:
            try:
                # Unsubscribe
                unsubs = [
                    {"id": sub["id"], "action": "unsubscribe", "subscription": sub["id"]}
                    for sub in self._subscriptions
                ]
                if unsubs:
                    await self._send_actions(unsubs)
            except Exception:
                pass

            try:
                await self._session.delete(
                    self.channel_url,
                    timeout=aiohttp.ClientTimeout(total=5),
                )
            except Exception:
                pass

        if self._session:
            await self._session.close()
            self._session = None


class TlonAdapter(BasePlatformAdapter):
    """
    Hermes Gateway adapter for Tlon (Urbit).

    Connects to a Tlon ship and monitors channels + DMs for messages,
    dispatching them to the Hermes agent session store.
    """

    MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH

    def __init__(self, config: PlatformConfig):
        super().__init__(config, Platform.TLON)

        # Read config from env vars (following Hermes convention)
        self.ship_url = os.getenv("TLON_SHIP_URL", "").rstrip("/")
        self.ship_name = _normalize_ship(os.getenv("TLON_SHIP_NAME", ""))
        self.ship_code = os.getenv("TLON_SHIP_CODE", "")

        # Channels to monitor
        channels_str = os.getenv("TLON_CHANNELS", "")
        self.monitored_channels: Set[str] = set(
            ch.strip() for ch in channels_str.split(",") if ch.strip()
        )

        # DM allowlist
        dm_str = os.getenv("TLON_DM_ALLOWLIST", "")
        self.dm_allowlist: Set[str] = set(
            _normalize_ship(s) for s in dm_str.split(",") if s.strip()
        )

        # User allowlist (for authorization)
        users_str = os.getenv("TLON_ALLOWED_USERS", "")
        self.allowed_users: Set[str] = set(
            _normalize_ship(s) for s in users_str.split(",") if s.strip()
        )
        self.allow_all = os.getenv("TLON_ALLOW_ALL_USERS", "").lower() in ("true", "1", "yes")

        # Auto-discover channels
        self.auto_discover = os.getenv("TLON_AUTO_DISCOVER", "").lower() in ("true", "1", "yes")

        # SSE client
        self._sse: Optional[TlonSSEClient] = None

        # Dedup tracker
        self._processed_ids: Set[str] = set()
        self._max_processed = 2000

        # Bot nickname cache
        self._bot_nickname: Optional[str] = None

        # Send dedup: prevent identical messages within a short window
        self._recent_sends: Dict[str, float] = {}  # hash -> timestamp

        # Thread-safe dedup lock for message processing
        self._process_lock = asyncio.Lock()

    async def connect(self) -> bool:
        """Connect to the Tlon ship and start listening."""
        if not self.ship_url or not self.ship_name or not self.ship_code:
            logger.error("[tlon] Missing config: TLON_SHIP_URL, TLON_SHIP_NAME, TLON_SHIP_CODE")
            return False

        try:
            self._sse = TlonSSEClient(
                url=self.ship_url,
                code=self.ship_code,
                ship=self.ship_name,
            )

            # Authenticate
            await self._sse.authenticate()

            # Fetch bot profile for nickname
            try:
                profile = await self._sse.scry("/contacts/v1/self.json")
                if profile and isinstance(profile, dict):
                    self._bot_nickname = profile.get("nickname", {}).get("value")
                    if self._bot_nickname:
                        logger.info("[tlon] Bot nickname: %s", self._bot_nickname)
            except Exception as e:
                logger.debug("[tlon] Could not fetch self profile: %s", e)

            # Auto-discover channels from groups
            if self.auto_discover:
                try:
                    discovered = await self._discover_channels()
                    self.monitored_channels.update(discovered)
                    logger.info("[tlon] Auto-discovered %d channel(s)", len(discovered))
                except Exception as e:
                    logger.warning("[tlon] Auto-discovery failed: %s", e)

            if self.monitored_channels:
                logger.info("[tlon] Monitoring %d channel(s): %s",
                           len(self.monitored_channels),
                           ", ".join(sorted(self.monitored_channels)))
            else:
                logger.info("[tlon] No group channels configured (DMs only)")

            # Subscribe to channels firehose (/v2) for group messages
            await self._sse.subscribe(
                app="channels",
                path="/v2",
                on_event=self._handle_channel_event,
                on_error=lambda e: logger.error("[tlon] Channels error: %s", e),
                on_quit=lambda: logger.info("[tlon] Channels quit received"),
            )

            # Subscribe to chat firehose (/v3) for DMs
            await self._sse.subscribe(
                app="chat",
                path="/v3",
                on_event=self._handle_dm_event,
                on_error=lambda e: logger.error("[tlon] Chat error: %s", e),
                on_quit=lambda: logger.info("[tlon] Chat quit received"),
            )

            # Connect and start streaming
            await self._sse.connect()

            self._running = True
            logger.info("[tlon] Connected and listening!")
            return True

        except Exception as e:
            logger.error("[tlon] Connection failed: %s", e)
            return False

    async def disconnect(self) -> None:
        """Disconnect from the Tlon ship."""
        self._running = False
        if self._sse:
            await self._sse.close()
            self._sse = None
        logger.info("[tlon] Disconnected")

    async def handle_message(self, event) -> None:
        """Override base adapter's handle_message to bypass the pending-message
        replay system which causes echo loops on Tlon.

        The base adapter queues messages that arrive while an agent is running
        and replays them after the response is sent — but those replayed
        messages re-trigger the agent, creating duplicate responses.

        Instead we process each message directly in its own background task
        with no replay/interrupt machinery."""
        if not self._message_handler:
            return

        async def _run():
            try:
                response = await self._message_handler(event)
                if response:
                    _, response = self.extract_media(response)
                    images, text_content = self.extract_images(response)
                    if text_content:
                        # For thread replies, pass reply_to so the response
                        # goes into the thread (not as a new top-level post).
                        # reply_to_message_id is set by inbound handlers when
                        # the message came from a thread.
                        reply_to = getattr(event, "reply_to_message_id", None)
                        logger.info("[tlon] Sending response (%d chars) to %s reply_to=%s",
                                    len(text_content), event.source.chat_id, reply_to)
                        await self.send(
                            chat_id=event.source.chat_id,
                            content=text_content,
                            reply_to=reply_to,
                        )
                    for img_url, alt in images:
                        await self.send_image(
                            chat_id=event.source.chat_id,
                            image_url=img_url,
                            caption=alt or None,
                        )
            except Exception as e:
                logger.error("[tlon] handle_message error: %s", e, exc_info=True)

        asyncio.create_task(_run())

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """
        Send a message to a Tlon channel or DM.

        chat_id: channel nest (e.g. "chat/~host/channel") or ship name for DMs
        """
        if not self._sse or not self._sse._connected:
            logger.error("[tlon] Send called but not connected!")
            return SendResult(success=False, error="Not connected")

        try:
            sent_at = int(time.time() * 1000)

            # Dedup: skip identical messages to the same chat within 30s
            import hashlib
            send_hash = hashlib.md5(f"{chat_id}:{content}".encode()).hexdigest()
            now = time.time()
            # Clean old entries
            self._recent_sends = {k: v for k, v in self._recent_sends.items() if now - v < 30}
            if send_hash in self._recent_sends:
                logger.info("[tlon] Dedup: skipping duplicate send to %s (%d chars)", chat_id, len(content))
                return SendResult(success=True, message_id=f"dedup/{sent_at}")
            self._recent_sends[send_hash] = now

            story = _text_to_story(content)
            logger.info("[tlon] Sending to %s (%d chars, story=%d blocks)",
                       chat_id, len(content), len(story))

            if chat_id.startswith("~"):
                # DM — pass reply_to for thread replies
                # reply_to should be the parent writ-id (e.g. "~ship/170.141...")
                await self._send_dm(chat_id, story, sent_at, reply_to=reply_to)
            else:
                # Channel post — pass reply_to for thread replies
                # reply_to should be the parent post ID (bare or @ud formatted)
                formatted_reply = None
                if reply_to:
                    # Format as @ud if it's a bare digit string
                    bare = str(reply_to).replace(".", "")
                    if bare.isdigit():
                        formatted_reply = _format_ud(int(bare))
                    else:
                        formatted_reply = str(reply_to)
                await self._send_channel_post(chat_id, story, sent_at, reply_to=formatted_reply)

            msg_id = f"{self.ship_name}/{sent_at}"
            logger.info("[tlon] ✓ Message sent: %s", msg_id)
            return SendResult(success=True, message_id=msg_id)

        except Exception as e:
            logger.error("[tlon] Send failed: %s", e, exc_info=True)
            return SendResult(success=False, error=str(e))

    async def _send_dm(
        self,
        to_ship: str,
        story: list,
        sent_at: int,
        reply_to: Optional[str] = None,
    ) -> None:
        """Send a DM via %chat poke."""
        to_ship = _normalize_ship(to_ship)
        # Author uses ~ prefix (matching @tloncorp/api)
        author = self.ship_name  # e.g. "~timryd-macnus"

        # Build the writ ID: author/formatUd(da.fromUnix(sentAt))
        ud_time = _da_from_unix(sent_at)
        writ_id = f"{author}/{ud_time}"

        if reply_to:
            # DM reply uses "reply" delta with "memo" (not "essay")
            delta = {
                "reply": {
                    "id": writ_id,
                    "meta": None,
                    "delta": {
                        "add": {
                            "memo": {
                                "content": story,
                                "author": author,
                                "sent": sent_at,
                            },
                            "time": None,
                        },
                    },
                }
            }
            dm_json = {
                "ship": to_ship,
                "diff": {
                    "id": reply_to,
                    "delta": delta,
                },
            }
        else:
            # Top-level DM uses "add" delta with "essay"
            delta = {
                "add": {
                    "essay": {
                        "content": story,
                        "author": author,
                        "sent": sent_at,
                        "kind": "/chat",
                        "meta": None,
                        "blob": None,
                    },
                    "time": None,
                }
            }
            dm_json = {
                "ship": to_ship,
                "diff": {
                    "id": writ_id,
                    "delta": delta,
                },
            }

        logger.debug("[tlon] DM poke JSON: %s", json.dumps(dm_json)[:500])
        await self._sse.poke(
            app="chat",
            mark="chat-dm-action-1",
            json_data=dm_json,
        )

    async def _send_channel_post(
        self,
        nest: str,
        story: list,
        sent_at: int,
        reply_to: Optional[str] = None,
    ) -> None:
        """Send a post to a channel (chat, heap, diary)."""
        # Author field WITH ~ prefix (matching @tloncorp/api convention)
        author = self.ship_name if self.ship_name.startswith("~") else f"~{self.ship_name}"

        # Determine kind from nest type
        kind = "/chat"
        if nest.startswith("diary/"):
            kind = "/diary"
        elif nest.startswith("heap/"):
            kind = "/heap"

        if reply_to:
            # Channel reply: post.reply.action.add has flat fields
            action_json = {
                "channel": {
                    "nest": nest,
                    "action": {
                        "post": {
                            "reply": {
                                "id": reply_to,
                                "action": {
                                    "add": {
                                        "content": story,
                                        "author": author,
                                        "sent": sent_at,
                                    }
                                },
                            }
                        }
                    },
                }
            }
        else:
            # Top-level post: post.add has essay fields directly (no wrapper)
            action_json = {
                "channel": {
                    "nest": nest,
                    "action": {
                        "post": {
                            "add": {
                                "content": story,
                                "author": author,
                                "sent": sent_at,
                                "kind": kind,
                                "meta": None,
                                "blob": None,
                            }
                        }
                    },
                }
            }

        logger.debug("[tlon] Channel poke JSON: %s", json.dumps(action_json)[:500])
        await self._sse.poke(
            app="channels",
            mark="channel-action-1",
            json_data=action_json,
        )

    async def send_image(
        self,
        chat_id: str,
        image_url: str,
        caption: Optional[str] = None,
        reply_to: Optional[str] = None,
    ) -> SendResult:
        """Send an image as a Tlon story block with optional caption."""
        story = []
        if caption:
            story.extend(_text_to_story(caption))
        # Add image block
        story.append({
            "block": {
                "image": {
                    "src": image_url,
                    "alt": caption or "",
                    "width": 0,
                    "height": 0,
                }
            }
        })

        sent_at = int(time.time() * 1000)
        try:
            if chat_id.startswith("~"):
                await self._send_dm(chat_id, story, sent_at, reply_to)
            else:
                await self._send_channel_post(chat_id, story, sent_at, reply_to)
            return SendResult(success=True, message_id=f"{self.ship_name}/{sent_at}")
        except Exception as e:
            return SendResult(success=False, error=str(e))

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        """Get info about a chat/channel."""
        if chat_id.startswith("~"):
            return {
                "name": chat_id,
                "type": "dm",
                "chat_id": chat_id,
            }
        parsed = _parse_channel_nest(chat_id)
        return {
            "name": parsed["name"] if parsed else chat_id,
            "type": "group",
            "chat_id": chat_id,
        }

    def _is_bot_mentioned(self, text: str) -> bool:
        """Check if the bot is mentioned in the text."""
        text_lower = text.lower()
        # Check ship name mention
        if self.ship_name.lower() in text_lower:
            return True
        # Check nickname mention
        if self._bot_nickname and self._bot_nickname.lower() in text_lower:
            return True
        return False

    def _strip_bot_mention(self, text: str) -> str:
        """Remove bot mentions from text."""
        # Remove ship name
        text = re.sub(
            re.escape(self.ship_name),
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        # Remove nickname if set
        if self._bot_nickname:
            text = re.sub(
                re.escape(self._bot_nickname),
                "",
                text,
                flags=re.IGNORECASE,
            ).strip()
        return text

    def _mark_processed(self, msg_id: str) -> bool:
        """
        Mark a message ID as processed. Returns True if this is new,
        False if already processed (duplicate).
        """
        if msg_id in self._processed_ids:
            logger.info("[tlon] Dedup: already processed %s", msg_id[:40])
            return False
        self._processed_ids.add(msg_id)
        logger.info("[tlon] Dedup: marking new %s (total=%d)", msg_id[:40], len(self._processed_ids))
        # Trim old entries
        if len(self._processed_ids) > self._max_processed:
            # Remove oldest entries (set doesn't preserve order, but this is fine
            # for dedup purposes - we just prevent unbounded growth)
            excess = len(self._processed_ids) - self._max_processed
            to_remove = list(self._processed_ids)[:excess]
            for item in to_remove:
                self._processed_ids.discard(item)
        return True

    async def _discover_channels(self) -> Set[str]:
        """Discover channels from groups the bot is a member of."""
        channels: Set[str] = set()
        try:
            # Scry all groups
            groups = await self._sse.scry("/groups/v1/groups.json")
            if not isinstance(groups, dict):
                return channels

            for group_flag, group_data in groups.items():
                if not isinstance(group_data, dict):
                    continue
                group_channels = group_data.get("channels", {})
                if not isinstance(group_channels, dict):
                    continue
                for nest in group_channels:
                    # Only monitor chat and heap channels
                    if nest.startswith("chat/") or nest.startswith("heap/"):
                        channels.add(nest)
        except Exception as e:
            logger.debug("[tlon] Channel discovery scry failed: %s", e)
        return channels

    async def _handle_channel_event(self, event: Any) -> None:
        """
        Handle a channels firehose (/v2) event.

        Event structure for new posts:
        {
          "nest": "chat/~host/channel",
          "response": {
            "post": {
              "id": "170141...",
              "r-post": {
                "set": {
                  "revision": "0",
                  "seal": { "id": "...", ... },
                  "essay": {
                    "author": "~ship",
                    "sent": 1773...,
                    "kind": "/chat",
                    "content": [{"inline": ["text"]}],
                    ...
                  },
                  "type": "post"
                }
              }
            }
          }
        }
        """
        try:
            if not isinstance(event, dict):
                return

            nest = event.get("nest")
            if not nest:
                return

            # Auto-watch channels from firehose
            if nest not in self.monitored_channels:
                if self.auto_discover and (nest.startswith("chat/") or nest.startswith("heap/")):
                    self.monitored_channels.add(nest)
                    logger.info("[tlon] Auto-watching channel: %s", nest)
                else:
                    return

            response = event.get("response")
            if not response:
                return

            # Extract post data
            post = response.get("post")
            if not post or not isinstance(post, dict):
                return

            msg_id = post.get("id")
            r_post = post.get("r-post", {})
            if not r_post:
                return

            # Two event shapes:
            # 1) Top-level post: r-post.set.essay  (type="post")
            # 2) Thread reply:   r-post.reply["r-reply"].set.memo
            post_data = r_post.get("set") or {}
            essay = post_data.get("essay") if isinstance(post_data, dict) else None

            reply_data = r_post.get("reply")
            reply_memo = None
            reply_id = None
            is_thread_reply = False
            if reply_data and isinstance(reply_data, dict):
                reply_id = reply_data.get("id")
                r_reply = reply_data.get("r-reply", {})
                if r_reply:
                    reply_set = r_reply.get("set")
                    if reply_set and isinstance(reply_set, dict):
                        reply_memo = reply_set.get("memo") or reply_set.get("essay")
                        is_thread_reply = True

            content = reply_memo or essay
            if not content:
                return

            effective_id = reply_id if is_thread_reply else msg_id

            event_type = "reply" if is_thread_reply else "post"
            logger.info("[tlon] Channel event: nest=%s msg_id=%s type=%s is_reply=%s",
                        nest, msg_id, event_type, is_thread_reply)

            # Use lock to prevent race condition with concurrent event processing
            async with self._process_lock:
                if not effective_id or not self._mark_processed(str(effective_id)):
                    logger.info("[tlon] Channel dedup: skipping %s", effective_id)
                    return
                # Lock released after this block — but we've claimed the msg_id

            sender = _normalize_ship(content.get("author", ""))
            if not sender or sender == self.ship_name:
                return

            text = _extract_message_text(content.get("content"))
            if not text.strip():
                return

            logger.info("[tlon] Channel msg from %s in %s: %s",
                       sender, nest, text[:80])

            # In group channels, only respond to mentions
            if not self._is_bot_mentioned(text):
                logger.debug("[tlon] Not mentioned, ignoring")
                return

            # Check user authorization
            if not self._is_user_allowed(sender):
                logger.info("[tlon] Unauthorized user %s in %s", sender, nest)
                return

            # Strip bot mention from text
            clean_text = self._strip_bot_mention(text)
            logger.info("[tlon] Processing message from %s: %s", sender, clean_text[:80])

            # Get seal for thread context
            if is_thread_reply:
                reply_set = reply_data.get("r-reply", {}).get("set", {})
                seal = reply_set.get("seal", {}) if isinstance(reply_set, dict) else {}
            else:
                seal = post_data.get("seal", {}) if isinstance(post_data, dict) else {}
            parent_id = seal.get("parent-id") or seal.get("parent")

            # Build message event
            parsed = _parse_channel_nest(nest)
            source = self.build_source(
                chat_id=nest,
                chat_name=parsed["name"] if parsed else nest,
                chat_type="group",
                user_id=sender,
                user_name=sender,
                thread_id=str(parent_id) if parent_id else None,
            )

            event_obj = MessageEvent(
                text=clean_text,
                message_type=MessageType.TEXT,
                source=source,
                message_id=str(msg_id),
                reply_to_message_id=str(parent_id) if parent_id else None,
                timestamp=datetime.fromtimestamp(
                    content.get("sent", time.time() * 1000) / 1000
                ),
            )

            await self.handle_message(event_obj)

        except Exception as e:
            logger.error("[tlon] Channel event error: %s", e, exc_info=True)

    async def _handle_dm_event(self, event: Any) -> None:
        """Handle a chat firehose (/v3) event."""
        try:
            logger.info("[tlon] _handle_dm_event called, keys=%s",
                        list(event.keys()) if isinstance(event, dict) else type(event).__name__)
            # Handle DM invite arrays
            if isinstance(event, list):
                for invite in event:
                    ship = _normalize_ship(invite.get("ship", ""))
                    if ship and self._is_user_allowed(ship):
                        try:
                            await self._sse.poke(
                                app="chat",
                                mark="chat-dm-rsvp",
                                json_data={"ship": ship.lstrip("~"), "ok": True},
                            )
                            logger.info("[tlon] Auto-accepted DM invite from %s", ship)
                        except Exception as e:
                            logger.error("[tlon] Failed to accept DM from %s: %s", ship, e)
                return

            if not isinstance(event, dict):
                return

            if "whom" not in event or "response" not in event:
                return

            whom = event["whom"]
            msg_id = event.get("id")
            response = event["response"]

            # Extract message content
            essay = response.get("add", {}).get("essay") if isinstance(response.get("add"), dict) else None
            dm_reply_memo = None
            dm_reply = response.get("reply")
            if isinstance(dm_reply, dict):
                dm_reply_memo = (dm_reply.get("delta", {})
                                .get("add", {})
                                .get("memo"))

            content = essay or dm_reply_memo
            if not content:
                return

            is_thread_reply = bool(dm_reply_memo)
            effective_id = msg_id
            if is_thread_reply and dm_reply:
                effective_id = dm_reply.get("id") or dm_reply.get("delta", {}).get("add", {}).get("id") or msg_id

            async with self._process_lock:
                if not effective_id or not self._mark_processed(str(effective_id)):
                    return

            sender = _normalize_ship(content.get("author", ""))
            # Extract DM partner from whom field
            partner = _normalize_ship(whom) if isinstance(whom, str) else ""

            logger.info("[tlon] DM event: whom=%s, sender=%s, self=%s",
                        whom, sender, self.ship_name)

            # Skip our own messages (author == us)
            if sender == self.ship_name:
                logger.info("[tlon] Skipping own DM message")
                return

            # Use partner for routing, author for identity
            effective_sender = partner or sender
            if not effective_sender:
                return

            text = _extract_message_text(content.get("content"))
            if not text.strip():
                return

            # Check DM authorization (includes dm_allowlist)
            if not self._is_user_allowed(effective_sender, is_dm=True):
                logger.info("[tlon] Unauthorized DM from %s", effective_sender)
                return

            # Build message event
            source = self.build_source(
                chat_id=effective_sender,
                chat_name=effective_sender,
                chat_type="dm",
                user_id=effective_sender,
                user_name=effective_sender,
                thread_id=str(msg_id) if is_thread_reply else None,
            )

            event_obj = MessageEvent(
                text=text,
                message_type=MessageType.TEXT,
                source=source,
                message_id=str(effective_id),
                reply_to_message_id=str(msg_id) if is_thread_reply else None,
                timestamp=datetime.fromtimestamp(
                    content.get("sent", time.time() * 1000) / 1000
                ),
            )

            logger.info("[tlon] >>> Calling handle_message for DM from %s, msg_id=%s", effective_sender, effective_id)
            await self.handle_message(event_obj)

        except Exception as e:
            logger.error("[tlon] DM event error: %s", e, exc_info=True)

    def _is_user_allowed(self, ship: str, is_dm: bool = False) -> bool:
        """Check if a ship is authorized to interact with the bot."""
        # Global allow-all
        global_allow = os.getenv("GATEWAY_ALLOW_ALL_USERS", "").lower() in ("true", "1", "yes")
        if global_allow or self.allow_all:
            return True

        # Check global allowlist
        global_users = os.getenv("GATEWAY_ALLOWED_USERS", "")
        if global_users:
            allowed = set(_normalize_ship(s) for s in global_users.split(",") if s.strip())
            if ship in allowed:
                return True

        # Check Tlon-specific allowlist
        if self.allowed_users and ship in self.allowed_users:
            return True

        # Check DM-specific allowlist
        if is_dm and self.dm_allowlist and ship in self.dm_allowlist:
            return True

        # If no allowlists configured at all, allow (open by default)
        if not self.allowed_users and not global_users and not self.dm_allowlist:
            return True

        return False
