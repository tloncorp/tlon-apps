#!/bin/bash

set -euo pipefail

URBIT_HOME="${URBIT_HOME:-$HOME}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_NAME="${WORKTREE_NAME:-$(basename "$REPO_ROOT")}"
PIER_NAME="${PIER_NAME:-$WORKTREE_NAME}"
PIER_DIR="${PIER_DIR:-$URBIT_HOME/$PIER_NAME}"

if [ "$PIER_DIR" = "/" ] || [ "$PIER_DIR" = "$HOME" ] || [ "$PIER_DIR" = "" ]; then
  echo "Refusing to delete unsafe path: $PIER_DIR" >&2
  exit 1
fi

echo "Tearing down pier at: $PIER_DIR"

if pgrep -f "$PIER_DIR" >/dev/null 2>&1; then
  echo "Stopping running urbit process(es) for $PIER_DIR ..."
  pkill -TERM -f "$PIER_DIR" || true
  sleep 2
  pkill -KILL -f "$PIER_DIR" || true
fi

if [ -d "$PIER_DIR" ]; then
  rm -rf "$PIER_DIR"
  echo "Deleted $PIER_DIR"
else
  echo "Nothing to delete; $PIER_DIR does not exist."
fi
