#!/usr/bin/env bash
# scripts/assemble-desk.sh <target-dir> [harness]
#
# Assemble a complete %groups desk into <target-dir> by layering:
#   1. desk-deps/  (peru-vendored upstream deps)  -- rsync'd in with --delete
#   2. desk/       (our own source)               -- rsync'd on top
#
# With `harness`, assemble the %harness desk instead:
#   1. packages/harness/desk-deps/  (peru-vendored)  -- rsync'd in with --delete
#   2. the Tlon files listed in packages/harness/tlon-files.txt, from desk/
#   3. packages/harness/desk/       (its own source) -- rsync'd on top
# The Tlon files come from this checkout rather than through peru, so they
# always match the %groups desk next to them.
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
desk="${2:-groups}"
usage="usage: $0 <target-dir> [harness]"
if [ -z "$target" ]; then
  echo "$usage" >&2
  exit 1
fi
case "$desk" in
  groups)
    deps=desk-deps
    src=desk
    ;;
  harness)
    deps=packages/harness/desk-deps
    src=packages/harness/desk
    ;;
  *)
    echo "$usage" >&2
    exit 1
    ;;
esac

if [ "${SKIP_SYNC:-false}" != "true" ]; then
  ./scripts/sync-deps.sh
fi

if [ ! -d "$deps" ]; then
  echo "$deps/ not found — run scripts/sync-deps.sh (peru sync) first" >&2
  exit 1
fi

mkdir -p "$target"
# Finder droppings have no Clay mark and fail the desk commit outright
# (observed as a silent kiln no-op that reads as a hung |commit).
# --delete-excluded also purges any .DS_Store already present in an
# existing target (a mounted desk): plain --delete would protect it,
# since --exclude keeps it out of rsync's deletion candidate list.
# 1. vendored deps first, clearing anything stale in the target
rsync -aL --delete --delete-excluded --exclude=.DS_Store "$deps/" "$target/"
if [ "$desk" = harness ]; then
  # Harness compiles against these %groups types and codecs.
  while IFS= read -r file; do
    mkdir -p "$target/$(dirname "$file")"
    cp "desk/$file" "$target/$file"
  done < <(grep -Ev '^[[:space:]]*(#|$)' packages/harness/tlon-files.txt)
fi
# 2. our own source on top (wins on overlap)
rsync -aL --exclude=.DS_Store "$src/" "$target/"

# Stamp the build commit, like the deploy pipeline does. Redirecting straight
# into the file would truncate it before git ran, so a checkout without git
# metadata (e.g. a Docker build context that .dockerignore strips .git from)
# left an EMPTY stamp and %groups/%logs then compiled provenance as unknown.
# Capture first and only overwrite the copied desk/commit.txt on success.
if [ "$desk" = groups ]; then
  commit="$(git rev-parse --short HEAD 2>/dev/null || true)"
  if [ -n "$commit" ]; then
    printf '%s\n' "$commit" > "$target/commit.txt"
  fi
fi

echo "Assembled $desk desk into $target"
