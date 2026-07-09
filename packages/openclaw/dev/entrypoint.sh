#!/bin/bash
set -e

# Validate plugin repo is mounted
if [ ! -f "/workspace/openclaw-tlon/package.json" ]; then
  echo "ERROR: /workspace/openclaw-tlon not found. Run ./dev/setup.sh first."
  exit 1
fi

# Validate tlonbot repo is mounted
if [ ! -f "/workspace/tlonbot/openclaw.json" ]; then
  echo "ERROR: /workspace/tlonbot not found. Run ./dev/setup.sh first."
  exit 1
fi

# The mounted package declares workspace:^ deps that only resolve inside the
# tlon-apps pnpm workspace. Copy it to a container-local dir (also the
# id-shaped path OpenClaw's path hint expects) and rewrite those deps to
# registry versions there, leaving the host checkout untouched. node_modules
# is a named volume mounted at /workspace/tlon/node_modules.
echo "==> Copying plugin to /workspace/tlon..."
mkdir -p /workspace/tlon
(cd /workspace/openclaw-tlon && tar cf - --exclude ./node_modules --exclude ./.git --exclude ./dist --exclude ./.env .) \
  | (cd /workspace/tlon && tar xf - --no-same-owner)

echo "==> Installing plugin dependencies..."
cd /workspace/tlon
node scripts/resolve-workspace-deps.mjs package.json --registry
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
./dev/build-local-api-override.sh
./dev/build-local-skill-override.sh

# Expose tlon CLI to PATH
TLON_BIN_DIR="/workspace/tlon/node_modules/.bin"
if [ -f "$TLON_BIN_DIR/tlon" ]; then
  export PATH="$TLON_BIN_DIR:$PATH"
  echo "==> tlon CLI available at $TLON_BIN_DIR/tlon"
fi

# Remove bundled tlon plugin to avoid duplicate ID conflict
rm -rf "$(npm root -g)/openclaw/extensions/tlon"
rm -rf "$(npm root -g)/openclaw/dist/extensions/tlon"

# Plugin is loaded from /workspace/tlon via plugins.load.paths in config
# Skill should be discovered via plugin manifest's "skills" field.
# Commenting out manual symlink to test manifest-based discovery.
# echo "==> Installing tlon skill to workspace..."
# WORKSPACE_DIR=/root/.openclaw/workspace
# mkdir -p "$WORKSPACE_DIR/skills"
# rm -rf "$WORKSPACE_DIR/skills/tlon"
# ln -s /workspace/openclaw-tlon/node_modules/@tloncorp/tlon-skill "$WORKSPACE_DIR/skills/tlon"

# Copy and patch config from tlonbot
CONFIG_DIR=/root/.openclaw
CONFIG_PATH="$CONFIG_DIR/openclaw.json"
mkdir -p "$CONFIG_DIR"

if [ -f "/workspace/tlonbot/openclaw.json" ]; then
  echo "==> Copying config from tlonbot..."
  cp /workspace/tlonbot/openclaw.json "$CONFIG_PATH"

  # Patch in Brave web search if available. openclaw 2026.5.28 only accepts
  # provider "brave" when the plugin is installed, allowed, and enabled, so
  # set provider, allow, and enable together (mirrors the test entrypoint and
  # production tlonbot flow). The matching `plugins install` runs later, just
  # before gateway start — the CLI refuses to install while the config is
  # invalid, and at this point it can be (load.paths still points at
  # /workspace/openclaw-tlon until the repoint below).
  if [ -n "$BRAVE_API_KEY" ]; then
    echo "==> Patching Brave web search into config..."
    jq --arg key "$BRAVE_API_KEY" \
      '.tools.web.search = {"enabled": true, "provider": "brave", "apiKey": $key}
      | .plugins.allow += ["brave"]
      | .plugins.entries.brave = {"enabled": true, "config": {"webSearch": {"apiKey": $key}}}' \
      "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"
  fi

  telemetry_enabled="${TLON_TELEMETRY_ENABLED:-${TLON_POSTHOG_ENABLED:-}}"
  telemetry_api_key="${TLON_TELEMETRY_API_KEY:-${TLON_POSTHOG_API_KEY:-}}"
  telemetry_host="${TLON_TELEMETRY_HOST:-${TLON_POSTHOG_HOST:-}}"

  if [ "$telemetry_enabled" = "true" ] && [ -n "$telemetry_api_key" ]; then
    echo "==> Patching Tlon telemetry config..."
    jq \
      --arg apiKey "$telemetry_api_key" \
      --arg host "$telemetry_host" \
      '.channels.tlon.telemetry = (
        {
          enabled: true,
          apiKey: $apiKey
        } + (if $host != "" then { host: $host } else {} end)
      )' \
      "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"
  fi
elif [ -f "/workspace/openclaw-tlon/dev/openclaw.dev.json" ]; then
  cp "/workspace/openclaw-tlon/dev/openclaw.dev.json" "$CONFIG_PATH"
fi

if [ -f "$CONFIG_PATH" ]; then
  echo "==> Repointing local tlon plugin path to /workspace/tlon..."
  jq '
    .plugins.load.paths |= map(
      if . == "/workspace/openclaw-tlon" then "/workspace/tlon" else . end
    )
    | .plugins.allow = (.plugins.allow // []) + ["@tloncorp/openclaw"]
    | .plugins.allow |= unique
  ' "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"

  # Dev-only: bypass browser device pairing so the Control UI is reachable
  # with just the gateway token. Do NOT set this in production configs.
  echo "==> Disabling device pairing for Control UI (dev-only)..."
  jq '.gateway.controlUi.dangerouslyDisableDeviceAuth = true' \
    "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"
fi

# Upsert a marked block into a file (preserves content outside the markers)
# Usage: upsert_block <file> <content>
# Content must include <!-- idempotency-marker:...:v1 --> and <!-- /idempotency-marker --> markers
upsert_block() {
  local file="$1"
  local content="$2"

  # Extract marker from content (first line)
  local marker
  marker=$(echo "$content" | head -1)

  # Create file if it doesn't exist
  [ -f "$file" ] || touch "$file"

  # Read existing content
  local existing
  existing=$(cat "$file")

  # Remove existing block if present (marker through end marker)
  # Use perl for reliable multiline regex
  existing=$(echo "$existing" | perl -0777 -pe "s/\n?${marker}.*?<!-- \/idempotency-marker -->\n?//s")

  # Append new block
  echo "${existing}

${content}" > "$file"
}

# Install prompts into workspace (upsert pattern preserves existing content)
echo "==> Installing prompts..."
WORKSPACE_DIR=/root/.openclaw/workspace
mkdir -p "$WORKSPACE_DIR"

# needs variable substitution
upsert_block "$WORKSPACE_DIR/BOOTSTRAP.md" "$(envsubst < /workspace/tlonbot/prompts/BOOTSTRAP.md)"
upsert_block "$WORKSPACE_DIR/IDENTITY.md" "$(envsubst < /workspace/tlonbot/prompts/IDENTITY.md)"
upsert_block "$WORKSPACE_DIR/SOUL.md" "$(envsubst < /workspace/tlonbot/prompts/SOUL.md)"
upsert_block "$WORKSPACE_DIR/TOOLS.md" "$(envsubst < /workspace/tlonbot/prompts/TOOLS.md)"
# static, no variable substitution needed
upsert_block "$WORKSPACE_DIR/AGENTS.md" "$(cat /workspace/tlonbot/prompts/AGENTS.md)"
upsert_block "$WORKSPACE_DIR/HEARTBEAT.md" "$(cat /workspace/tlonbot/prompts/HEARTBEAT.md)"
upsert_block "$WORKSPACE_DIR/MEMORY.md" "$(cat /workspace/tlonbot/prompts/MEMORY.md)"
upsert_block "$WORKSPACE_DIR/USER.md" "$(cat /workspace/tlonbot/prompts/USER.md)"

export WORKSPACE_DIR
export TLON_RUN_PATH="/workspace/tlonbot/bin/tlon-run"

# Generate gateway token if not set
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
  export OPENCLAW_GATEWAY_TOKEN=$(cat /proc/sys/kernel/random/uuid)
  echo "==> Generated gateway token: $OPENCLAW_GATEWAY_TOKEN"
fi

# Ensure the Brave plugin is actually installed before the gateway starts.
# The install ledger lives in /root/.openclaw, which is a persisted volume
# (openclaw-state) — the image-layer install (Dockerfile) only seeds
# brand-new volumes, so repair existing ones idempotently, like production
# does before every gateway start. This must run AFTER all config patching
# above: the CLI refuses to install while the config is invalid, and before
# the load.paths repoint it can be. Tolerate failure (e.g. offline) like
# production; gateway config validation will surface it.
if [ -n "$BRAVE_API_KEY" ]; then
  echo "==> Ensuring Brave web-search plugin is installed..."
  openclaw plugins install @openclaw/brave-plugin \
    || echo "WARN: brave plugin install failed; web_search may be unavailable"
fi

echo "==> Starting OpenClaw gateway..."
echo "==> Access at: http://localhost:18789/?token=$OPENCLAW_GATEWAY_TOKEN"
exec openclaw gateway --port 18789 --bind lan --token "$OPENCLAW_GATEWAY_TOKEN"
