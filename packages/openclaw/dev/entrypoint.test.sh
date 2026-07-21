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

requested_core_version="${OPENCLAW_CORE_VERSION:-2026.5.28}"
installed_core_version="$(node -e 'const fs=require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$(npm root -g)/openclaw/package.json")"
if [ "$installed_core_version" != "$requested_core_version" ]; then
  echo "FATAL: requested OpenClaw core $requested_core_version but installed $installed_core_version"
  exit 1
fi
echo "[tlon-e2e] openclaw-core-version=$installed_core_version requested=$requested_core_version"

# The mounted package declares workspace:^ deps that only resolve inside the
# tlon-apps pnpm workspace. Copy it to a container-local dir (also the
# id-shaped path OpenClaw's path hint expects) and rewrite those deps to
# registry versions there, leaving the host checkout untouched. node_modules
# is a named volume mounted at /workspace/tlon/node_modules. Copying also
# avoids installing into the host-owned bind mount (no chown needed).
echo "==> Copying plugin to /workspace/tlon..."
mkdir -p /workspace/tlon
(cd /workspace/openclaw-tlon && tar cf - --exclude ./node_modules --exclude ./.git --exclude ./dist --exclude ./.env .) \
  | (cd /workspace/tlon && tar xf - --no-same-owner)

echo "==> Installing plugin dependencies..."
cd /workspace/tlon
node scripts/resolve-workspace-deps.mjs package.json --registry
# When the shared harness packs the workspace @tloncorp/api into a tarball
# (see tlon-bot-e2e openclaw driver beforeComposeBuild), prefer it over the
# published registry version so e2e tests exercise in-branch api code.
# Requires BOTH the explicit opt-in env (set only by the shared harness) AND
# the tarball file: file-existence alone would let a stale tarball from a
# prior harness run silently contaminate legacy run.sh / standalone runs.
if [ "${OPENCLAW_WORKSPACE_API_TARBALL:-0}" = "1" ] \
  && [ -f /workspace/tlon/dev/tlon-api-workspace.tgz ]; then
  echo "==> Using workspace @tloncorp/api tarball"
  jq '.dependencies["@tloncorp/api"] = "file:dev/tlon-api-workspace.tgz"' package.json > package.json.tmp \
    && mv package.json.tmp package.json
elif [ -f /workspace/tlon/dev/tlon-api-workspace.tgz ]; then
  echo "==> Ignoring workspace @tloncorp/api tarball (no harness opt-in); using registry"
fi
# This is a standalone install of the plugin (no root pnpm-workspace.yaml), so
# the monorepo's pnpm settings aren't in scope. Generate a container-local
# workspace file: pnpm reads these settings only from pnpm-workspace.yaml
# (--config flags cover a single invocation, not later pnpm run/exec calls).
# - nodeLinker: build-local-skill-override.sh hydrates the platform tlon
#   binary by resolving @tloncorp/tlon-skill-<platform>-<arch> at the top
#   level of node_modules, which only the hoisted layout provides.
# - dangerouslyAllowAllBuilds: pnpm requires explicit approval for dependency
#   build scripts; allow them all — this is an ephemeral container building
#   openclaw's own pinned dependencies, not a trust boundary.
# - minimumReleaseAge: matches the monorepo policy; at the pnpm default (~24h)
#   any dep released in the last day fails the install.
# - verifyDepsBeforeRun: matches the monorepo policy; skips the implicit
#   install pnpm otherwise runs before every pnpm run/exec.
cat > pnpm-workspace.yaml << 'PNPM_EOF'
nodeLinker: hoisted
dangerouslyAllowAllBuilds: true
minimumReleaseAge: 0
verifyDepsBeforeRun: false
PNPM_EOF
pnpm install
pnpm build

# Expose tlon CLI to PATH
TLON_BIN_DIR="/workspace/tlon/node_modules/.bin"
if [ -f "$TLON_BIN_DIR/tlon" ]; then
  export PATH="$PATH:$TLON_BIN_DIR"
  echo "==> tlon CLI available at $TLON_BIN_DIR/tlon"
fi

# tlon-skill comes in as plugin dependency (see package.json)
echo "==> Checking tlon-skill from plugin dependencies..."
ls -la /workspace/tlon/node_modules/@tloncorp/tlon-skill/ 2>/dev/null || echo "  (in container node_modules volume)"

# Remove bundled tlon plugin to avoid duplicate ID conflict
rm -rf "$(npm root -g)/openclaw/extensions/tlon"
rm -rf "$(npm root -g)/openclaw/dist/extensions/tlon"

# Create minimal config for CI
CONFIG_DIR=/root/.openclaw
mkdir -p "$CONFIG_DIR"

TLON_CONFIG_URL="${TLON_URL:-http://ships:8080}"
TLON_CONFIG_SHIP="${TLON_SHIP:-~zod}"
TLON_CONFIG_CODE="${TLON_CODE:-lidlut-tabwed-pillex-ridrup}"
TLON_CONFIG_OWNER="${TLON_OWNER_SHIP:-~ten}"
TLON_CONFIG_DM_ALLOWLIST="${TLON_DM_ALLOWLIST:-~ten}"
TLON_CONFIG_DM_ALLOWLIST_JSON="$(printf '%s' "$TLON_CONFIG_DM_ALLOWLIST" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0))')"
DEFAULT_OPENCLAW_TOOLS_ALLOW_JSON='["web_fetch","web_search","image_search","read","cron","tlon","message"]'
OPENCLAW_CONFIG_TOOLS_ALLOW_JSON="${OPENCLAW_TEST_TOOLS_ALLOW_JSON:-$DEFAULT_OPENCLAW_TOOLS_ALLOW_JSON}"
TLON_CONFIG_MAX_CONSECUTIVE_BOT_RESPONSES="${TLON_MAX_CONSECUTIVE_BOT_RESPONSES:-3}"

if ! printf '%s' "$OPENCLAW_CONFIG_TOOLS_ALLOW_JSON" | jq -e 'type == "array" and all(.[]; type == "string")' >/dev/null; then
  echo "FATAL: OPENCLAW_TEST_TOOLS_ALLOW_JSON must be a JSON array of strings"
  exit 1
fi
if ! printf '%s' "$TLON_CONFIG_MAX_CONSECUTIVE_BOT_RESPONSES" | jq -e 'tonumber >= 0 and (tonumber | floor) == tonumber' >/dev/null; then
  echo "FATAL: TLON_MAX_CONSECUTIVE_BOT_RESPONSES must be a non-negative integer"
  exit 1
fi

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
    "allow": $OPENCLAW_CONFIG_TOOLS_ALLOW_JSON,
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
          "URBIT_URL": "$TLON_CONFIG_URL",
          "URBIT_SHIP": "$TLON_CONFIG_SHIP",
          "URBIT_CODE": "$TLON_CONFIG_CODE"
        }
      }
    }
  },
  "channels": {
    "tlon": {
      "enabled": true,
      "url": "$TLON_CONFIG_URL",
      "ship": "$TLON_CONFIG_SHIP",
      "code": "$TLON_CONFIG_CODE",
      "ownerShip": "$TLON_CONFIG_OWNER",
      "dmAllowlist": $TLON_CONFIG_DM_ALLOWLIST_JSON,
      "allowPrivateNetwork": true,
      "maxConsecutiveBotResponses": $TLON_CONFIG_MAX_CONSECUTIVE_BOT_RESPONSES,
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

# Patch in Brave API key for web search if available. openclaw 2026.5.28
# only accepts provider "brave" when the brave plugin (installed at image
# build time, see Dockerfile.test) is allowed and enabled; the config was
# rewritten from scratch above, so re-assert both here (mirrors production).
if [ -n "$BRAVE_API_KEY" ]; then
  echo "==> Patching config: adding Brave search API key..."
  jq --arg key "$BRAVE_API_KEY" \
    '.tools.web.search = {"enabled": true, "provider": "brave", "apiKey": $key}
    | .plugins.allow += ["brave"]
    | .plugins.entries.brave = {"enabled": true, "config": {"webSearch": {"apiKey": $key}}}' \
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

redact_openclaw_config() {
  jq \
    --arg brave_api_key "${BRAVE_API_KEY:-}" \
    --arg tlonbot_token "${TLONBOT_TOKEN:-}" \
    --arg test_storage_access_key "${TEST_STORAGE_ACCESS_KEY:-}" \
    --arg test_storage_secret_key "${TEST_STORAGE_SECRET_KEY:-}" \
    --arg telemetry_api_key "${telemetry_api_key:-}" \
    '
      def secret_value:
        (. == $brave_api_key and $brave_api_key != "") or
        (. == $tlonbot_token and $tlonbot_token != "") or
        (. == $test_storage_access_key and $test_storage_access_key != "") or
        (. == $test_storage_secret_key and $test_storage_secret_key != "") or
        (. == $telemetry_api_key and $telemetry_api_key != "");
      def redact:
        if type == "object" then
          with_entries(
            if (.key | test("(api[_-]?key|token|secret|password|credential|code)"; "i")) then
              .value = "<redacted>"
            else
              .value |= redact
            end
          )
        elif type == "array" then
          map(redact)
        elif type == "string" and secret_value then
          "<redacted>"
        else
          .
        end;
      redact
    ' "$CONFIG_DIR/openclaw.json"
}

if [ "${VERBOSE:-0}" = "1" ]; then
  redacted_config="$(redact_openclaw_config)"
  echo "==> DEBUG: Full config (secrets redacted):"
  printf '%s\n' "$redacted_config"
  echo "==> DEBUG: Agent config:"
  printf '%s\n' "$redacted_config" | jq '.agents'
  echo "==> DEBUG: Re-engagement config (plugin scheduler):"
  printf '%s\n' "$redacted_config" | jq '.channels.tlon.reengagement'
  echo "==> DEBUG: Tlon channel config (secrets redacted):"
  printf '%s\n' "$redacted_config" | jq '.channels.tlon'
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
