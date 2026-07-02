#!/usr/bin/env bash
# scripts/assemble-desk.sh <target-dir>
#
# Assemble a complete %groups desk into <target-dir> by layering:
#   1. desk-deps/  (peru-vendored upstream deps)  -- rsync'd in with --delete
#   2. desk/       (our own source)               -- rsync'd on top
#
# Step 1's --delete clears any stale files already in the target (e.g. the old
# full base-dev a pier was built with, or files we've since removed). Step 2
# overlays our source, which wins on any overlap. The result is exactly
# desk-deps/ + desk/.
#
# By default this runs `peru sync` first to ensure desk-deps/ is populated and
# current. Set SKIP_SYNC=true to skip that (e.g. when syncing once before
# assembling into many targets).

set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
if [ -z "$target" ]; then
  echo "usage: $0 <target-dir>" >&2
  exit 1
fi

if [ "${SKIP_SYNC:-false}" != "true" ]; then
  ./scripts/sync-deps.sh
fi

if [ ! -d desk-deps ]; then
  echo "desk-deps/ not found — run scripts/sync-deps.sh (peru sync) first" >&2
  exit 1
fi

mkdir -p "$target"
# 1. vendored deps first, clearing anything stale in the target
rsync -aL --delete desk-deps/ "$target/"
# 2. our own source on top (wins on overlap). Excludes:
#   - app/notes-ui/  the raw single-file HTML app kept in-repo only as an
#     editable source; it's hand-copied into lib/notes-ui.hoon (+index), which
#     is what %notes actually serves. It's not desk source, so keep it off the
#     assembled desk.
rsync -aL --exclude 'app/notes-ui/' desk/ "$target/"

# stamp the build commit, like the deploy pipeline does
git rev-parse --short HEAD > "$target/commit.txt" 2>/dev/null || true

echo "Assembled desk into $target"
