#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
wasm-pack build --release --target web --out-dir ../pkg

# wasm-pack generates a .gitignore that hides everything — remove it
rm -f ../pkg/.gitignore
