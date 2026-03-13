# Hermes → Tlon Adapter: Full Context Document

## Goal

Build a messaging platform adapter that connects [Hermes Agent](https://github.com/NousResearch/hermes-agent) to Tlon (Urbit), so users can talk to a Hermes AI agent through Tlon Messenger — same UX as Telegram/Discord/Signal.

We're recreating the core functionality from these two existing OpenClaw projects:
- **[openclaw-tlon](https://github.com/tloncorp/openclaw-tlon)** — OpenClaw's Tlon channel plugin (TypeScript). Handles ship auth, SSE subscriptions, message sending/receiving, story format conversion, reactions, DMs, and channel posts.
- **[tlon-skill](https://github.com/tloncorp/tlon-skill)** — OpenClaw's Tlon skill (AgentSkill). Provides the agent with knowledge of Tlon's API for posting, fetching history, managing channels, contacts, and groups.

The adapter should give Hermes the same capabilities on Tlon that openclaw-tlon gives OpenClaw.

## Draft PR

**https://github.com/tloncorp/tlon-apps/pull/5577**

Branch: `feat/hermes-tlon-adapter`
Location: `integrations/hermes-tlon-adapter/`

## Architecture

### How Hermes Platform Adapters Work

Hermes uses a gateway pattern. Each messaging platform has an adapter in `gateway/platforms/` that inherits from `BasePlatformAdapter` and implements:

- `connect()` → authenticate, subscribe, start listening
- `disconnect()` → clean up
- `send(chat_id, content, reply_to, metadata)` → send a message
- `send_image(chat_id, image_url, caption, reply_to)` → send image
- `get_chat_info(chat_id)` → return chat metadata
- `handle_message(event)` → inherited from base, routes to agent session store

Existing adapters: Telegram, Discord, Slack, WhatsApp, Signal, Email, HomeAssistant.

Source: `~/.hermes/hermes-agent/` or `~/Projects/hermes-agent/`

### How OpenClaw's Tlon Plugin Works (what we're cloning)

**openclaw-tlon** (`~/Projects/openclaw-tlon/src/`):
- `urbit/auth.ts` — POST `/~/login` with +code, get urbauth cookie, handle reconnection
- `urbit/sse-client.ts` — Eyre channel management (PUT to create, GET for SSE stream, event acking, reconnection with backoff)
- `urbit/send.ts` — Sending messages via `@tloncorp/api` library (uses `sendPost`, `sendReply`, `channelAction`)
- `monitor/index.ts` — SSE subscription to channels and DMs firehose, message parsing, dedup, mention detection
- `channel.ts` — Main OpenClaw channel class wiring everything together

**Key patterns from openclaw-tlon that must be replicated:**
1. Auth via `POST /~/login` with ship +code → urbauth cookie
2. Eyre channel lifecycle: PUT to create channel with subscriptions, GET for SSE stream
3. Subscribe to `channels` app on path `/v2` for group messages
4. Subscribe to `chat` app on path `/v3` for DMs
5. Parse Tlon's story format (inline blocks, links, mentions, images, code blocks)
6. Convert markdown to story format for outbound messages
7. @mention detection (ship name or nickname) in group channels
8. DM handling with allowlists
9. Reconnection with exponential backoff
10. Event acking to prevent Eyre channel buildup

**tlon-skill** (`~/.openclaw/skills/tlon/SKILL.md`):
- Wraps the `tlon` CLI tool for the agent
- Lets the agent: list groups/channels, fetch message history, post to channels, send DMs, manage contacts, search messages
- The Hermes equivalent would be adding Tlon-specific tools to the `hermes-tlon` toolset

## What's Been Built

### Files Created/Modified

**New file: `gateway/platforms/tlon.py`** (~1,300 lines)
- `TlonSSEClient` class — manages the full Eyre channel lifecycle
  - `authenticate()` — POST /~/login, stores cookie in aiohttp session cookie jar
  - `subscribe(app, path, on_event)` — registers subscriptions
  - `connect()` — creates Eyre channel, sends subscriptions, opens SSE stream
  - `poke(app, mark, json_data)` — sends pokes through the Eyre channel
  - `scry(path)` — HTTP GET to /~/scry/{path}.json
  - `_stream_loop()` — reads SSE chunks, parses events, dispatches to handlers
  - `_process_event()` — parses SSE data lines, matches to subscription handlers
  - `_attempt_reconnect()` — exponential backoff reconnection
  - `_ack()` — acknowledges events to prevent Eyre buildup
  - `close()` — clean shutdown (unsubscribe, delete channel, close session)

- `TlonAdapter(BasePlatformAdapter)` class — Hermes adapter interface
  - `connect()` — auth, scry self profile, auto-discover channels, subscribe, start SSE
  - `send()` — converts text to story format, pokes via Eyre channel
  - `_send_channel_post()` — pokes `channels` app with mark `channel-action-1`
  - `_send_dm()` — pokes `chat` app with mark `chat-dm-action-1`
  - `_handle_channel_event()` — parses channel firehose events, extracts messages
  - `_handle_dm_event()` — parses DM firehose events
  - `_is_bot_mentioned()` — checks ship name and nickname
  - `_strip_bot_mention()` — removes bot mention from message text
  - `_discover_channels()` — scries /groups/v1/groups.json for auto-discovery
  - `_is_user_allowed()` — checks global + platform allowlists

- Helper functions:
  - `_extract_message_text(content)` — recursively extracts text from Tlon's story format
  - `_text_to_story(text)` — converts plain text to Tlon story blocks
  - `_normalize_ship(ship)` — ensures ~ prefix
  - `_parse_channel_nest(nest)` — splits "chat/~host/name" into parts

**Modified files** (integration points):
- `gateway/config.py` — Added `TLON = "tlon"` to Platform enum, env var parsing
- `gateway/run.py` — Added adapter factory case, auth maps for TLON
- `agent/prompt_builder.py` — Added Tlon platform hint
- `toolsets.py` — Added `hermes-tlon` toolset
- `cron/scheduler.py` — Added tlon to delivery platform map
- `tools/send_message_tool.py` — Added `_send_tlon()` for one-shot sends + routing
- `gateway/channel_directory.py` — Added tlon to discovery loop

## Critical Discovery: Correct Poke Formats

The #1 issue we hit was using wrong mark names. Tlon's current API uses versioned marks:

### Channel posts (chat, heap, diary)
```
app: "channels"
mark: "channel-action-1"    ← NOT "channel-action"
json: {
  "channel": {
    "nest": "chat/~host/channel-name",
    "action": {
      "post": {
        "add": {
          "essay": {
            "content": [{"inline": ["message text"]}],
            "author": "bare-ship-name",
            "sent": <unix_ms>,
            "kind": "/chat",       ← REQUIRED (or "/diary", "/heap")
            "blob": null,          ← REQUIRED
            "meta": null           ← REQUIRED
          },
          "time": null             ← REQUIRED
        }
      }
    }
  }
}
```

### DMs
```
app: "chat"
mark: "chat-dm-action-1"    ← NOT "chat-action"
json: {
  "ship": "bare-target-ship",
  "diff": {
    "id": "bare-author/sent_timestamp",
    "delta": {
      "add": {
        "essay": {
          "content": [{"inline": ["message text"]}],
          "author": "bare-ship-name",
          "sent": <unix_ms>,
          "kind": "/chat",
          "meta": null,
          "blob": null
        },
        "time": null
      }
    }
  }
}
```

**Source of truth**: `@tloncorp/api` npm package used by openclaw-tlon:
- `node_modules/@tloncorp/api/src/api/channelsApi.ts` → `channelAction()` uses mark `channel-action-1`
- `node_modules/@tloncorp/api/src/api/postsApi.ts` → `chatAction()` uses mark `chat-dm-action-1`
- `node_modules/@tloncorp/api/src/api/apiUtils.ts` → `toPostEssay()` adds `kind`, `blob`, `meta` fields

## SSE Event Structure (channels /v2)

When a new message is posted to a channel, the SSE event looks like:

```json
{
  "json": {
    "nest": "chat/~ramlud-bintun/v1fsl36d",
    "response": {
      "post": {
        "id": "170141184507864167403996323545639550976",
        "r-post": {
          "set": {
            "revision": "0",
            "seal": {
              "id": "170141184507864167403996323545639550976",
              "replies": {},
              "reacts": {},
              "seq": 1470,
              "meta": { "replyCount": 0, "lastReply": null, "lastRepliers": [] }
            },
            "essay": {
              "author": "~malmur-halmex",
              "sent": 1773321043023,
              "kind": "/chat",
              "blob": null,
              "content": [
                {
                  "inline": [
                    { "ship": "~timryd-macnus" },
                    " yp ",
                    { "break": null }
                  ]
                }
              ],
              "meta": { "image": "", "title": "", "cover": "", "description": "" }
            },
            "type": "post"
          }
        }
      }
    }
  },
  "id": 1,
  "mark": "channel-response-3",
  "response": "diff"
}
```

Path to essay: `json.response.post.r-post.set.essay`
Path to post ID: `json.response.post.id`
Path to seal: `json.response.post.r-post.set.seal`

## Tlon Story Format

Messages use a "story" format — an array of blocks:

### Inline text
```json
{"inline": ["plain text", {"ship": "~sampel-palnet"}, " more text", {"break": null}]}
```

### Formatted text
```json
{"inline": [{"bold": ["bold text"]}, {"italics": ["italic"]}, {"inline-code": "code"}]}
```

### Links
```json
{"inline": [{"link": {"href": "https://example.com", "content": "link text"}}]}
```

### Images
```json
{"block": {"image": {"src": "https://...", "alt": "description", "width": 0, "height": 0}}}
```

### Code blocks
```json
{"block": {"code": {"lang": "python", "code": "print('hello')"}}}
```

## Test Ship Credentials

```
URL:  https://timryd-macnus.tlon.network
Ship: ~timryd-macnus
Code: dacdyn-timser-hilmud-docrev
```

Ship is in the **Tlonbot Group** (`~ramlud-bintun/v1l3qcoq`):
- `chat/~ramlud-bintun/v1fsl36d` — "Bots and Humans" channel
- `chat/~ramlud-bintun/vl4o9jj` — "Humans Only" channel
- `diary/~ramlud-bintun/v3j2fh67` — "Getting Started" diary

Ship profile nickname: "Hermes" (was "Le Bot")

## Current Status & Known Issues

### What works ✅
1. **Authentication** — cookie-based auth via POST /~/login
2. **SSE connection** — subscribes to channels /v2 and chat /v3, receives events
3. **Scry** — reads self profile, discovers groups/channels
4. **Sending messages** — correct mark format (`channel-action-1`), messages appear in Tlon
5. **Event parsing** — SSE events are received and parsed (subscribe confirmations, diff events)
6. **Auto-discovery** — finds all channels from groups the bot is in
7. **All Hermes integration points** — config, adapter factory, auth, toolsets, cron, send_message tool

### What needs fixing 🔧

1. **Event handler dispatch** — The `_handle_channel_event()` was crashing with `AttributeError: 'NoneType' object has no attribute 'get'` due to incorrect path traversal of the event JSON. This was partially fixed but needs verification with the corrected event structure (documented above).

2. **SSE event delivery timing** — The SSE stream only delivers real-time events. If the gateway restarts, it misses any messages sent during downtime. This is expected behavior (same as openclaw-tlon), but the handler code needs to be verified with a live message sent while the gateway is actively running.

3. **Response send verification** — The agent DID process a message and generated a 187-char response, and `send()` was called. But the response didn't appear in the channel. This could be:
   - The poke going through the existing SSE Eyre channel (should work, but might need a fresh channel)
   - The `_text_to_story()` output not matching what Tlon expects
   - A silent poke failure (Eyre returns 204 even if the agent rejects the poke)

4. **Story format conversion** — `_text_to_story()` is basic. openclaw-tlon uses a full `markdownToStory()` converter. Need to handle:
   - Markdown bold/italic/code
   - URLs → link inlines
   - Code blocks → block code
   - Images → block image
   - Multi-paragraph → proper break handling

## Environment Setup

### Hermes .env config
```bash
# In ~/.hermes/.env
TLON_SHIP_URL=https://timryd-macnus.tlon.network
TLON_SHIP_NAME=~timryd-macnus
TLON_SHIP_CODE=dacdyn-timser-hilmud-docrev
TLON_AUTO_DISCOVER=true
TLON_ALLOWED_USERS=~malmur-halmex
TLON_HOME_CHANNEL=chat/~ramlud-bintun/v1fsl36d
```

### Dependencies
- `aiohttp>=3.9.0` (already in Hermes venv)

### File locations
- Hermes installation: `~/.hermes/hermes-agent/`
- Hermes venv: `~/.hermes/hermes-agent/venv/`
- Our working copy: `~/Projects/hermes-agent/` (branch: `feature/tlon-adapter`)
- Adapter source: `~/Projects/tlon-apps/integrations/hermes-tlon-adapter/tlon.py`
- openclaw-tlon reference: `~/Projects/openclaw-tlon/src/`

## Reference: openclaw-tlon Source Files

Key files to study in `~/Projects/openclaw-tlon/src/`:

| File | What it does |
|------|-------------|
| `urbit/auth.ts` | Auth flow, cookie management |
| `urbit/sse-client.ts` | Eyre channel lifecycle, SSE streaming, reconnection |
| `urbit/send.ts` | All send operations (DM, channel post, reply, reaction) via @tloncorp/api |
| `urbit/story.ts` | `markdownToStory()` and `storyToMarkdown()` converters |
| `monitor/index.ts` | SSE event processing, message extraction, dedup, mention detection |
| `channel.ts` | Main channel class, message routing |

Key files in `@tloncorp/api` (`~/Projects/openclaw-tlon/node_modules/@tloncorp/api/src/api/`):

| File | What it does |
|------|-------------|
| `channelsApi.ts` | `channelAction()` — builds channel poke with mark `channel-action-1` |
| `postsApi.ts` | `sendPost()`, `sendReply()`, `chatAction()` — builds DM/channel pokes |
| `apiUtils.ts` | `toPostEssay()` — adds kind/blob/meta to essay |

## Reference: Hermes Adapter Interface

Key files in `~/Projects/hermes-agent/gateway/`:

| File | What it does |
|------|-------------|
| `platforms/base.py` | `BasePlatformAdapter` — abstract base class with `connect()`, `send()`, `handle_message()` |
| `platforms/telegram.py` | Reference adapter implementation (~800 lines) |
| `config.py` | `Platform` enum, `PlatformConfig`, env var parsing |
| `run.py` | Gateway main loop, `_create_adapter()` factory, auth checks |
| `session.py` | `SessionSource`, `build_session_key()` — session management |

## Next Steps

1. **Fix the event handler** — Use the documented SSE event structure to correctly extract essay from `json.response.post.r-post.set.essay`
2. **Verify send works** — Test that pokes through the existing SSE Eyre channel actually deliver messages
3. **Test end-to-end** — Send a message while gateway is running, verify receipt + response
4. **Improve story conversion** — Port `markdownToStory()` from openclaw-tlon
5. **Add Tlon-specific tools** — Port tlon-skill capabilities as Hermes tools (channel history, posting, contacts)
6. **Handle edge cases** — Group DMs, thread replies, reactions, image messages
7. **Write tests** — Unit tests for story conversion, event parsing, auth flow
