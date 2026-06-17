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
# inside the container, either by rebuilding from source (preferred — picks up local
# edits) or by hydrating the matching platform-arch binary from openclaw-tlon's npm
# install (fallback when no source is present).
# bin/tlon is gitignored in tlon-skill, so writing it through the bind mount won't
# pollute the host working tree.
ARCH_KEY=$(node -e 'console.log(process.platform + "-" + process.arch)')
echo "==> Container platform-arch: $ARCH_KEY"

if [ -f "$TLON_SKILL_DIR/scripts/main.ts" ] && command -v bun >/dev/null 2>&1; then
  # Build from source so local edits to tlon-skill scripts/*.ts show up in the CLI.
  # bun --compile bundles all deps into the binary; the host's node_modules (bind
  # mounted) is reused since tlon-skill's deps are pure JS.
  echo "==> Rebuilding tlon-skill from source for $ARCH_KEY..."
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
    echo "==> Source present but bun not installed; falling back to npm-installed binary."
    echo "==> Add bun to dev/Dockerfile to rebuild from source on container start."
  fi
  # Always overwrite bin/tlon — never trust whatever is already there. The local
  # checkout may carry a host-built darwin binary (e.g. from `pnpm dev:link`),
  # which won't run in the linux container.
  echo "==> Hydrating $ARCH_KEY binary from container npm install..."
  # Resolution depends on `.npmrc` setting node-linker=hoisted, which puts
  # @tloncorp/tlon-skill-${platform}-${arch} at the top level of node_modules
  # (it's an optionalDep of @tloncorp/tlon-skill, not a direct dep of this repo).
  # If the linker is ever switched to pnpm's default isolated layout, this
  # resolution will fail and the fallback must scan node_modules/.pnpm/ instead.
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
      console.error(`==> Could not resolve ${pkgName} (is .npmrc still node-linker=hoisted?)`);
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
    echo "==> or check whether $PLUGIN_DIR/.npmrc still has node-linker=hoisted."
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
