#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/mobile-fast-bootstrap.sh [--allow-concurrent-native-build] /absolute/path/to/prepared-worktree
  scripts/mobile-fast-bootstrap.sh --prepare-artifacts

Prepares a fresh worktree for mobile JavaScript work by linking its dependency
tree to an already-installed worktree. Generated editor and Tailwind artifacts
are copied when a signed, source-identical set exists; otherwise they are built.
The dependency manifests, platform, architecture, Node ABI, and pnpm version
must match exactly.

--prepare-artifacts rebuilds and signs the artifacts in the current worktree so
it can seed source-identical worktrees.

Do not run pnpm install in a linked worktree. Remove its node_modules directories
and perform a normal install when dependencies change.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

prepare_artifacts=0
allow_concurrent_native_build="${TLON_MOBILE_ALLOW_CONCURRENT_NATIVE_BUILD:-0}"
seed_path=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prepare-artifacts)
      prepare_artifacts=1
      shift
      ;;
    --allow-concurrent-native-build)
      allow_concurrent_native_build=1
      shift
      ;;
    *)
      if [[ -n "$seed_path" ]]; then
        usage >&2
        exit 2
      fi
      seed_path="$1"
      shift
      ;;
  esac
done

if [[ "$prepare_artifacts" -eq 1 && -n "$seed_path" ]] \
  || [[ "$prepare_artifacts" -eq 0 && -z "$seed_path" ]]; then
  usage >&2
  exit 2
fi

target_root="$(git rev-parse --show-toplevel)"

active_native_builds() {
  ps -axo pid=,command= | awk -v own_pid="$$" '
    $1 != own_pid && ($0 ~ /[x]codebuild .* (-workspace|-project|-scheme|archive|build)/ || $0 ~ /[Gg]radle.* (assemble|bundle|install|build)/ || $0 ~ /[e]as (build|build:run).*--local/) { print }
  '
}

if [[ "$allow_concurrent_native_build" != "1" ]]; then
  native_builds="$(active_native_builds)"
  if [[ -n "$native_builds" ]]; then
    cat >&2 <<EOF
A native build is already using this machine. Starting bootstrap now is likely
to make both loops slower:
$native_builds

Wait for it to finish, or pass --allow-concurrent-native-build to override.
EOF
    exit 1
  fi
fi

artifact_tree_signature() {
  local root="$1"
  shift

  if [[ -n "$(git -C "$root" status --porcelain --untracked-files=all -- "$@")" ]]; then
    return 1
  fi

  (
    cd "$root"
    for source_path in "$@"; do
      printf '%s\0' "$source_path"
      git rev-parse "HEAD:$source_path"
    done
  ) | shasum -a 256 | awk '{print $1}'
}

editor_signature() {
  artifact_tree_signature "$1" packages/editor
}

tailwind_signature() {
  artifact_tree_signature "$1" \
    apps/tlon-mobile packages/app packages/ui
}

write_artifact_manifest() {
  local root="$1"
  local dependency="$2"
  local editor="$3"
  local tailwind="$4"

  cat > "$root/node_modules/.tlon-generated-artifacts" <<EOF
dependency_signature=$dependency
editor_signature=$editor
tailwind_signature=$tailwind
EOF
}

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

build_and_sign_artifacts() {
  local root="$1"
  local dependency editor tailwind

  dependency="$(dependency_signature "$root")"
  editor="$(editor_signature "$root" || true)"
  tailwind="$(tailwind_signature "$root" || true)"

  echo "Building the editor package..."
  (cd "$root" && corepack pnpm --filter @tloncorp/editor build)
  editor_at=$SECONDS

  echo "Generating mobile Tailwind artifacts..."
  (cd "$root" && corepack pnpm --filter tlon-mobile run generate:tailwind)
  tailwind_at=$SECONDS

  if [[ -n "$editor" && -n "$tailwind" ]]; then
    write_artifact_manifest "$root" "$dependency" "$editor" "$tailwind"
  else
    rm -f "$root/node_modules/.tlon-generated-artifacts"
    echo "Artifacts were built but not signed because relevant source files are dirty."
  fi
}

if [[ "$prepare_artifacts" -eq 1 ]]; then
  if [[ ! -e "$target_root/node_modules/expo" ]]; then
    echo "Dependencies are not installed in $target_root." >&2
    exit 1
  fi
  started_at=$SECONDS
  build_and_sign_artifacts "$target_root"
  echo "Prepared and signed generated artifacts in $((SECONDS - started_at))s."
  exit 0
fi

seed_root="$(cd "$seed_path" && git rev-parse --show-toplevel)"

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

target_editor_signature="$(editor_signature "$target_root" || true)"
target_tailwind_signature="$(tailwind_signature "$target_root" || true)"
artifact_manifest="$seed_root/node_modules/.tlon-generated-artifacts"
reuse_artifacts=0

if [[ -n "$target_editor_signature" && -n "$target_tailwind_signature" \
  && -f "$artifact_manifest" ]]; then
  # shellcheck disable=SC1090
  source "$artifact_manifest"
  if [[ "${dependency_signature:-}" == "$seed_signature" \
    && "${editor_signature:-}" == "$target_editor_signature" \
    && "${tailwind_signature:-}" == "$target_tailwind_signature" \
    && -f "$seed_root/packages/editor/dist/index.html" \
    && -f "$seed_root/apps/tlon-mobile/tailwind.css" \
    && -f "$seed_root/apps/tlon-mobile/tailwind.json" ]]; then
    reuse_artifacts=1
  fi
fi

if [[ "$reuse_artifacts" -eq 1 ]]; then
  echo "Copying source-identical generated artifacts..."
  mkdir -p "$target_root/packages/editor/dist"
  cp -R "$seed_root/packages/editor/dist/." "$target_root/packages/editor/dist/"
  cp "$seed_root/apps/tlon-mobile/tailwind.css" \
    "$seed_root/apps/tlon-mobile/tailwind.json" \
    "$target_root/apps/tlon-mobile/"
  write_artifact_manifest \
    "$target_root" "$seed_signature" \
    "$target_editor_signature" "$target_tailwind_signature"
  editor_at=$SECONDS
  tailwind_at=$SECONDS
else
  build_and_sign_artifacts "$target_root"
fi

echo "Checking the Expo configuration..."
(cd "$target_root" && corepack pnpm --filter tlon-mobile exec expo config --type public --json >/dev/null)
finished_at=$SECONDS

cat <<EOF

Mobile worktree ready in $((finished_at - started_at))s:
  dependencies: $((linked_at - started_at))s
  editor:       $((editor_at - linked_at))s
  Tailwind:     $((tailwind_at - editor_at))s
  Expo check:   $((finished_at - tailwind_at))s

Do not run pnpm install here. If dependencies change, remove node_modules and
perform a normal frozen install.
EOF
