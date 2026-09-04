#!/usr/bin/env node
/**
 * The CLI build stamp: assert that the compiled `tlon` binary the bot invokes
 * was built from the sources this worktree holds.
 *
 * ## The failure this exists for
 *
 * D135 caught a fence assertion passing against a binary built before the fence
 * existed, and the remedy — exercise the fence through the container's own CLI —
 * fixed that one assertion. It did not fix the shape. The CLI the bot invokes is
 * a `bun --compile` binary at `$TLON_SKILL_DIR/bin/tlon`, compiled at BUILD time
 * from `scripts/**`; every source edit after that build is invisible to it. A
 * measurement run taken on a stale binary measures code the repo no longer
 * holds, and nothing says so.
 *
 * `assertFenced` cannot catch this and never could: the write fence already
 * existed when today's binary was built, so a stale binary passes all three of
 * its probes. That guard answers "does this CLI have a fence"; this one answers
 * "is this CLI the code we are about to measure". Different questions.
 *
 * This is the same instrument/actor scope hole D135 named, one level up, and it
 * gets the same remedy the desk has had since `surfaces-desk-preflight.mjs`:
 * digest the sources, compare against what was deployed, refuse by name.
 *
 * ## What it digests, and what it deliberately does not
 *
 * A digest is a claim about what is compiled in. Every inclusion and every
 * exclusion below is a claim about `bun build scripts/main.ts --compile`, so
 * each is stated with the reason it holds:
 *
 * - **`scripts/**\/*.ts`, excluding `*.test.ts`** — the compiled sources. The
 *   exclusion is not an assumption: the import closure of `scripts/main.ts`
 *   (static `import`/`export … from`, dynamic `import()`, `require()`) is 61
 *   files, all of them under `scripts/`, and NONE of them is a `*.test.ts`.
 *   Nothing reachable from the entrypoint imports a test file, so a test edit
 *   cannot change the binary and must not demand a rebuild.
 * - **`package.json`** — its `version` is stamped into the binary through
 *   `--define __VERSION__`, so it is compiled in as surely as any statement.
 * - **NOT `skills/**`** — templates, `SKILL.md`, `PRIMITIVES.md`, `RUBRIC.md`
 *   and the template catalogue are read from `TLON_SKILL_DIR` at RUNTIME, as
 *   data (`build-local-skill-override.sh` keeps `bin` a symlink precisely so
 *   this view stays live). They are not compiled in. Digesting them would make
 *   every template edit — the most common edit in this project — demand a
 *   rebuild that changes nothing, and a guard that cries wolf gets disabled.
 * - **NOT `bunfig.toml`** — its only stanza is `[test] preload`, which `bun
 *   test` reads and `bun build` does not.
 * - **Contents, not mtimes.** mtime is not a discriminator: a checkout writes
 *   today's timestamp onto last week's bytes, and a restored file writes an old
 *   timestamp onto a change. Only the bytes discriminate.
 *
 * Known over-approximation, stated rather than hidden: eleven non-test `.ts`
 * files under `scripts/` are release/build tooling and test doubles
 * (`release-*.ts`, `build-smoke.ts`, `cli-test-matrix.ts`,
 * `surface-*-fixtures.ts`, `surface-test-doubles.ts`, `tloncorp-api-mock.ts`,
 * `surface-comparison-convention.ts`) that the entrypoint does not reach. They
 * are digested anyway. The glob is preferred to an import-closure walk because
 * the two failure modes are not symmetric — an over-broad set costs a rebuild
 * nobody needed, an under-broad set is a blind spot of exactly the kind this
 * file exists to close, and a resolver that misses one dynamic edge produces
 * the second silently.
 *
 * ## Why the sidecar carries the binary's own hash
 *
 * A build stamp is a certificate, and a certificate can outlive its artifact.
 * `build-local-skill-override.sh` has a second path — hydrating the prebuilt npm
 * binary — that overwrites `bin/tlon` without compiling anything. That path
 * deletes the sidecar, but deletion is a thing that can be forgotten, so the
 * sidecar also records the sha256 of the binary it was written for and the
 * check re-hashes the binary on disk. A stamp describing a binary that is no
 * longer there is `binary-moved`, not a pass.
 *
 * ## Usage
 *
 *   node dev/tlon-cli-digest.mjs --skill-dir <dir>            # check, human
 *   node dev/tlon-cli-digest.mjs --skill-dir <dir> --json
 *   node dev/tlon-cli-digest.mjs --skill-dir <dir> --write \
 *        --version 0.5.0-src --target bun-linux-arm64 --platform-arch linux-arm64
 *
 * Exit codes:
 *   0  the binary was built from these sources
 *   1  it was not — the differing files are named
 *   2  the check could not run (no skill dir, no binary, unreadable sidecar)
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Written next to the binary it describes, by the source-build path only. */
export const SIDECAR_NAME = 'tlon.build.json';
export const SCHEMA = 'tlon-cli-build/1';

/** Human-readable statement of the rule, carried in the sidecar. */
export const SOURCE_RULE =
  'scripts/**/*.ts (excluding *.test.ts) + package.json';

/** Directories that never hold compiled sources. */
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist']);

const posix = (path) => path.split(sep).join('/');

/**
 * Every file the binary is compiled from, by skill-dir-relative path, hashed.
 *
 * The set is the header's rule and nothing else. `.DS_Store` and the skipped
 * directories are dropped for the same reason `digestTree` drops them in the
 * desk preflight: they carry no compiled behaviour, so their presence on one
 * side is not drift.
 */
export function collectSourceFiles(skillDir) {
  const files = new Map();
  const add = (absolute) => {
    files.set(
      posix(relative(skillDir, absolute)),
      createHash('sha256').update(readFileSync(absolute)).digest('hex')
    );
  };

  const scripts = join(skillDir, 'scripts');
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts')) continue;
      add(path);
    }
  };
  if (existsSync(scripts) && statSync(scripts).isDirectory()) walk(scripts);

  const pkg = join(skillDir, 'package.json');
  if (existsSync(pkg)) add(pkg);

  return files;
}

/** One value standing for the whole compiled source set. */
export function sourceDigest(files) {
  const hash = createHash('sha256');
  for (const path of [...files.keys()].sort()) {
    hash.update(`${path}\0${files.get(path)}\0`);
  }
  return hash.digest('hex');
}

/** What differs between the sources a build recorded and the sources on disk. */
export function compareSources(recorded, actual) {
  const added = [];
  const removed = [];
  const changed = [];
  for (const [path, hash] of actual) {
    if (!recorded.has(path)) added.push(path);
    else if (recorded.get(path) !== hash) changed.push(path);
  }
  for (const path of recorded.keys()) {
    if (!actual.has(path)) removed.push(path);
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    ok: added.length === 0 && removed.length === 0 && changed.length === 0,
  };
}

export const sidecarPath = (skillDir) => join(skillDir, 'bin', SIDECAR_NAME);
export const binaryPath = (skillDir) => join(skillDir, 'bin', 'tlon');

export function readBuildSidecar(skillDir) {
  const path = sidecarPath(skillDir);
  if (!existsSync(path)) return { path, sidecar: null, error: null };
  try {
    return {
      path,
      sidecar: JSON.parse(readFileSync(path, 'utf8')),
      error: null,
    };
  } catch (error) {
    return { path, sidecar: null, error: error.message };
  }
}

export function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Write the stamp for a build that has just landed at `bin/tlon`.
 *
 * Only ever called on the source-build path. A sidecar written by the prebuilt
 * path would be a certificate for a build that never happened, which is worse
 * than no certificate at all — the prebuilt path deletes this file instead.
 */
export function writeBuildSidecar({
  skillDir,
  version,
  target,
  platformArch,
  binary = binaryPath(skillDir),
  now = new Date(),
}) {
  const files = collectSourceFiles(skillDir);
  const sidecar = {
    schema: SCHEMA,
    builtBy: 'dev/build-local-skill-override.sh',
    builtAt: now.toISOString(),
    version,
    target,
    platformArch,
    binary: { sha256: hashFile(binary), bytes: statSync(binary).size },
    sources: {
      rule: SOURCE_RULE,
      digest: sourceDigest(files),
      fileCount: files.size,
      files: Object.fromEntries([...files.entries()].sort()),
    },
  };
  writeFileSync(sidecarPath(skillDir), `${JSON.stringify(sidecar, null, 2)}\n`);
  return sidecar;
}

/** Remove a stamp that no longer describes the binary on disk. */
export function clearBuildSidecar(skillDir) {
  const path = sidecarPath(skillDir);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

const REBUILD =
  'Rebuild it: TLON_SKILL_FROM_SOURCE=1 dev/build-local-skill-override.sh ' +
  '(inside the container, or bring the stack up with TLON_SKILL_FROM_SOURCE=1 set).';

/**
 * Whether the binary at `<skillDir>/bin/tlon` was compiled from the sources
 * currently in `<skillDir>`.
 *
 * `observedBinarySha256` is the hash of the binary as the CALLER sees it. The
 * preflight passes the hash taken inside the container, which is the path the
 * bot actually invokes — the sidecar is a host file, so a match also proves the
 * two views are the same file rather than assuming the bind mount. Omit it and
 * the binary is hashed here instead.
 */
export function checkCliCurrent({ skillDir, observedBinarySha256 = null }) {
  const notes = [];
  const failures = [];
  const actual = collectSourceFiles(skillDir);
  const digest = sourceDigest(actual);
  notes.push(
    `sources: ${actual.size} files, digest ${digest.slice(0, 12)} (${SOURCE_RULE})`
  );

  // package.json alone is not a source tree: a digest over one file would
  // certify a checkout that holds no compiled code at all.
  if (![...actual.keys()].some((path) => path.startsWith('scripts/'))) {
    failures.push(
      `no compiled sources found under ${skillDir}/scripts. This is not a tlon-skill checkout, ` +
        'so nothing here can say whether the CLI is current.'
    );
    return { ok: false, status: 'no-sources', digest, notes, failures };
  }

  const binary = binaryPath(skillDir);
  if (!existsSync(binary)) {
    failures.push(
      `there is no CLI at ${binary} for the bot to invoke. ${REBUILD}`
    );
    return { ok: false, status: 'no-binary', digest, notes, failures };
  }
  const binarySha256 = observedBinarySha256 ?? hashFile(binary);
  notes.push(`binary: ${binary} sha256 ${binarySha256.slice(0, 12)}`);

  const { path, sidecar, error } = readBuildSidecar(skillDir);
  if (error) {
    failures.push(
      `${path} is not readable JSON (${error}), so the CLI's provenance is unknown. ${REBUILD}`
    );
    return { ok: false, status: 'unreadable-sidecar', digest, notes, failures };
  }
  if (!sidecar) {
    failures.push(
      `${path} is missing, so nothing records what this CLI was built from. Either it is the ` +
        'prebuilt npm binary, which does not contain work from this branch, or it was built ' +
        `before the build started stamping. ${REBUILD}`
    );
    return { ok: false, status: 'no-sidecar', digest, notes, failures };
  }
  if (sidecar.schema !== SCHEMA) {
    failures.push(
      `${path} carries schema ${JSON.stringify(sidecar.schema)}, not ${SCHEMA}. ${REBUILD}`
    );
    return { ok: false, status: 'unknown-schema', digest, notes, failures };
  }
  notes.push(
    `stamp: ${sidecar.version} ${sidecar.target} built ${sidecar.builtAt}`
  );

  // The certificate before the claim: a stamp for some other binary tells you
  // nothing about this one, however well its source digest matches.
  if (sidecar.binary?.sha256 !== binarySha256) {
    failures.push(
      `${path} describes a binary with sha256 ${String(sidecar.binary?.sha256).slice(0, 12)}, but the ` +
        `CLI on disk hashes to ${binarySha256.slice(0, 12)}. Something replaced bin/tlon after the ` +
        `build that wrote this stamp — most likely the prebuilt-npm hydrate path. ${REBUILD}`
    );
    return { ok: false, status: 'binary-moved', digest, notes, failures };
  }

  const recorded = new Map(Object.entries(sidecar.sources?.files ?? {}));
  const comparison = compareSources(recorded, actual);
  if (!comparison.ok) {
    const name = (label, list) =>
      list.length === 0
        ? null
        : `${list.length} ${label}: ${list.slice(0, 8).join(', ')}${
            list.length > 8 ? `, … and ${list.length - 8} more` : ''
          }`;
    const parts = [
      name('edited since the build', comparison.changed),
      name('added since the build', comparison.added),
      name('deleted since the build', comparison.removed),
    ].filter(Boolean);
    failures.push(
      `the CLI the bot invokes was compiled from different sources than this worktree holds — ` +
        `${parts.join('; ')}. A run taken now would measure code that is not on this branch. ${REBUILD}`
    );
    return {
      ok: false,
      status: 'sources-moved',
      digest,
      comparison,
      notes,
      failures,
    };
  }

  // Belt and braces: the file list matching implies the digest matches, but the
  // digest is the value the stamp actually asserts, so assert it too.
  if (sidecar.sources?.digest !== digest) {
    failures.push(
      `${path} records source digest ${String(sidecar.sources?.digest).slice(0, 12)} while these ` +
        `same files digest to ${digest.slice(0, 12)}. The stamp is internally inconsistent. ${REBUILD}`
    );
    return {
      ok: false,
      status: 'digest-inconsistent',
      digest,
      notes,
      failures,
    };
  }

  notes.push(
    `every one of the ${actual.size} compiled sources matches the build stamp`
  );
  return { ok: true, status: 'current', digest, comparison, notes, failures };
}

function die(message) {
  process.stderr.write(`CLI BUILD STAMP COULD NOT RUN: ${message}\n`);
  process.exit(2);
}

function main(argv) {
  const at = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const skillDirArg = at('--skill-dir');
  if (!skillDirArg) die('--skill-dir <dir> is required');
  const skillDir = resolve(skillDirArg);
  if (!existsSync(join(skillDir, 'package.json'))) {
    die(`${skillDir} has no package.json — that is not a tlon-skill checkout`);
  }

  if (argv.includes('--clear')) {
    const removed = clearBuildSidecar(skillDir);
    console.log(
      removed
        ? `==> Removed stale build stamp ${sidecarPath(skillDir)}`
        : `==> No build stamp to remove at ${sidecarPath(skillDir)}`
    );
    return 0;
  }

  if (argv.includes('--write')) {
    const binary = binaryPath(skillDir);
    if (!existsSync(binary)) die(`no binary to stamp at ${binary}`);
    const sidecar = writeBuildSidecar({
      skillDir,
      version: at('--version') ?? 'unknown',
      target: at('--target') ?? 'unknown',
      platformArch: at('--platform-arch') ?? 'unknown',
    });
    console.log(
      `==> Stamped ${sidecarPath(skillDir)}: ${sidecar.sources.fileCount} sources, ` +
        `digest ${sidecar.sources.digest.slice(0, 12)}, binary ${sidecar.binary.sha256.slice(0, 12)}`
    );
    return 0;
  }

  const report = checkCliCurrent({ skillDir });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `CLI BUILD STAMP — ${skillDir} ${report.ok ? 'CURRENT' : 'STALE'} (${report.status})`
    );
    for (const note of report.notes) console.log(`    note: ${note}`);
    for (const failure of report.failures) console.log(`    FAIL: ${failure}`);
  }
  return report.ok ? 0 : 1;
}

// Importable for the unit tests without running the IO half.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main(process.argv.slice(2)));
}
