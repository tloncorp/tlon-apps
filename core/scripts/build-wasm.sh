#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$CORE_DIR"
wasm-pack build --release --target web --out-dir ../packages/shared/src/signal/pkg
