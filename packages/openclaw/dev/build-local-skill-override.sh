#!/bin/bash
set -euo pipefail

# /workspace/tlon is the container-local plugin copy openclaw actually loads
# (the entrypoint installs there); install the override into it, matching
# build-local-api-override.sh. The bind-mounted /workspace/openclaw-tlon is
# not on plugins.load.paths, so overriding there would be a no-op.
PLUGIN_DIR="${PLUGIN_DIR:-/workspace/tlon}"
# Resolved from this script rather than from PLUGIN_DIR: the entrypoint copies
# dev/ into /workspace/tlon and runs it from there, so the digest module travels
# with the script that calls it.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# Build from the in-monorepo package so workspace/hoisted deps resolve
# (@tloncorp/api symlink + @urbit/* at the monorepo root). Compose sets this
# explicitly; the default mirrors it for standalone invocations.
TLON_SKILL_DIR="${TLON_SKILL_DIR:-/workspace/tlon-apps/packages/tlon-skill}"

if [ ! -f "$TLON_SKILL_DIR/package.json" ]; then
  echo "==> No local tlon-skill checkout found at $TLON_SKILL_DIR; using published @tloncorp/tlon-skill"
  exit 0
fi

# Overlay the local checkout onto node_modules/@tloncorp/tlon-skill.
#
# The api override next door is a plain symlink, and this script used to be too.
# A symlink is right for @tloncorp/api — it is consumed by Node's resolver,
# which follows the link to the checkout realpath where the workspace's
# transitive deps (any-ascii et al) are reachable. It is WRONG here, because
# this package is consumed by a second mechanism with the opposite rule.
#
# openclaw.plugin.json declares two of its skills by path INSIDE this package:
#   node_modules/@tloncorp/tlon-skill                 (the `tlon` skill)
#   node_modules/@tloncorp/tlon-skill/skills/surfaces (the `surfaces` skill)
# Core resolves each against the plugin root and then rejects any whose
# REALPATH leaves that root:
#
#   isPathInsideWithRealpath(record.rootDir, candidate, { requireRealpath: true })
#     — openclaw/dist/plugin-skills-*.js, resolvePluginSkillDirs()
#
# With TARGET a symlink to the bind-mounted checkout, both realpaths land at
# /workspace/tlon-apps/packages/tlon-skill — outside /workspace/tlon — so core
# dropped both skills with a `warn`, leaving the model with no `tlon` and no
# `surfaces` skill while every file was demonstrably present on disk. The only
# trace was two log lines per turn:
#
#   [skills] plugin skill path escapes plugin root (tlon): <path>
#
# There is a second, independent check downstream: a skill directory is only
# published if its SKILL.md is a REGULAR FILE (lstat, not stat) whose realpath
# is inside that skill directory (hasPublishableSkillFile()). So a tree of
# symlinks pointing at the checkout would not have helped either.
#
# The shape that satisfies both, without npm link and without a pnpm install:
# rebuild the PUBLISHED package layout as a real directory, copying the content
# the two checks care about, and symlink only `bin` — the one entry that exists
# for binary/module resolution rather than for the model to read.
#
#   real dir   package.json, SKILL.md, references/, skills/   (package.json `files`)
#   symlink    bin -> $TLON_SKILL_DIR/bin
#
# Why `bin` stays a symlink: `bin/tlon.js` finds the compiled CLI at
# join(__dirname, 'tlon'), and Node resolves __dirname through the symlink to
# the checkout — which is exactly where the hydrate/source-build step below
# writes it. Symlinking the directory keeps that chain byte-identical to the
# all-symlink version this replaces, so the CLI resolution is unchanged rather
# than re-argued. It also keeps TLON_SURFACE_TEMPLATES_DIR/TLON_SURFACE_SKILL_DIR
# (which tlon.js derives from the same __dirname) pointed at the LIVE checkout —
# verified by deleting the copied skills/surfaces/templates and watching
# `tlon surface templates` keep listing them out of the checkout — so
# `tlon surface doctrine|primitives|rubric` and the template catalogue are never
# stale, which is what bounds the snapshot below to what the MODEL reads.
# Nothing descends into the 87MB binary behind this link either: TARGET has a
# direct SKILL.md, so core publishes it without walking, and the walker it uses
# when it does expand a directory is configured to skip symlinks.
#
# No node_modules symlink is needed: nothing imports this package as a module
# (package.json declares no main/exports, only `bin`), and the plugin install is
# nodeLinker: hoisted, so anything that did resolve from here would find its
# deps at /workspace/tlon/node_modules anyway.
#
# ┌─ SNAPSHOT WARNING ────────────────────────────────────────────────────────┐
# │ SKILL.md, skills/** and references/** are COPIED, not linked. They are a  │
# │ snapshot taken at container start. Editing them on the host does NOT      │
# │ reach the running container — restart it. A stale copy of doctrine is a   │
# │ silent correctness failure: the model keeps following the old rules and   │
# │ says nothing. (The CLI's own view stays live — see the `bin` note above — │
# │ so `tlon surface doctrine` is not affected; the model's SKILL.md is.)     │
# │ The verification block at the end of this script re-runs core's own       │
# │ predicate so a layout regression fails loudly instead.                    │
# └───────────────────────────────────────────────────────────────────────────┘
#
# See build-local-api-override.sh for the npm-link/pnpm-layout rationale that
# still applies to everything except the symlink-vs-copy choice above.
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
echo "==> Overlaying local @tloncorp/tlon-skill from $TLON_SKILL_DIR -> $TARGET..."
# Keep TARGET literal (no realpath) — see build-local-api-override.sh for why.
# `rm -rf` on a symlink argument removes the link, not its target, so this is
# safe whether TARGET is pnpm's install or a link left by a previous run.
rm -rf "$TARGET"
mkdir -p "$TARGET"

# The copied set is package.json's own `files` list minus the two bin/scripts
# entries: bin/ is symlinked below, and scripts/postinstall.js only runs under
# an npm lifecycle that never fires here. `cp -RL` dereferences: if a source
# entry is itself a symlink, the copy is a regular file, which is what
# hasPublishableSkillFile() requires of SKILL.md.
cp -RL "$TLON_SKILL_DIR/package.json" "$TARGET/package.json"
for entry in SKILL.md skills references; do
  if [ -e "$TLON_SKILL_DIR/$entry" ]; then
    cp -RL "$TLON_SKILL_DIR/$entry" "$TARGET/$entry"
  else
    echo "==> WARN: $TLON_SKILL_DIR/$entry is missing; skills declared under it will not resolve"
  fi
done
ln -s "$TLON_SKILL_DIR/bin" "$TARGET/bin"
echo "==> NOTE: SKILL.md/skills/references are a container-local SNAPSHOT."
echo "==>       Edits to them on the host need a container restart to take effect."

# The `tlon` CLI loader (bin/tlon.js) checks for a local-dev binary at bin/tlon
# first, then falls back to require.resolve("@tloncorp/tlon-skill-${platform}-${arch}").
# Because `bin` above is a symlink, the fallback resolves from the realpath
# ($TLON_SKILL_DIR/bin/) walking up via the local checkout's node_modules — which on a darwin host won't
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

# bun is installed at ~/.bun/bin in the container image and is NOT on the
# default PATH, so `command -v bun` fails under `docker exec` even though bun is
# right there. That is not a hypothetical: it is why the source build silently
# did not happen and a measurement was nearly taken against a stale binary.
if ! command -v bun >/dev/null 2>&1 && [ -x "$HOME/.bun/bin/bun" ]; then
  PATH="$HOME/.bun/bin:$PATH"
  export PATH
fi

# Asking for a source build and not getting one is an ERROR, not a fallback.
# The prebuilt binary is the last release, so it contains none of this branch's
# work — and the old message ("set TLON_SKILL_FROM_SOURCE=1 to rebuild from
# local source") read as though the operator had not asked, when the operator
# had asked and the tool could not comply. Reporting an environment failure as
# an operator choice is the same confusion `gate-harness-unavailable` exists to
# prevent one layer down: say which it is, and refuse rather than substituting
# something that looks like what was requested.
if [ -n "${TLON_SKILL_FROM_SOURCE:-}" ]; then
  if [ ! -f "$TLON_SKILL_DIR/scripts/main.ts" ]; then
    echo "ERROR: TLON_SKILL_FROM_SOURCE is set but $TLON_SKILL_DIR/scripts/main.ts" >&2
    echo "       does not exist, so there is nothing to build from. Refusing to" >&2
    echo "       substitute the prebuilt binary, which does not carry this branch." >&2
    exit 1
  fi
  if ! command -v bun >/dev/null 2>&1; then
    echo "ERROR: TLON_SKILL_FROM_SOURCE is set but bun is not on PATH, so the" >&2
    echo "       source build cannot run. PATH=$PATH" >&2
    echo "       Refusing to substitute the prebuilt binary, which does not carry" >&2
    echo "       this branch's work — a run taken against it would measure the" >&2
    echo "       last release and say nothing about the branch." >&2
    exit 1
  fi
fi

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
  # Stamp what was just compiled, so a later run can tell whether this binary
  # still holds the branch's work. Only this path writes the stamp: the
  # prebuilt path below deletes it, because a stamp claiming a source build
  # that did not happen is worse than no stamp. See dev/tlon-cli-digest.mjs.
  node "$SCRIPT_DIR/tlon-cli-digest.mjs" --write \
    --skill-dir "$TLON_SKILL_DIR" \
    --version "$SKILL_VERSION-src" \
    --target "$BUN_TARGET" \
    --platform-arch "$ARCH_KEY"
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
  # Whatever this branch does, it is not a source build, so any stamp left by an
  # earlier source build now describes a binary that is no longer here. Clear it
  # before the overwrite rather than after, so an interrupted hydrate cannot
  # leave the old certificate standing over the new binary.
  node "$SCRIPT_DIR/tlon-cli-digest.mjs" --skill-dir "$TLON_SKILL_DIR" --clear
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

echo "==> Verifying overlaid @tloncorp/tlon-skill..."
cd "$PLUGIN_DIR"
node --input-type=module -e '
  import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
  import { createRequire } from "node:module";
  import path from "node:path";
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@tloncorp/tlon-skill/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "@tloncorp/tlon-skill") {
    throw new Error(`unexpected package name at ${pkgPath}: ${pkg.name}`);
  }
  const skillMd = pkgPath.replace(/package\.json$/, "SKILL.md");
  if (!existsSync(skillMd)) {
    throw new Error(`overlaid @tloncorp/tlon-skill is missing SKILL.md at ${skillMd}`);
  }

  // Re-run the two predicates openclaw core applies before it will publish a
  // plugin skill, against the manifest this plugin actually ships. Asserting
  // that the files EXIST is worthless here — the bug this guards against is
  // files that exist and are rejected — so both assertions are about realpaths
  // and lstat, exactly as core computes them:
  //   plugin-skills-*.js  resolvePluginSkillDirs()   -> path inside plugin root
  //   plugin-skills-*.js  hasPublishableSkillFile()  -> SKILL.md regular file
  const pluginRoot = process.cwd();
  const rootReal = realpathSync(pluginRoot);
  const manifest = JSON.parse(
    readFileSync(path.join(pluginRoot, "openclaw.plugin.json"), "utf8")
  );
  const declared = Array.isArray(manifest.skills) ? manifest.skills : [];
  if (declared.length === 0) {
    throw new Error(`openclaw.plugin.json declares no skills`);
  }
  const inside = (base, target) => {
    const rel = path.relative(base, target);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };
  const problems = [];
  const published = [];
  const publishable = (dir) => {
    const md = path.join(dir, "SKILL.md");
    let st;
    try {
      st = lstatSync(md);
    } catch {
      return null;
    }
    if (!st.isFile() || st.isSymbolicLink()) {
      problems.push(`SKILL.md is not a regular file: ${md}`);
      return null;
    }
    if (!inside(realpathSync(dir), realpathSync(md))) {
      problems.push(`SKILL.md escapes its skill dir: ${md}`);
      return null;
    }
    const name = /^---\r?\n[\s\S]*?\bname:[ \t]*(\S+)/m.exec(
      readFileSync(md, "utf8")
    )?.[1];
    return name ?? path.basename(dir);
  };
  for (const raw of declared) {
    const candidate = path.resolve(pluginRoot, raw.trim());
    if (!existsSync(candidate)) {
      problems.push(`declared skill path not found: ${candidate}`);
      continue;
    }
    if (!inside(rootReal, realpathSync(candidate))) {
      problems.push(
        `declared skill path escapes plugin root (realpath ${realpathSync(candidate)} not inside ${rootReal}): ${candidate}`
      );
      continue;
    }
    const direct = publishable(candidate);
    if (direct) {
      published.push(direct);
      continue;
    }
    let expanded = 0;
    for (const child of readdirSync(candidate, { withFileTypes: true })) {
      if (!child.isDirectory()) continue; // core skips symlinks when expanding
      const name = publishable(path.join(candidate, child.name));
      if (name) {
        published.push(name);
        expanded += 1;
      }
    }
    if (expanded === 0) {
      problems.push(`declared skill path publishes nothing: ${candidate}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `openclaw would drop plugin skills:\n  - ${problems.join("\n  - ")}`
    );
  }
  console.log(
    `==> Overlaid @tloncorp/tlon-skill verified at ${pkgPath} (version ${pkg.version})`
  );
  console.log(`==> Plugin skills core will publish: ${published.join(", ")}`);
'

echo "==> Local tlon-skill override applied to $PLUGIN_DIR"
