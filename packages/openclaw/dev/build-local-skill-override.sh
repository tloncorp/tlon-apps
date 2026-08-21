#!/bin/bash
set -euo pipefail

# /workspace/tlon is the container-local plugin copy OpenClaw actually loads.
# Materialize the skill inside that plugin root: OpenClaw 2026.7.1 resolves
# plugin skill paths before loading them and rejects symlinks that escape the
# plugin directory.
PLUGIN_DIR="${PLUGIN_DIR:-/workspace/tlon}"
# Build from the in-monorepo package so workspace/hoisted deps resolve
# (@tloncorp/api symlink + @urbit/* at the monorepo root). Compose sets this
# explicitly; the default mirrors it for standalone invocations.
SOURCE_TLON_SKILL_DIR="${TLON_SKILL_DIR:-/workspace/tlon-apps/packages/tlon-skill}"

if [ ! -f "$SOURCE_TLON_SKILL_DIR/package.json" ]; then
  echo "==> No local tlon-skill checkout found at $SOURCE_TLON_SKILL_DIR; using published @tloncorp/tlon-skill"
  exit 0
fi

if [ -z "${PLUGIN_DIR:-}" ]; then
  echo "ERROR: PLUGIN_DIR is unset"
  exit 1
fi
CANONICAL_PLUGIN_DIR=$(realpath "$PLUGIN_DIR" 2>/dev/null || true)
if [ -z "$CANONICAL_PLUGIN_DIR" ] || [ ! -f "$CANONICAL_PLUGIN_DIR/package.json" ]; then
  echo "ERROR: PLUGIN_DIR=$PLUGIN_DIR is not a valid plugin checkout (no package.json at $CANONICAL_PLUGIN_DIR)"
  exit 1
fi

TARGET="$PLUGIN_DIR/node_modules/@tloncorp/tlon-skill"
echo "==> Copying local @tloncorp/tlon-skill from $SOURCE_TLON_SKILL_DIR -> $TARGET..."
rm -rf "$TARGET"
mkdir -p "$TARGET"
(cd "$SOURCE_TLON_SKILL_DIR" && tar cf - \
  --exclude='./.git' \
  --exclude='./coverage' \
  --exclude='./node_modules' \
  --exclude='./bin/tlon' \
  --exclude='./npm/*/tlon' \
  .) | (cd "$TARGET" && tar xf - --no-same-owner)
TLON_SKILL_DIR="$TARGET"

# The `tlon` CLI loader (bin/tlon.js) checks for a local-dev binary at bin/tlon
# first, then falls back to require.resolve("@tloncorp/tlon-skill-${platform}-${arch}").
# We always produce $TLON_SKILL_DIR/bin/tlon inside the container, either by
# hydrating the matching platform binary from the plugin's npm install or, when
# opted in, rebuilding the copied source. Nothing is written through the host
# bind mount.
#
# Why the source build is opt-in: `bun build --compile` writes a temp file and
# renames it onto --outfile. On VirtioFS bind mounts (Docker Desktop) the temp
# lands at the host realpath while --outfile is the mount path, and the
# cross-namespace rename fails with ENOENT. The npm-installed skill already
# ships a working prebuilt binary, so source-from-build is only needed when
# actively editing tlon-skill — set TLON_SKILL_FROM_SOURCE=1 for that.
ARCH_KEY=$(node -e 'console.log(process.platform + "-" + process.arch)')
echo "==> Container platform-arch: $ARCH_KEY"

if [ -n "${TLON_SKILL_FROM_SOURCE:-}" ] && [ -f "$TLON_SKILL_DIR/scripts/main.ts" ] && command -v bun >/dev/null 2>&1; then
  # Build from source so local edits to tlon-skill scripts/*.ts show up in the CLI.
  # bun --compile bundles all deps into the binary; the host's node_modules (bind
  # mounted) is reused since tlon-skill's deps are pure JS. Note: may fail on
  # VirtioFS (see above) — fall back by unsetting TLON_SKILL_FROM_SOURCE.
  echo "==> Rebuilding tlon-skill from source for $ARCH_KEY (TLON_SKILL_FROM_SOURCE set)..."
  if [ ! -d "$TLON_SKILL_DIR/node_modules" ]; then
    echo "==> Installing tlon-skill deps (bun install)..."
    (cd "$TLON_SKILL_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install)
  fi
  (cd "$TLON_SKILL_DIR" && node scripts/build-all.js --target="$ARCH_KEY")
  BUILT="$TLON_SKILL_DIR/npm/$ARCH_KEY/tlon"
  if [ ! -f "$BUILT" ]; then
    echo "ERROR: build-all.js did not produce $BUILT"
    exit 1
  fi
  cp "$BUILT" "$TLON_SKILL_DIR/bin/tlon"
  chmod +x "$TLON_SKILL_DIR/bin/tlon"
  echo "==> Built $TLON_SKILL_DIR/bin/tlon from source"
else
  if [ -f "$TLON_SKILL_DIR/scripts/main.ts" ]; then
    echo "==> Using prebuilt tlon-skill binary (set TLON_SKILL_FROM_SOURCE=1 to rebuild from local source)."
  fi
  # Always overwrite bin/tlon — never trust whatever is already there. The local
  # checkout may carry a host-built darwin binary (e.g. from `pnpm dev:link`),
  # which won't run in the linux container.
  echo "==> Hydrating $ARCH_KEY binary from container npm install..."
  # Resolution depends on the hoisted layout (dev/entrypoint*.sh set
  # nodeLinker: hoisted), which puts @tloncorp/tlon-skill-${platform}-${arch}
  # at the top level of node_modules (it's an optionalDep of @tloncorp/tlon-skill,
  # not a direct dep of this repo). If the linker is ever switched to pnpm's
  # default isolated layout, this resolution will fail and the fallback must
  # scan node_modules/.pnpm/ instead.
  HYDRATED=$(cd "$PLUGIN_DIR" && node --input-type=module -e '
    import { createRequire } from "node:module";
    import { dirname, join } from "node:path";
    const require = createRequire(import.meta.url);
    const pkgName = `@tloncorp/tlon-skill-${process.platform}-${process.arch}`;
    try {
      const pkg = require.resolve(`${pkgName}/package.json`);
      console.error(`==> Using ${pkgName} from ${pkg}`);
      console.log(join(dirname(pkg), "tlon"));
    } catch {
      console.error(`==> Could not resolve ${pkgName} (did the install run with nodeLinker=hoisted?)`);
      process.exit(0);
    }
  ' || true)
  if [ -n "$HYDRATED" ] && [ -f "$HYDRATED" ]; then
    cp "$HYDRATED" "$TLON_SKILL_DIR/bin/tlon"
    chmod +x "$TLON_SKILL_DIR/bin/tlon"
    echo "==> Copied $HYDRATED -> $TLON_SKILL_DIR/bin/tlon"
  else
    echo "==> WARN: could not locate a platform-native tlon binary; the tlon CLI may not run."
    echo "==> Run \`pnpm dev:link\` inside $TLON_SKILL_DIR to build it locally,"
    echo "==> or check that the install ran with nodeLinker: hoisted (see dev/entrypoint*.sh)."
    # Pre-existing bin/tlon may be stale or wrong-arch; remove it so the CLI
    # shim's "platform unsupported" error surfaces clearly instead of segfaulting
    # or executing the wrong arch.
    rm -f "$TLON_SKILL_DIR/bin/tlon"
  fi
fi

echo "==> Verifying plugin-local @tloncorp/tlon-skill..."
cd "$PLUGIN_DIR"
node --input-type=module -e '
  import { existsSync, readFileSync } from "node:fs";
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@tloncorp/tlon-skill/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "@tloncorp/tlon-skill") {
    throw new Error(`unexpected package name at ${pkgPath}: ${pkg.name}`);
  }
  const skillMd = pkgPath.replace(/package\.json$/, "SKILL.md");
  if (!existsSync(skillMd)) {
    throw new Error(`linked @tloncorp/tlon-skill is missing SKILL.md at ${skillMd}`);
  }
  console.log(`==> Plugin-local @tloncorp/tlon-skill verified at ${pkgPath} (version ${pkg.version})`);
'

echo "==> Local tlon-skill override copied into $PLUGIN_DIR"
