#!/bin/bash
set -euo pipefail

# /workspace/tlon is the container-local plugin copy openclaw actually loads
# (the entrypoint installs there); link the override into it, matching
# build-local-api-override.sh. The bind-mounted /workspace/openclaw-tlon is
# not on plugins.load.paths, so linking there would be a no-op.
PLUGIN_DIR="${PLUGIN_DIR:-/workspace/tlon}"
# Build from the in-monorepo package so workspace/hoisted deps resolve
# (@tloncorp/api symlink + @urbit/* at the monorepo root). Compose sets this
# explicitly; the default mirrors it for standalone invocations.
TLON_SKILL_DIR="${TLON_SKILL_DIR:-/workspace/tlon-apps/packages/tlon-skill}"

if [ ! -f "$TLON_SKILL_DIR/package.json" ]; then
  echo "==> No local tlon-skill checkout found at $TLON_SKILL_DIR; using published @tloncorp/tlon-skill"
  exit 0
fi

# Mirror the api override: symlink the local checkout over node_modules/@tloncorp/tlon-skill.
# A plain symlink avoids running `npm link` (which would trigger postinstall on a host-
# darwin bind mount) and sidesteps pnpm's isolated layout (replacing the .pnpm/ symlink
# with a real directory would break transitive resolution).
#
# See build-local-api-override.sh for the longer rationale; the same constraints apply.
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
echo "==> Linking local @tloncorp/tlon-skill from $TLON_SKILL_DIR -> $TARGET..."
# Keep TARGET literal (no realpath) — see build-local-api-override.sh for why.
rm -rf "$TARGET"
mkdir -p "$(dirname "$TARGET")"
ln -s "$TLON_SKILL_DIR" "$TARGET"

# The `tlon` CLI loader (bin/tlon.js) checks for a local-dev binary at bin/tlon
# first, then falls back to require.resolve("@tloncorp/tlon-skill-${platform}-${arch}").
# After symlinking, the fallback resolves from the realpath ($TLON_SKILL_DIR/bin/)
# walking up via the local checkout's node_modules — which on a darwin host won't
# have the linux binary package installed. So we always produce $TLON_SKILL_DIR/bin/tlon
# inside the container, either by hydrating the matching platform-arch binary from
# the plugin's npm install (the default — works on any Docker backend) or, when
# opted in, by rebuilding from source to pick up local edits.
# bin/tlon is gitignored in tlon-skill, so writing it through the bind mount won't
# pollute the host working tree.
#
# Why the source build is opt-in: the published @tloncorp/tlon-skill is only as
# current as the last release, so anything added since (e.g. the `surface *`
# group, absent from 0.5.0) is missing from the prebuilt binary. Set
# TLON_SKILL_FROM_SOURCE=1 when the container must run CLI code from the mounted
# checkout rather than from npm.
#
# The build never writes its --outfile onto the bind mount. `bun build --compile`
# emits a temp file next to --outfile and renames it into place, and that rename
# was previously reported to fail with ENOENT on VirtioFS bind mounts (Docker
# Desktop), where the temp lands at the host realpath while --outfile is the
# mount path. That failure does NOT reproduce on OrbStack's fuseblk mount, so it
# is backend-specific rather than universal — which is exactly why the fix is to
# stop depending on the rename at all: compiling to a container-local path and
# copying the finished binary across is a plain write, correct on every backend
# instead of only the ones where the rename happens to work. It also leaves
# npm/<arch>/tlon in the mounted checkout untouched — bin/tlon is the only host
# file written.
ARCH_KEY=$(node -e 'console.log(process.platform + "-" + process.arch)')
echo "==> Container platform-arch: $ARCH_KEY"

if [ -n "${TLON_SKILL_FROM_SOURCE:-}" ] && [ -f "$TLON_SKILL_DIR/scripts/main.ts" ] && command -v bun >/dev/null 2>&1; then
  # Build from source so local edits to tlon-skill scripts/*.ts show up in the CLI.
  # bun --compile bundles all deps into the binary; the host's node_modules (bind
  # mounted) is reused since tlon-skill's deps are pure JS.
  echo "==> Rebuilding tlon-skill from source for $ARCH_KEY (TLON_SKILL_FROM_SOURCE set)..."
  if [ ! -d "$TLON_SKILL_DIR/node_modules" ]; then
    echo "==> Installing tlon-skill deps (bun install)..."
    (cd "$TLON_SKILL_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install)
  fi
  case "$ARCH_KEY" in
    linux-x64) BUN_TARGET=bun-linux-x64 ;;
    linux-arm64) BUN_TARGET=bun-linux-arm64 ;;
    darwin-x64) BUN_TARGET=bun-darwin-x64 ;;
    darwin-arm64) BUN_TARGET=bun-darwin-arm64 ;;
    *) echo "ERROR: unsupported platform-arch for a source build: $ARCH_KEY"; exit 1 ;;
  esac
  # Mirrors scripts/build-all.js, which cannot be used here because its
  # --outfile is inside the checkout (see the rename note above).
  SKILL_VERSION=$(node -e "console.log(require('$TLON_SKILL_DIR/package.json').version)")
  BUILD_DIR=$(mktemp -d /tmp/tlon-skill-build.XXXXXX)
  trap 'rm -rf "$BUILD_DIR"' EXIT
  (cd "$TLON_SKILL_DIR" && bun build scripts/main.ts --compile \
    --target="$BUN_TARGET" \
    --outfile "$BUILD_DIR/tlon" \
    --define __VERSION__="\"$SKILL_VERSION-src\"")
  if [ ! -f "$BUILD_DIR/tlon" ]; then
    echo "ERROR: bun build did not produce $BUILD_DIR/tlon"
    exit 1
  fi
  cp "$BUILD_DIR/tlon" "$TLON_SKILL_DIR/bin/tlon"
  chmod +x "$TLON_SKILL_DIR/bin/tlon"
  echo "==> Built $TLON_SKILL_DIR/bin/tlon from source ($SKILL_VERSION-src, $BUN_TARGET)"
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

echo "==> Verifying linked @tloncorp/tlon-skill..."
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
  console.log(`==> Linked @tloncorp/tlon-skill verified at ${pkgPath} (version ${pkg.version})`);
'

echo "==> Local tlon-skill override linked into $PLUGIN_DIR"
