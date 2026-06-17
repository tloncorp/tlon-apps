#!/usr/bin/env bash
# scripts/sync-deps.sh
# Vendor %base (urbit/urbit) and %landscape (tloncorp/landscape) desk
# dependencies into desk/lib, desk/mar, desk/sur using peru, per peru.yaml.
# Run this after cloning, and after changing peru.yaml, before building or
# rsync'ing the desk to a ship.

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v peru >/dev/null 2>&1; then
  cat >&2 <<'EOF'
peru is not installed. Install it:
  pipx install peru        # recommended
  pip install peru         # via pip
  brew install peru        # via homebrew
See https://github.com/buildinspace/peru
EOF
  exit 1
fi

peru sync
echo "Desk dependencies synced."
