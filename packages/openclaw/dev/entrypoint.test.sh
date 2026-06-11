#!/bin/bash
set -e

# Ensure HOME is set correctly
export HOME=/root
export OPENCLAW_STATE_DIR=/root/.openclaw

# Shorten the plugin's re-engagement nudge tick interval so integration
# tests can exercise the scheduler within a reasonable wall-clock budget.
# Production still uses the 15-minute default. 5s here lets the heartbeat
# test fire its phase-1 nudge quickly and verify "no duplicate nudge" over
# 2-3 tick intervals in ~15s instead of the previous 30s/75s.
export TLON_NUDGE_TICK_INTERVAL_MS=${TLON_NUDGE_TICK_INTERVAL_MS:-5000}
echo "==> HOME=$HOME"
echo "==> OPENCLAW_STATE_DIR=$OPENCLAW_STATE_DIR"
echo "==> User: $(whoami)"
echo "==> Working directory: $(pwd)"

echo "==> Fixing plugin directory ownership..."
# Exclude .git - on Linux, host-owned git objects can't be chowned by container root
find /workspace/openclaw-tlon -not -path '*/.git/*' -exec chown root:root {} \; 2>/dev/null || true

echo "==> Installing plugin dependencies..."
cd /workspace/openclaw-tlon
pnpm install
pnpm build

# Expose tlon CLI to PATH
TLON_BIN_DIR="/workspace/openclaw-tlon/node_modules/.bin"
if [ -f "$TLON_BIN_DIR/tlon" ]; then
  export PATH="$PATH:$TLON_BIN_DIR"
  echo "==> tlon CLI available at $TLON_BIN_DIR/tlon"
fi

# Expose the plugin at an id-shaped path so OpenClaw's path hint matches the manifest id.
ln -sfn /workspace/openclaw-tlon /workspace/tlon

# tlon-skill comes in as plugin dependency (see package.json)
echo "==> Checking tlon-skill from plugin dependencies..."
ls -la /workspace/openclaw-tlon/node_modules/@tloncorp/tlon-skill/ 2>/dev/null || echo "  (in container node_modules volume)"

# Remove bundled tlon plugin to avoid duplicate ID conflict
rm -rf "$(npm root -g)/openclaw/extensions/tlon"
rm -rf "$(npm root -g)/openclaw/dist/extensions/tlon"

# Create minimal config for CI
CONFIG_DIR=/root/.openclaw
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/openclaw.json" << EOF
{
  "models": {
    "providers": {
      "custom-proxy": {
        "baseUrl": "${FAKE_MODEL_BASE_URL:-http://fake-model:4000/v1}",
        "apiKey": "TEST_KEY",
        "api": "openai-completions",
        "models": [
          {
            "id": "tlon-test-scripted",
            "name": "Tlon Test Scripted Model",
            "api": "openai-completions",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "/root/.openclaw/workspace",
      "model": {
        "primary": "${MODEL:-custom-proxy/tlon-test-scripted}"
      }
    },
    "list": [
      {
        "id": "test",
        "identity": {
          "name": "Test Bot",
          "emoji": "🧪"
        }
      }
    ]
  },
  "session": {
    "dmScope": "per-channel-peer"
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "auth": {
      "token": "ci-test-token"
    },
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    }
  },
  "plugins": {
    "allow": ["@tloncorp/openclaw"],
    "load": {
      "paths": ["/workspace/tlon"]
    },
    "entries": {
      "tlon": {
        "enabled": true
      }
    }
  },
  "tools": {
    "allow": [
      "web_fetch",
      "web_search",
      "image_search",
      "read",
      "cron",
      "tlon",
      "message"
    ],
    "deny": [
      "apply_patch",
      "bash",
      "canvas",
      "edit",
      "exec",
      "gateway",
      "nodes",
      "process",
      "write"
    ]
  },
  "skills": {
    "entries": {
      "tlon": {
        "enabled": true,
        "env": {
          "URBIT_URL": "http://ships:8080",
          "URBIT_SHIP": "~zod",
          "URBIT_CODE": "lidlut-tabwed-pillex-ridrup"
        }
      }
    }
  },
  "channels": {
    "tlon": {
      "enabled": true,
      "url": "http://ships:8080",
      "ship": "~zod",
      "code": "lidlut-tabwed-pillex-ridrup",
      "ownerShip": "~ten",
      "dmAllowlist": ["~ten"],
      "allowPrivateNetwork": true,
      "reengagement": {
        "enabled": true
      },
      "nudgeActiveHours": {
        "start": "00:00",
        "end": "24:00",
        "timezone": "UTC"
      }
    }
  }
}
EOF

# Patch in image-search plugin if tlonbot is mounted
if [ -d "/workspace/tlonbot/image-search" ]; then
  echo "==> Patching config: adding image-search plugin..."
  jq '.plugins.load.paths += ["/workspace/tlonbot/image-search"]
    | .plugins.entries["image-search"] = {"enabled": true}' \
    "$CONFIG_DIR/openclaw.json" > "$CONFIG_DIR/openclaw.json.tmp" \
    && mv "$CONFIG_DIR/openclaw.json.tmp" "$CONFIG_DIR/openclaw.json"
fi

# Fetch and patch image-search plugin from GitHub when not locally mounted
if [ ! -d "/workspace/tlonbot/image-search" ] && [ -n "$BRAVE_API_KEY" ] && [ -n "$TLONBOT_TOKEN" ]; then
  echo "==> Fetching image-search plugin from GitHub..."
  PLUGIN_DIR="/workspace/image-search"
  mkdir -p "$PLUGIN_DIR"
  TLONBOT_RAW="https://raw.githubusercontent.com/tloncorp/tlonbot/main/image-search"
  for f in index.js package.json openclaw.plugin.json; do
    curl -fsSL -H "Authorization: token $TLONBOT_TOKEN" "$TLONBOT_RAW/$f" -o "$PLUGIN_DIR/$f" \
      || { echo "FATAL: Failed to fetch image-search/$f from GitHub"; exit 1; }
    echo "  - $f"
  done
  # Validate: all three required files must exist and be non-empty
  for f in index.js package.json openclaw.plugin.json; do
    if [ ! -s "$PLUGIN_DIR/$f" ]; then
      echo "FATAL: image-search/$f is missing or empty after fetch"; exit 1
    fi
  done
  echo "==> Patching config: adding image-search plugin (fetched)..."
  jq '.plugins.load.paths += ["/workspace/image-search"]
    | .plugins.entries["image-search"] = {"enabled": true}' \
    "$CONFIG_DIR/openclaw.json" > "$CONFIG_DIR/openclaw.json.tmp" \
    && mv "$CONFIG_DIR/openclaw.json.tmp" "$CONFIG_DIR/openclaw.json"
fi

# Patch in Brave API key for web search if available
if [ -n "$BRAVE_API_KEY" ]; then
  echo "==> Patching config: adding Brave search API key..."
  jq --arg key "$BRAVE_API_KEY" \
    '.tools.web.search = {"provider": "brave", "apiKey": $key}' \
    "$CONFIG_DIR/openclaw.json" > "$CONFIG_DIR/openclaw.json.tmp" \
    && mv "$CONFIG_DIR/openclaw.json.tmp" "$CONFIG_DIR/openclaw.json"
fi

telemetry_enabled="${TLON_TELEMETRY_ENABLED:-${TLON_POSTHOG_ENABLED:-}}"
telemetry_api_key="${TLON_TELEMETRY_API_KEY:-${TLON_POSTHOG_API_KEY:-}}"
telemetry_host="${TLON_TELEMETRY_HOST:-${TLON_POSTHOG_HOST:-}}"

if [ "$telemetry_enabled" = "true" ] && [ -n "$telemetry_api_key" ]; then
  echo "==> Patching config: enabling Tlon telemetry..."
  jq \
    --arg apiKey "$telemetry_api_key" \
    --arg host "$telemetry_host" \
    '.channels.tlon.telemetry = (
      {
        enabled: true,
        apiKey: $apiKey
      } + (if $host != "" then { host: $host } else {} end)
    )' \
    "$CONFIG_DIR/openclaw.json" > "$CONFIG_DIR/openclaw.json.tmp" \
    && mv "$CONFIG_DIR/openclaw.json.tmp" "$CONFIG_DIR/openclaw.json"
fi

echo "==> Config written"

if [ "${VERBOSE:-0}" = "1" ]; then
  echo "==> DEBUG: Full config:"
  cat "$CONFIG_DIR/openclaw.json"
  echo "==> DEBUG: Agent config:"
  cat "$CONFIG_DIR/openclaw.json" | jq '.agents'
  echo "==> DEBUG: Re-engagement config (plugin scheduler):"
  cat "$CONFIG_DIR/openclaw.json" | jq '.channels.tlon.reengagement'
  echo "==> DEBUG: Tlon channel config:"
  cat "$CONFIG_DIR/openclaw.json" | jq '.channels.tlon'
fi

# Create workspace
WORKSPACE_DIR=/root/.openclaw/workspace
mkdir -p "$WORKSPACE_DIR"

# Load tlonbot prompts - prefer mounted volume, fallback to GitHub fetch.
# HEARTBEAT.md is intentionally excluded: the plugin-driven re-engagement
# scheduler owns the nudge cadence in this harness, and the legacy LLM
# heartbeat agent config has been removed above. Loading HEARTBEAT.md
# would let the old LLM nudge path run alongside the plugin scheduler,
# producing duplicate owner DMs and nondeterministic integration results.
echo "==> Loading tlonbot prompts..."
if [ -d "/workspace/tlonbot/prompts" ]; then
  echo "  (using mounted tlonbot volume)"
  for f in SOUL.md TOOLS.md BOOTSTRAP.md USER.md AGENTS.md; do
    if [ -f "/workspace/tlonbot/prompts/$f" ]; then
      cp "/workspace/tlonbot/prompts/$f" "$WORKSPACE_DIR/$f" && echo "  - $f" || echo "  - $f (failed)"
    fi
  done
elif [ -n "$TLONBOT_TOKEN" ]; then
  echo "  (fetching from GitHub with TLONBOT_TOKEN)"
  TLONBOT_RAW="https://raw.githubusercontent.com/tloncorp/tlonbot/main/prompts"
  for f in SOUL.md TOOLS.md BOOTSTRAP.md USER.md AGENTS.md; do
    curl -fsSL -H "Authorization: token $TLONBOT_TOKEN" "$TLONBOT_RAW/$f" -o "$WORKSPACE_DIR/$f" 2>/dev/null && echo "  - $f" || echo "  - $f (failed)"
  done
else
  echo "  (no tlonbot mount or token, trying public GitHub access)"
  TLONBOT_RAW="https://raw.githubusercontent.com/tloncorp/tlonbot/main/prompts"
  for f in SOUL.md TOOLS.md BOOTSTRAP.md USER.md AGENTS.md; do
    curl -fsSL "$TLONBOT_RAW/$f" -o "$WORKSPACE_DIR/$f" 2>/dev/null && echo "  - $f" || true
  done
fi

# Defensive: if any prior run left HEARTBEAT.md in the workspace (e.g. a
# mounted volume ships with a stale copy), remove it so the agent cannot
# load the legacy nudge prompt alongside the plugin scheduler.
rm -f "$WORKSPACE_DIR/HEARTBEAT.md"

# Fallback SOUL.md if prompts weren't loaded
if [ ! -f "$WORKSPACE_DIR/SOUL.md" ]; then
  cat > "$WORKSPACE_DIR/SOUL.md" << 'EOFPROMPT'
You are a test bot running integration tests.
Reply helpfully to any message.
When asked to create groups, manage channels, or update your profile, do so.
Use the tlon skill for Tlon/Urbit operations.
EOFPROMPT
fi

echo "==> Workspace contents:"
ls -la "$WORKSPACE_DIR/"

if [ "${VERBOSE:-0}" = "1" ]; then
  echo "==> DEBUG: Prompt files content:"
  for f in SOUL.md TOOLS.md AGENTS.md USER.md; do
    if [ -f "$WORKSPACE_DIR/$f" ]; then
      echo "--- BEGIN $WORKSPACE_DIR/$f ---"
      cat "$WORKSPACE_DIR/$f"
      echo "--- END $f ---"
    fi
  done
  echo "==> DEBUG: Skill env vars:"
  echo "  URBIT_URL=${URBIT_URL:-<not set>}"
  echo "  URBIT_SHIP=${URBIT_SHIP:-<not set>}"
  echo "  URBIT_CODE=${URBIT_CODE:-<not set>}"
fi

# Create sessions directory
SESSIONS_DIR=/root/.openclaw/agents/test/sessions
mkdir -p "$SESSIONS_DIR"
echo "{}" > "$SESSIONS_DIR/sessions.json"

if [ "${VERBOSE:-0}" = "1" ]; then
  echo "==> DEBUG: Directory structure:"
  ls -la /root/.openclaw/
  ls -la /root/.openclaw/agents/test/ 2>/dev/null || true
fi

echo "==> Starting OpenClaw gateway..."
exec openclaw gateway --port 18789 --bind lan --verbose
