#!/bin/bash
set -euo pipefail

PLUGIN_DIR="${PLUGIN_DIR:-/workspace/openclaw-tlon}"
TLON_APPS_DIR="${TLON_APPS_DIR:-/workspace/tlon-apps}"
LOCAL_API_DIR="$TLON_APPS_DIR/packages/api"
LOCAL_DIST_DIR="$LOCAL_API_DIR/dist"

if [ ! -f "$LOCAL_API_DIR/package.json" ]; then
  echo "==> No local tlon-apps API checkout found at $LOCAL_API_DIR; using published @tloncorp/api"
  exit 0
fi

if [ ! -f "$LOCAL_DIST_DIR/index.js" ]; then
  echo "==> No local tlon-apps API build found at $LOCAL_DIST_DIR"
  echo "==> Using published @tloncorp/api. Build it locally with:"
  echo "==>   pnpm --dir $TLON_APPS_DIR --filter @tloncorp/api build"
  exit 0
fi

# We can't use `npm link` (runs `prepare` -> tsup -> rollup, fails on missing
# linux native bindings from the host darwin bind mount), and a tarball
# overlay into node_modules/@tloncorp/api doesn't work because pnpm uses an
# isolated layout: that path is normally a symlink into .pnpm/, and replacing
# it with a real directory breaks resolution of transitive deps like
# any-ascii. A plain symlink to the local checkout sidesteps both problems:
# no scripts run, and Node resolves the symlink to the realpath in homestead,
# where transitive deps are reachable via the workspace's node_modules.
# Sanity-check before `rm -rf`: PLUGIN_DIR can be overridden via env, so
# verify it canonicalizes to an actual plugin checkout (contains a
# package.json) rather than hardcoding a path — that keeps the override
# usable for non-default mounts. Keep TARGET literal (no realpath) —
# running realpath on TARGET would dereference an existing symlink
# (pnpm's into .pnpm/ or our own from a prior run), and the subsequent
# `rm -rf` would nuke the real package instead of just removing the link.
if [ -z "${PLUGIN_DIR:-}" ]; then
  echo "ERROR: PLUGIN_DIR is unset"
  exit 1
fi
CANONICAL_PLUGIN_DIR=$(realpath "$PLUGIN_DIR" 2>/dev/null || true)
if [ -z "$CANONICAL_PLUGIN_DIR" ] || [ ! -f "$CANONICAL_PLUGIN_DIR/package.json" ]; then
  echo "ERROR: PLUGIN_DIR=$PLUGIN_DIR is not a valid plugin checkout (no package.json at $CANONICAL_PLUGIN_DIR)"
  exit 1
fi
TARGET="$PLUGIN_DIR/node_modules/@tloncorp/api"
echo "==> Linking local @tloncorp/api from $LOCAL_API_DIR -> $TARGET..."
rm -rf "$TARGET"
mkdir -p "$(dirname "$TARGET")"
ln -s "$LOCAL_API_DIR" "$TARGET"

echo "==> Verifying linked @tloncorp/api exports..."
cd "$PLUGIN_DIR"
node --input-type=module -e '
  const mod = await import("@tloncorp/api");
  const required = [
    "configureClient",
    "scry",
    "sendPost",
    "sendReply",
    "addReaction",
    "removeReaction",
    "deletePost",
    "uploadFile",
    "configureGatewayStatus",
    "gatewayStart",
    "gatewayHeartbeat",
    "gatewayStop",
  ];
  const missing = required.filter((name) => typeof mod[name] !== "function");
  if (missing.length > 0) {
    throw new Error(`linked @tloncorp/api is missing exports: ${missing.join(", ")}`);
  }
  console.log(`==> Linked @tloncorp/api verified: ${required.join(", ")}`);
'

echo "==> Local tlon-apps API override linked into $PLUGIN_DIR"
