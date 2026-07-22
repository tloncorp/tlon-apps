#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/mobile-fast-bootstrap.sh /absolute/path/to/prepared-worktree

Prepares a fresh worktree for mobile JavaScript work by linking its dependency
tree to an already-installed worktree, then generating the two required local
artifacts. The dependency manifests, platform, architecture, Node ABI, and pnpm
version must match exactly.

Do not run pnpm install in a linked worktree. Remove its node_modules directories
and perform a normal install when dependencies change.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 2
fi

target_root="$(git rev-parse --show-toplevel)"
seed_root="$(cd "$1" && git rev-parse --show-toplevel)"

if [[ "$target_root" == "$seed_root" ]]; then
  echo "The prepared worktree must be different from the target worktree." >&2
  exit 1
fi

if [[ ! -d "$seed_root/node_modules" || ! -e "$seed_root/node_modules/expo" ]]; then
  echo "The prepared worktree does not have a complete root dependency installation." >&2
  exit 1
fi

if [[ -e "$target_root/node_modules" || -L "$target_root/node_modules" ]]; then
  echo "The target already has node_modules. Refusing to replace it." >&2
  exit 1
fi

dependency_signature() {
  local root="$1"

  (
    cd "$root"
    {
      printf 'platform=%s\n' "$(uname -s)"
      printf 'architecture=%s\n' "$(uname -m)"
      printf 'node_abi=%s\n' "$(node -p 'process.versions.modules')"
      printf 'package_manager=%s\n' "$(node -p "require('./package.json').packageManager || ''")"

      {
        for file in package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .nvmrc; do
          [[ -f "$file" ]] && printf '%s\n' "$file"
        done
        find apps packages \
          -type d -name node_modules -prune -o \
          -type f -name package.json -print
        [[ -d patches ]] && find patches -type f -print
      } | LC_ALL=C sort -u | while IFS= read -r file; do
        shasum -a 256 "$file"
      done
    } | shasum -a 256 | awk '{print $1}'
  )
}

echo "Checking that dependency inputs match..."
target_signature="$(dependency_signature "$target_root")"
seed_signature="$(dependency_signature "$seed_root")"

if [[ "$target_signature" != "$seed_signature" ]]; then
  cat >&2 <<EOF
Dependency inputs do not match the prepared worktree.

Target:   $target_signature
Prepared: $seed_signature

Use a normal frozen pnpm install for this worktree.
EOF
  exit 1
fi

started_at=$SECONDS
echo "Linking dependency trees from $seed_root..."
node - "$seed_root" "$target_root" <<'NODE'
const fs = require('fs');
const path = require('path');

const seedRoot = process.argv[2];
const targetRoot = process.argv[3];

function linkDirectoryEntries(sourceDirectory, targetDirectory) {
  fs.mkdirSync(targetDirectory, { recursive: true });

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const source = path.join(sourceDirectory, entry.name);
    const target = path.join(targetDirectory, entry.name);

    if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(source), target);
    } else if (entry.name.startsWith('@') && entry.isDirectory()) {
      // Scoped directories contain package links. Recreate those links so
      // workspace dependencies resolve inside the new worktree.
      linkDirectoryEntries(source, target);
    } else {
      fs.symlinkSync(source, target, entry.isDirectory() ? 'dir' : 'file');
    }
  }
}

linkDirectoryEntries(
  path.join(seedRoot, 'node_modules'),
  path.join(targetRoot, 'node_modules')
);

for (const workspaceGroup of ['apps', 'packages']) {
  const seedGroup = path.join(seedRoot, workspaceGroup);
  if (!fs.existsSync(seedGroup)) continue;

  for (const workspace of fs.readdirSync(seedGroup, { withFileTypes: true })) {
    if (!workspace.isDirectory()) continue;
    const source = path.join(seedGroup, workspace.name, 'node_modules');
    if (!fs.existsSync(source)) continue;
    const target = path.join(
      targetRoot,
      workspaceGroup,
      workspace.name,
      'node_modules'
    );
    linkDirectoryEntries(source, target);
  }
}
NODE

cat > "$target_root/node_modules/.tlon-linked-deps" <<EOF
prepared_worktree=$seed_root
dependency_signature=$seed_signature
EOF

linked_at=$SECONDS
echo "Dependency linking completed in $((linked_at - started_at))s."

echo "Building the editor package..."
(cd "$target_root" && corepack pnpm --filter @tloncorp/editor build)
editor_at=$SECONDS

echo "Generating mobile Tailwind artifacts..."
(cd "$target_root" && corepack pnpm --filter tlon-mobile run generate:tailwind)
tailwind_at=$SECONDS

echo "Checking the Expo configuration..."
(cd "$target_root" && corepack pnpm --filter tlon-mobile exec expo config --type public --json >/dev/null)
finished_at=$SECONDS

cat <<EOF

Mobile worktree ready in $((finished_at - started_at))s:
  dependencies: $((linked_at - started_at))s
  editor build: $((editor_at - linked_at))s
  Tailwind:     $((tailwind_at - editor_at))s
  Expo check:   $((finished_at - tailwind_at))s

Do not run pnpm install here. If dependencies change, remove node_modules and
perform a normal frozen install.
EOF
