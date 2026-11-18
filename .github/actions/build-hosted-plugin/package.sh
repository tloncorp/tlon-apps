#!/bin/bash
set -euo pipefail

ring=${1:?expected internal or prod}
archive=${2:?expected absolute archive path}
case "$ring" in internal|prod) ;; *) exit 2 ;; esac
[[ "$archive" = /* && "$(node -p 'process.platform + "-" + process.arch')" = linux-x64 ]]

root=$(git rev-parse --show-toplevel)
commit=$(git rev-parse HEAD)
plugin="$root/packages/openclaw"
skill="$root/packages/tlon-skill"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
pnpm --dir "$root/packages/api" build
pnpm --dir "$plugin" build
(cd "$plugin" && node scripts/prepare-publish-package.js)
cp -R "$plugin/.publish" "$work/tlon"

# Keep npm's install outside the workspace so the archive can be moved to a
# Pioneer without any links to the runner or an extra copy of OpenClaw.
cd "$work"
api_tgz=$(npm pack "$root/packages/api" --ignore-scripts --silent)
cd tlon
npm pkg set "dependencies.@tloncorp/api=file:$work/$api_tgz"
if [[ "$ring" = internal ]]; then
  npm pkg delete dependencies.@tloncorp/tlon-skill
fi
npm install --omit=dev --legacy-peer-deps --ignore-scripts --package-lock=false
cp "$plugin/.publish/package.json" .
if [[ "$ring" = internal ]]; then
  pnpm --dir "$skill" build
  skill_tgz=$(cd "$work" && npm pack "$skill" --ignore-scripts --silent)
  target=node_modules/@tloncorp/tlon-skill
  mkdir -p "$target"
  tar -xzf "$work/$skill_tgz" --strip-components=1 -C "$target"
  install -m 755 "$skill/dist/tlon-run" "$target/bin/tlon"
  printf '%s\n' "$commit" > "$target/.tlon-skill-commit"
fi

printf '%s\n' "$commit" > .tlon-plugin-commit
printf 'repo %s\n' "$commit" > .tlon-api-source
host=$(cd "$plugin" && node --input-type=module -e 'import {findPackageJSON} from "node:module"; console.log(findPackageJSON("openclaw", import.meta.url))')
node -p 'require(process.argv[1]).version' "$host" > .tlon-openclaw-version
tar -czf "$archive" -C "$work" tlon

# Exercise the extracted tree with only its declared host peer available.
mkdir -p "$work/smoke/node_modules"
ln -s "$(dirname "$host")" "$work/smoke/node_modules/openclaw"
tar -xzf "$archive" -C "$work/smoke"
cd "$work/smoke/tlon"
node --input-type=module -e 'await import("./dist/index.js"); await import("./dist/setup-entry.js")'
node node_modules/@tloncorp/tlon-skill/bin/tlon.js --version
