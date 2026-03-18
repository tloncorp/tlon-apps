# Hermes → Tlon Adapter

A messaging platform adapter that connects [Hermes Agent](https://github.com/NousResearch/hermes-agent) to Tlon (Urbit), letting you talk to a Hermes agent through Tlon Messenger the same way you'd use Telegram or Discord.

## How it works

The adapter connects to a Tlon ship via the Eyre HTTP API:

1. **Authenticates** with ship +code (`POST /~/login`)
2. **Subscribes** to channels firehose (`/v2`) and DMs firehose (`/v3`) via SSE
3. **Listens** for @mentions in group channels and all DMs from allowed users
4. **Routes** messages to the Hermes agent session store
5. **Sends** responses back via pokes
6. **Reconnects** automatically with exponential backoff

## Installation

### 1. Install the adapter

Copy `tlon.py` into your Hermes installation:

```bash
cp tlon.py ~/.hermes/venv/lib/python3.*/site-packages/gateway/platforms/
# Or if running from source:
cp tlon.py /path/to/hermes-agent/gateway/platforms/
```

### 2. Install dependency

```bash
pip install aiohttp
```

### 3. Apply patches

You need to register the Tlon platform in a few files. See `patches/` for diffs, or apply manually:

**`gateway/config.py`** — Add to `Platform` enum:
```python
class Platform(Enum):
    ...
    TLON = "tlon"
```

And in `_apply_env_overrides()`:
```python
# Tlon (Urbit)
tlon_url = os.getenv("TLON_SHIP_URL")
tlon_name = os.getenv("TLON_SHIP_NAME")
tlon_code = os.getenv("TLON_SHIP_CODE")
if all([tlon_url, tlon_name, tlon_code]):
    if Platform.TLON not in config.platforms:
        config.platforms[Platform.TLON] = PlatformConfig()
    config.platforms[Platform.TLON].enabled = True
    config.platforms[Platform.TLON].extra.update({
        "ship_url": tlon_url,
        "ship_name": tlon_name,
    })
```

**`gateway/run.py`** — Add to `_create_adapter()`:
```python
elif platform == Platform.TLON:
    from gateway.platforms.tlon import TlonAdapter, check_tlon_requirements
    if not check_tlon_requirements():
        logger.warning("Tlon: aiohttp not installed")
        return None
    return TlonAdapter(config)
```

And add `Platform.TLON: "TLON_ALLOWED_USERS"` to both auth maps.

**`agent/prompt_builder.py`** — Add platform hint:
```python
"tlon": (
    "You are on Tlon, a decentralized messaging platform built on Urbit. "
    "Users are identified by ship names (patps) like ~sampel-palnet. "
    "You can use basic markdown formatting."
),
```

**`toolsets.py`**, **`cron/scheduler.py`**, **`tools/send_message_tool.py`** — Add `"tlon": Platform.TLON` to platform maps.

### 4. Configure

Add to `~/.hermes/.env`:

```bash
# Required
TLON_SHIP_URL=https://your-ship.tlon.network
TLON_SHIP_NAME=~your-ship
TLON_SHIP_CODE=your-plus-code-here

# Optional
TLON_CHANNELS=chat/~host/channel-name     # Specific channels to monitor
TLON_AUTO_DISCOVER=true                     # Auto-discover all group channels
TLON_ALLOWED_USERS=~malmur-halmex          # Ships allowed to interact
TLON_ALLOW_ALL_USERS=false                  # Allow anyone (default: false)
TLON_DM_ALLOWLIST=~malmur-halmex           # Ships allowed to DM
TLON_HOME_CHANNEL=chat/~host/channel       # Default delivery channel for crons
```

### 5. Start

```bash
hermes gateway restart
```

## Usage

- **Group channels**: Mention the bot's ship name (e.g. `~sampel-palnet what's the weather?`)
- **DMs**: Just send a message (if you're on the allowlist)
- **Cron delivery**: Set `deliver: tlon` in your cron config

## Architecture

The adapter follows the same patterns as Hermes' existing platform adapters (Telegram, Discord, etc.):

- `TlonSSEClient` — manages the Eyre channel lifecycle (auth, subscribe, SSE stream, poke, scry, reconnection)
- `TlonAdapter(BasePlatformAdapter)` — implements the Hermes adapter interface (connect, disconnect, send, get_chat_info)
- Message text extraction from Tlon's story format (inline blocks, links, mentions, images, code blocks)
- Story generation from plain text/markdown for outbound messages

Based on the battle-tested patterns from [openclaw-tlon](https://github.com/tloncorp/openclaw-tlon).

## Status

**Draft** — needs live ship testing. The poke JSON structures may need adjustment as Tlon's marks evolve.
