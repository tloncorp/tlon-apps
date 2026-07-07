#!/bin/bash
# Build a glob from apps/tlon-web/dist, upload it to gs://bootstrap.urbit.org,
# and patch desk/desk.docket-0 with the new hash.
#
# This is a local-dev companion to .github/helpers/glob.sh (which runs on
# Linux CI). The fakezod globber is a Linux binary, so on macOS we run the
# boot+glob inside docker and do the upload + docket patch from the host.
#
# Requirements:
#   - Built tlon-web dist (run `pnpm run build:packages && pnpm --filter tlon-web build`)
#   - Docker daemon running
#   - gcloud + gsutil authenticated with write access to gs://bootstrap.urbit.org
#
# Usage (from repo root or anywhere):
#   ./backend/make-glob.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$REPO/apps/tlon-web/dist"
DOCKET="$REPO/desk/desk.docket-0"

if [ ! -d "$DIST" ] || [ -z "$(ls -A "$DIST" 2>/dev/null)" ]; then
  echo "error: $DIST is missing or empty — build the web app first" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: docker daemon not reachable — start Docker Desktop and retry" >&2
  exit 1
fi

WORK=$(mktemp -d /tmp/glob-XXXXXX)
trap 'rm -rf "$WORK"' EXIT

echo "[1/4] Globbing inside docker (this takes a couple minutes)..."
docker run --rm \
  -v "$DIST":/dist:ro \
  -v "$WORK":/out \
  --workdir /tmp/globber \
  ubuntu:22.04 \
  bash -c '
    set -euo pipefail
    apt-get update -qq >/dev/null && apt-get install -y -qq curl rsync ca-certificates >/dev/null

    echo "  - downloading globber..."
    mkdir -p /tmp/globber && cd /tmp/globber
    curl -fsSL https://storage.googleapis.com/bootstrap.urbit.org/globberv4.tar.gz | tar xz

    echo "  - booting fakezod..."
    ./zod/.run -d
    for i in $(seq 1 60); do
      if curl -sf --data "{\"source\":{\"dojo\":\"1\"},\"sink\":{\"stdout\":null}}" http://localhost:12321 >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    echo "  - rsync dist into zod..."
    rsync -avL /dist/ zod/work/glob/ >/dev/null

    echo "  - commit %work + make-glob..."
    curl -s --data "{\"source\":{\"dojo\":\"+hood/commit %work\"},\"sink\":{\"app\":\"hood\"}}" http://localhost:12321 >/dev/null
    curl -s --data "{\"source\":{\"dojo\":\"-garden!make-glob %work /glob\"},\"sink\":{\"stdout\":null}}" http://localhost:12321 >/dev/null

    echo "  - copying .glob out..."
    cp -v zod/.urb/put/*.glob /out/

    curl -s --data "{\"source\":{\"dojo\":\"+hood/exit\"},\"sink\":{\"app\":\"hood\"}}" http://localhost:12321 >/dev/null || true
  '

GLOB_FILE=$(ls -1 "$WORK"/*.glob | head -1)
HASH=$(basename "$GLOB_FILE" | sed 's/glob-\([a-z0-9.]*\).glob/\1/')
echo "[2/4] Glob produced: $GLOB_FILE"
echo "    hash: $HASH"

echo "[3/4] Uploading to gs://bootstrap.urbit.org..."
gsutil cp "$GLOB_FILE" gs://bootstrap.urbit.org

echo "[4/4] Patching $DOCKET..."
# Portable in-place edit (BSD sed on macOS doesn't accept `-i` without an arg).
sed "s/glob-[a-z0-9\.]*glob' *[a-z0-9\.]*\]/glob-${HASH}.glob' ${HASH}]/g" "$DOCKET" > "$DOCKET.tmp"
mv "$DOCKET.tmp" "$DOCKET"

echo
echo "Done."
echo "New glob hash: $HASH"
grep glob-http "$DOCKET"
