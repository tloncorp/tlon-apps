"""Hermes platform plugin for Tlon.

Inbound messages are read from Eyre SSE subscriptions. Outbound messages are
sent through the ``tlon`` CLI so this adapter reuses the same packaged Tlon API
surface as local/dev workflows.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
from dataclasses import replace
from pathlib import Path
from typing import Any, Dict, Optional

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageType,
    SendResult,
)

from .attention import AttentionFacts, resolve_attention
from .mention import (
    BotMentionMatcher,
    build_bot_mention_terms,
    extract_profile_nickname,
)
from .image_search import (
    IMAGE_SEARCH_TOOL_DESCRIPTION,
    IMAGE_SEARCH_TOOL_SCHEMA,
    check_image_search_requirements,
    handle_image_search_tool,
)
from .tlon_api import (
    MAX_MESSAGE_LENGTH,
    TlonCLI,
    TlonConfig,
    TlonGatewayStatus,
    TlonIncomingMessage,
    TlonSSEClient,
    normalize_ship,
    parse_channel_message,
    parse_dm_message,
)
from .presence import (
    TlonComputingPresenceReporter,
    TlonComputingPresenceTracker,
    clear_active_computing_presence_tracker,
    handle_post_api_request,
    handle_pre_tool_call,
    set_active_computing_presence_tracker,
)
from .tlon_tool import (
    TLON_TOOL_DESCRIPTION,
    TLON_TOOL_SCHEMA,
    check_tlon_tool_requirements,
    handle_tlon_tool,
    resolve_tlon_skill_path,
)

logger = logging.getLogger(__name__)

RECONNECT_BACKOFF_SECONDS = (2, 5, 10, 30, 60)
REQUIRED_ENV = ["TLON_NODE_URL", "TLON_NODE_ID", "TLON_ACCESS_CODE"]
OPTIONAL_ENV = [
    "TLON_CHANNELS",
    "TLON_AUTO_DISCOVER",
    "TLON_ALLOWED_USERS",
    "TLON_ALLOW_ALL_USERS",
    "TLON_DM_ALLOWLIST",
    "TLON_OWNER_SHIP",
    "TLON_HOME_CHANNEL",
    "TLON_BOT_MENTIONS",
    "TLON_FREE_RESPONSE_CHANNELS",
    "TLON_REQUIRE_MENTION",
    "TLON_KNOWN_BOT_USERS",
    "TLON_MAX_CONSECUTIVE_BOT_RESPONSES",
    "TLON_CLI",
    "TLON_SSE_READ_TIMEOUT_SECONDS",
    "TLON_GATEWAY_STATUS",
    "TLON_GATEWAY_STATUS_OWNER",
    "BRAVE_SEARCH_API_KEY",
    "BRAVE_API_KEY",
]

try:
    import aiohttp as _aiohttp  # noqa: F401

    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False


def _is_dm_chat_id(chat_id: str) -> bool:
    chat = str(chat_id or "").strip()
    return bool(chat.startswith("~") and normalize_ship(chat) == chat)


def _cli_available(cli: str | None = None) -> bool:
    candidate = cli or os.getenv("TLON_CLI", "tlon")
    if not candidate:
        return False
    if Path(candidate).expanduser().exists():
        return True
    return shutil.which(candidate) is not None


def check_requirements() -> bool:
    return AIOHTTP_AVAILABLE and _cli_available()


def validate_config(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    tlon = TlonConfig.from_env(extra)
    return tlon.is_complete() and _cli_available(tlon.cli)


def is_connected(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    return TlonConfig.from_env(extra).is_complete()


class TlonAdapter(BasePlatformAdapter):
    MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH

    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform("tlon"))
        self.tlon_config = TlonConfig.from_env(config.extra or {})
        self._cli = TlonCLI(self.tlon_config)
        self._sse: Optional[TlonSSEClient] = None
        self._stream_task: Optional[asyncio.Task] = None
        self._gateway_status = TlonGatewayStatus(self.tlon_config)
        self._computing_presence = TlonComputingPresenceTracker(
            reporter=TlonComputingPresenceReporter(self.tlon_config)
        )
        self._seen_ids: set[str] = set()
        self._seen_order: list[str] = []
        self._monitored_channels = set(self.tlon_config.channels)
        self._mention_matcher = self._build_mention_matcher()
        self._participated_threads: set[str] = set()
        self._known_bot_consecutive_by_channel: dict[str, int] = {}

    async def connect(self) -> bool:
        if not AIOHTTP_AVAILABLE:
            logger.warning("[tlon] aiohttp is not installed")
            return False
        if not self.tlon_config.is_complete():
            logger.warning("[tlon] TLON node URL/id/access code is not configured")
            return False
        if not _cli_available(self.tlon_config.cli):
            logger.warning("[tlon] tlon CLI is not available: %s", self.tlon_config.cli)
            return False

        try:
            await self._connect_sse()
            await self._load_bot_nickname()
            await self._start_gateway_status()
            self._stream_task = asyncio.create_task(self._run_stream())
            self._computing_presence.bind_loop(asyncio.get_running_loop())
            set_active_computing_presence_tracker(self._computing_presence)
            self._mark_connected()
            logger.info("[tlon] connected to %s as %s", self.tlon_config.ship_url, self.tlon_config.ship_name)
            return True
        except Exception as exc:
            logger.error("[tlon] connect failed: %s", exc, exc_info=True)
            await self._close_sse(graceful=False)
            return False

    async def disconnect(self) -> None:
        self._mark_disconnected()
        clear_active_computing_presence_tracker(self._computing_presence)
        await self._computing_presence.close()
        await self._stop_gateway_status("shutdown")
        if self._stream_task is not None:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
            self._stream_task = None
        await self._close_sse()
        self._seen_ids.clear()
        self._seen_order.clear()
        self._participated_threads.clear()
        self._known_bot_consecutive_by_channel.clear()

    def _build_mention_matcher(self, *, nickname: str = "") -> BotMentionMatcher:
        return BotMentionMatcher(
            build_bot_mention_terms(
                self.tlon_config.ship_name,
                aliases=self.tlon_config.bot_mentions,
                nickname=nickname,
            )
        )

    async def _load_bot_nickname(self) -> None:
        if self._sse is None:
            return
        try:
            profile = await self._sse.scry("/contacts/v1/self.json")
            nickname = extract_profile_nickname(profile)
        except Exception as exc:
            logger.debug("[tlon] could not fetch self profile nickname: %s", exc)
            return
        if not nickname:
            logger.debug("[tlon] self profile nickname is empty")
            return
        self._mention_matcher = self._build_mention_matcher(nickname=nickname)
        logger.info("[tlon] loaded bot nickname for wake detection: %s", nickname)

    async def _start_gateway_status(self) -> None:
        try:
            await self._gateway_status.start()
        except Exception as exc:
            logger.warning("[tlon] gateway-status activation failed: %s", exc)

    async def _stop_gateway_status(self, reason: str) -> None:
        try:
            await self._gateway_status.stop(reason)
        except Exception as exc:
            logger.warning("[tlon] gateway-status shutdown failed: %s", exc)

    async def _connect_sse(self) -> None:
        await self._close_sse()
        self._sse = TlonSSEClient(self.tlon_config)
        await self._sse.authenticate()
        await self._sse.open()
        await self._sse.subscribe("channels", "/v2")
        await self._sse.subscribe("chat", "/v3")

    async def _close_sse(self, *, graceful: bool = True) -> None:
        if self._sse is not None:
            try:
                await self._sse.close(graceful=graceful)
            finally:
                self._sse = None

    async def _run_stream(self) -> None:
        backoff_idx = 0
        while self._running:
            try:
                if self._sse is None:
                    await self._connect_sse()
                assert self._sse is not None
                async for event in self._sse.events():
                    if not self._running:
                        return
                    backoff_idx = 0
                    if event.app == "channels":
                        await self._handle_channel_event(event.json)
                    elif event.app == "chat":
                        await self._handle_dm_event(event.json)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                if not self._running:
                    return
                logger.warning("[tlon] SSE stream error: %s", exc)
                await self._close_sse(graceful=False)
                delay = RECONNECT_BACKOFF_SECONDS[min(backoff_idx, len(RECONNECT_BACKOFF_SECONDS) - 1)]
                backoff_idx += 1
                await asyncio.sleep(delay)

    async def _handle_channel_event(self, raw: Any) -> None:
        if not isinstance(raw, dict):
            return
        nest = raw.get("nest")
        if not isinstance(nest, str) or not nest:
            return
        if nest not in self._monitored_channels:
            if self.tlon_config.auto_discover and (nest.startswith("chat/") or nest.startswith("heap/")):
                self._monitored_channels.add(nest)
                logger.info("[tlon] auto-discovered channel %s", nest)
            else:
                return

        message = parse_channel_message(raw, self_ship=self.tlon_config.ship_name)
        if message is None:
            return

        is_mentioned = self._mention_matcher.mentioned(message.text)
        clean_text = (
            self._mention_matcher.strip_leading(message.text)
            if is_mentioned
            else message.text.strip()
        )
        is_authorized = self.tlon_config.user_allowed(message.user_id, is_dm=False)
        is_participated_thread = self._is_participated_thread(message)
        is_free_response = self.tlon_config.group_free_response_enabled(message.chat_id)
        decision = resolve_attention(
            AttentionFacts(
                is_dm=False,
                is_authorized=is_authorized,
                has_text=bool(clean_text),
                is_mentioned=is_mentioned,
                is_free_response=is_free_response,
                is_participated_thread=is_participated_thread,
            )
        )
        if not decision.dispatch:
            if decision.reason == "unauthorized":
                logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if not self._mark_seen(message):
            return
        if not self._passes_group_loop_safety(message):
            return
        await self._dispatch_message(
            replace(message, text=clean_text),
            is_dm=False,
            mark_seen=False,
        )

    async def _handle_dm_event(self, raw: Any) -> None:
        if isinstance(raw, list):
            logger.debug("[tlon] ignoring DM invite event")
            return
        message = parse_dm_message(raw, self_ship=self.tlon_config.ship_name)
        if message is None:
            return
        await self._dispatch_message(message, is_dm=True)

    def _is_participated_thread(self, message: TlonIncomingMessage) -> bool:
        if not message.reply_to_message_id:
            return False
        return self._thread_key(message.chat_id, message.reply_to_message_id) in self._participated_threads

    def _passes_group_loop_safety(self, message: TlonIncomingMessage) -> bool:
        known_bots = self.tlon_config.known_bot_users
        if not known_bots:
            return True

        channel = message.chat_id
        sender = normalize_ship(message.user_id)
        if sender in known_bots:
            count = self._known_bot_consecutive_by_channel.get(channel, 0) + 1
            self._known_bot_consecutive_by_channel[channel] = count
            if count > self.tlon_config.max_consecutive_bot_responses:
                logger.info(
                    "[tlon] dropping known-bot message from %s in %s after %s consecutive dispatch attempts",
                    sender,
                    channel,
                    count,
                )
                return False
            return True

        self._known_bot_consecutive_by_channel[channel] = 0
        return True

    async def _dispatch_message(
        self,
        message: TlonIncomingMessage,
        *,
        is_dm: bool,
        mark_seen: bool = True,
    ) -> None:
        if not self.tlon_config.user_allowed(message.user_id, is_dm=is_dm):
            logger.info("[tlon] ignoring unauthorized ship %s", message.user_id)
            return
        if mark_seen and not self._mark_seen(message):
            return

        reply_context = None if is_dm else message.reply_to_message_id
        source = self.build_source(
            chat_id=message.chat_id,
            chat_name=message.chat_name,
            chat_type=message.chat_type,
            user_id=message.user_id,
            user_name=message.user_name,
            thread_id=reply_context,
            message_id=message.message_id,
        )
        event = MessageEvent(
            text=message.text,
            message_type=MessageType.TEXT,
            source=source,
            raw_message=message.raw,
            message_id=message.message_id,
            reply_to_message_id=reply_context,
            timestamp=message.sent_at,
        )
        await self.handle_message(event)

    async def on_processing_start(self, event: MessageEvent) -> None:
        await self._computing_presence.refresh_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )

    async def on_processing_complete(self, event: MessageEvent, outcome: Any) -> None:
        del outcome
        await self._computing_presence.stop_run(
            conversation_id=event.source.chat_id,
            run_id=self._presence_run_id(event),
        )

    @staticmethod
    def _presence_run_id(event: MessageEvent) -> str:
        source = getattr(event, "source", None)
        return str(
            getattr(event, "message_id", None)
            or getattr(source, "message_id", None)
            or getattr(source, "thread_id", None)
            or getattr(source, "chat_id", None)
            or id(event)
        )

    def _mark_seen(self, message: TlonIncomingMessage) -> bool:
        key = f"{message.chat_type}:{message.chat_id}:{message.message_id}"
        if key in self._seen_ids:
            return False
        self._seen_ids.add(key)
        self._seen_order.append(key)
        if len(self._seen_order) > 1000:
            old = self._seen_order.pop(0)
            self._seen_ids.discard(old)
        return True

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        content = (content or "")[: self.MAX_MESSAGE_LENGTH]
        metadata = metadata or {}
        is_channel_reply = bool(reply_to and not _is_dm_chat_id(chat_id))
        if is_channel_reply:
            parent_author = metadata.get("parent_author")
            if not parent_author and chat_id.startswith("~"):
                parent_author = chat_id
            result = await self._cli.send_reply(
                chat_id,
                reply_to,
                content,
                parent_author=parent_author,
            )
        else:
            result = await self._cli.send_message(chat_id, content)

        raw_response = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
        if result.success and is_channel_reply and reply_to:
            self._participated_threads.add(self._thread_key(chat_id, reply_to))
        return SendResult(
            success=result.success,
            message_id=result.message_id,
            error=result.error,
            raw_response=raw_response,
            retryable=result.returncode == 124,
        )

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        chat_type = "dm" if normalize_ship(chat_id) == chat_id and chat_id.startswith("~") else "group"
        return {"name": chat_id, "type": chat_type}

    @staticmethod
    def _thread_key(chat_id: str, post_id: str) -> str:
        return f"{chat_id}:{post_id}"


def _env_enablement() -> dict | None:
    tlon = TlonConfig.from_env()
    if not tlon.is_complete():
        return None
    _ensure_owner_authorized_for_core(tlon)
    seed: dict[str, Any] = {
        "node_url": tlon.ship_url,
        "node_id": tlon.ship_name,
        "cli": tlon.cli,
    }
    if tlon.ship_code:
        seed["access_code"] = tlon.ship_code
    if tlon.cookie:
        seed["cookie"] = tlon.cookie
    if tlon.channels:
        seed["channels"] = ",".join(tlon.channels)
    if tlon.auto_discover:
        seed["auto_discover"] = True
    if tlon.bot_mentions:
        seed["bot_mentions"] = ",".join(tlon.bot_mentions)
    if tlon.free_response_channels:
        seed["free_response_channels"] = ",".join(tlon.free_response_channels)
    if not tlon.require_mention:
        seed["require_mention"] = False
    if tlon.known_bot_users:
        seed["known_bot_users"] = ",".join(sorted(tlon.known_bot_users))
    if tlon.owner_ship:
        seed["owner_ship"] = tlon.owner_ship
    if tlon.gateway_status_owner:
        seed["gateway_status_owner"] = tlon.gateway_status_owner
    home = tlon.default_home_channel_id()
    if home:
        seed["home_channel"] = {"chat_id": home, "name": home}
    return seed


def _ensure_owner_authorized_for_core(tlon: TlonConfig) -> None:
    owner = tlon.owner_ship
    if not owner:
        return
    if os.getenv("TLON_ALLOW_ALL_USERS", "").strip().lower() in {"true", "1", "yes"}:
        return

    raw = os.getenv("TLON_ALLOWED_USERS", "").strip()
    allowed = [part.strip() for part in raw.split(",") if part.strip()]
    if "*" in allowed or owner in allowed:
        return
    os.environ["TLON_ALLOWED_USERS"] = ",".join([*allowed, owner])


def _session_env(name: str, default: str = "") -> str:
    try:
        from gateway.session_context import get_session_env
    except Exception:
        return os.getenv(name, default)
    return get_session_env(name, default)


def block_tlon_session_tool(tool_name: str, args: Optional[dict] = None, **_kwargs: Any) -> Optional[dict]:
    del args
    if _session_env("HERMES_SESSION_PLATFORM", "").lower() != "tlon":
        return None
    if str(tool_name or "").strip() == "skill_manage":
        return {
            "action": "block",
            "message": (
                "Blocked: Tlon chat sessions use the managed Tlon prompt and "
                "plugin-owned tlon skill. Do not create or modify Hermes skills "
                "while handling a Tlon message."
            ),
        }
    return None


async def _standalone_send(
    pconfig,
    chat_id: str,
    message: str,
    *,
    thread_id: Optional[str] = None,
    media_files: Optional[list[str]] = None,
    force_document: bool = False,
) -> Dict[str, Any]:
    del media_files, force_document
    extra = getattr(pconfig, "extra", {}) or {}
    tlon = TlonConfig.from_env(extra)
    if not tlon.is_complete():
        return {"error": "tlon standalone send: TLON node URL/id/access code not configured"}
    cli = TlonCLI(tlon)
    if thread_id and not _is_dm_chat_id(chat_id):
        parent_author = chat_id if str(chat_id).startswith("~") else None
        result = await cli.send_reply(chat_id, thread_id, message, parent_author=parent_author)
    else:
        result = await cli.send_message(chat_id, message)
    if not result.success:
        return {"error": result.error or "tlon standalone send failed"}
    return {
        "success": True,
        "platform": "tlon",
        "chat_id": chat_id,
        "message_id": result.message_id,
    }


def register(ctx) -> None:
    ctx.register_hook("pre_tool_call", handle_pre_tool_call)
    ctx.register_hook("pre_tool_call", block_tlon_session_tool)
    ctx.register_hook("post_api_request", handle_post_api_request)

    ctx.register_tool(
        name="tlon",
        toolset="tlon",
        schema=TLON_TOOL_SCHEMA,
        handler=handle_tlon_tool,
        check_fn=check_tlon_tool_requirements,
        is_async=True,
        description=TLON_TOOL_DESCRIPTION,
        emoji="T",
    )
    ctx.register_tool(
        name="image_search",
        toolset="tlon",
        schema=IMAGE_SEARCH_TOOL_SCHEMA,
        handler=handle_image_search_tool,
        check_fn=check_image_search_requirements,
        is_async=True,
        description=IMAGE_SEARCH_TOOL_DESCRIPTION,
        emoji="I",
    )

    skill_path = resolve_tlon_skill_path()
    if skill_path is not None:
        ctx.register_skill(
            "tlon",
            skill_path,
            description="Tlon CLI command guide for the Hermes tlon tool.",
        )

    ctx.register_platform(
        name="tlon",
        label="Tlon",
        adapter_factory=lambda cfg: TlonAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        is_connected=is_connected,
        required_env=REQUIRED_ENV,
        install_hint="pip install aiohttp && npm install -g @tloncorp/tlon-skill",
        env_enablement_fn=_env_enablement,
        cron_deliver_env_var="TLON_HOME_CHANNEL",
        standalone_sender_fn=_standalone_send,
        allowed_users_env="TLON_ALLOWED_USERS",
        allow_all_env="TLON_ALLOW_ALL_USERS",
        max_message_length=MAX_MESSAGE_LENGTH,
        emoji="T",
        pii_safe=False,
        allow_update_command=True,
        platform_hint=(
            "You are communicating through Tlon Messenger on Urbit. "
            "Users are identified by ship names such as ~sampel-palnet. "
            "You are an assistant running on the configured Tlon bot node; "
            "that node has its own Tlon profile, contacts, groups, channels, "
            "and settings. When the configured owner asks to change your "
            "Tlon nickname, avatar, bio, status, or cover image, use the tlon "
            "tool rather than saying an AI assistant has no profile. For "
            "avatars and covers, first upload a direct raster image URL or "
            "local image with tlon upload, then set the returned uploaded URL "
            "with contacts update-profile. If image_search is available, use "
            "it to find image URLs for user-requested avatars, covers, and "
            "other image media. Do not use SVG profile images. "
            "For Tlon reads and administration, use the tlon tool; if unsure, "
            "load skill_view(\"tlon-platform:tlon\") or run a tlon subcommand "
            "with --help. "
            "When a user asks you to create a Tlon group for them, use "
            "groups create-owned with --owner set to that user's ship so they "
            "are invited and made admin. "
            "Use concise plain text and basic markdown."
        ),
    )
