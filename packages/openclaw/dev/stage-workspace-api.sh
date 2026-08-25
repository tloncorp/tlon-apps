#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(cd ../.. && pwd)"
TARBALL_PATH="$PWD/dev/tlon-api-workspace.tgz"
PACK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$PACK_DIR"
}
trap cleanup EXIT

echo "==> Building workspace @tloncorp/api..."
pnpm --dir "$REPO_ROOT" --filter @tloncorp/api build

echo "==> Packing workspace @tloncorp/api for Docker..."
pnpm --dir "$REPO_ROOT" --filter @tloncorp/api pack --pack-destination "$PACK_DIR"

PACKED_PATH="$(find "$PACK_DIR" -maxdepth 1 -type f -name '*.tgz' -print -quit)"
if [ -z "$PACKED_PATH" ]; then
  echo "FATAL: @tloncorp/api pack produced no tarball"
  exit 1
fi

if ! tar -tzf "$PACKED_PATH" | grep '^package/dist/' >/dev/null; then
  echo "FATAL: packed @tloncorp/api tarball does not contain dist/"
  exit 1
fi

cp "$PACKED_PATH" "$TARBALL_PATH"
echo "==> Workspace @tloncorp/api staged at $TARBALL_PATH"
