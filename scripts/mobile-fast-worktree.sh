#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/mobile-fast-worktree.sh [--detach] NAME [START_POINT]

Creates and bootstraps an ephemeral mobile worktree beneath a sibling directory
whose name ends in .noindex, keeping Spotlight out of the iteration path.

By default the worktree gets branch db/NAME. With --detach, it is detached.
START_POINT defaults to HEAD. The current worktree is used as the prepared seed.
EOF
}

detach=0
if [[ "${1:-}" == "--detach" ]]; then
  detach=1
  shift
fi
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 2
fi

name="$1"
start_point="${2:-HEAD}"
if ! [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || [[ "$name" == *..* ]]; then
  echo "NAME may contain letters, numbers, dots, underscores, and hyphens." >&2
  exit 2
fi

seed_root="$(git rev-parse --show-toplevel)"
primary_root="$(git worktree list --porcelain | awk '$1 == "worktree" { print $2; exit }')"
worktree_parent="$(dirname "$primary_root")/$(basename "$primary_root")-worktrees.noindex"
target_root="$worktree_parent/$name"

if [[ -e "$target_root" ]]; then
  echo "Target already exists: $target_root" >&2
  exit 1
fi

mkdir -p "$worktree_parent"
started_at=$SECONDS
if [[ "$detach" -eq 1 ]]; then
  git worktree add --detach "$target_root" "$start_point"
else
  git worktree add -b "db/$name" "$target_root" "$start_point"
fi
created_at=$SECONDS

(cd "$target_root" && scripts/mobile-fast-bootstrap.sh "$seed_root")
finished_at=$SECONDS

cat <<EOF

Created mobile worktree at $target_root in $((finished_at - started_at))s:
  worktree: $((created_at - started_at))s
  bootstrap: $((finished_at - created_at))s
EOF
