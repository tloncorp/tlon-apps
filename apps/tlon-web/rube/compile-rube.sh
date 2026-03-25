#!/bin/bash

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$APP_ROOT"

ENTRYPOINTS=(
  "./rube/index.ts"
  "./rube/run-selected-tests.ts"
  "./rube/playwright-dev.ts"
)

EXPECTED_OUTPUTS=(
  "./rube/dist/index.js"
  "./rube/dist/run-selected-tests.js"
  "./rube/dist/playwright-dev.js"
)

echo "Compiling rube entrypoints..."
mkdir -p ./rube/dist
rm -f "${EXPECTED_OUTPUTS[@]}"
find ./rube -maxdepth 1 -name 'tsconfig.*.tsbuildinfo' -delete

pnpm exec tsc-files \
  --project ./tsconfig.rube.json \
  "${ENTRYPOINTS[@]}"

for output in "${EXPECTED_OUTPUTS[@]}"; do
  if [ ! -f "$output" ]; then
    echo "Missing compiled rube output: $output"
    exit 1
  fi
done

find ./rube -maxdepth 1 -name 'tsconfig.*.tsbuildinfo' -delete

echo "Rube compilation complete"
