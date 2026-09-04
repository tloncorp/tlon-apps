#!/usr/bin/env node
/**
 * The desk preflight: assert that the fakeships are running THIS branch's
 * `%groups` desk before anything live is measured against them.
 *
 * ## The failure this exists for
 *
 * "The publish pipeline is proven end to end on fakeships via the CLI" was true
 * when it was written and quietly stopped being true. A develop merge added
 * `mar/group/action-5.hoon` and flipped `groupsApi.ts` to poke that mark in the
 * same commit; the running ships had been booted weeks earlier and nobody
 * re-synced them. Every symptom pointed at the client. Nothing in the loop, the
 * harness or CI could see that the ship was compiling a different desk from the
 * one the repo held, because nothing ever compared them.
 *
 * A claim with a shelf life is a claim that needs a check. This is the check.
 *
 * ## What it compares
 *
 * The branch's desk, assembled the way `deploy.sh` and rube assemble it
 * (`scripts/assemble-desk.sh`: vendored `desk-deps/` underneath, `desk/` on
 * top), against each running ship's MOUNTED `%groups` desk, file by file, by
 * content hash. Any file present on one side and not the other, or differing in
 * a single byte, is a failure naming the file.
 *
 * Two paths are excluded from that comparison, and the list is deliberately
 * this short — an exclusion is a place the check stops looking, so each one is
 * named here with the reason it carries no compiled behaviour:
 *
 * - **`commit.txt`** is a git stamp `assemble-desk.sh` writes from
 *   `git rev-parse --short HEAD`. It changes on every commit to any part of the
 *   repo, so comparing it byte-wise would make this preflight fail constantly
 *   and therefore be ignored. `%groups` does compile it in (`/* commit %txt`),
 *   but only into a `~|` trace annotation. It is not ignored: the stamp is
 *   checked for ANCESTRY instead, which catches the thing a stamp can actually
 *   tell you — a ship synced from some other branch.
 * - **`desk.docket-0`** carries the released frontend glob hash. In this
 *   workflow the client is served by the vite dev server and the glob is never
 *   fetched, so a stale one changes nothing that is measured. Reported, not
 *   failed.
 *
 * ## Why the mount is not the whole answer
 *
 * The mounted directory is what clay wrote out, but it is also what anyone
 * rsynced in. `rsync` without a following `|commit` leaves the mount matching
 * the branch while clay still holds the old desk — the check would pass and the
 * ship would still be stale, which is the original failure with an extra step.
 *
 * There is no way to read a clay file back over eyre, so the second half is a
 * ledger: `--record` writes down the ship's live `%groups` desk hash (from
 * `hood/kiln/pikes.json`) alongside the content digest that was verified at the
 * time, and every later run requires both to still match. A commit the operator
 * did not record shows up as a changed pike hash; a sync the operator did not
 * commit shows up as a content digest with no ledger entry. Neither can pass
 * silently.
 *
 * The ledger is per-machine and gitignored: pike hashes are takos, which
 * include the commit's parents and timestamp, so they are not comparable across
 * ships or across boots and there is nothing to share.
 *
 * ## Usage
 *
 *   node dev/surfaces-desk-preflight.mjs                # check zod and ten
 *   node dev/surfaces-desk-preflight.mjs --ship zod
 *   node dev/surfaces-desk-preflight.mjs --record       # after a sync + |commit
 *   node dev/surfaces-desk-preflight.mjs --pier zod=/some/other/pier/zod
 *   node dev/surfaces-desk-preflight.mjs --json
 *
 * Exit codes:
 *   0  every checked ship is running this branch's desk, and clay holds it
 *   1  a ship is stale — the differing files are named
 *   2  the preflight could not run (no desk-deps, unreachable ship, no cookie)
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(DEV_DIR, '..', '..', '..');
const LEDGER = join(DEV_DIR, '.desk-sync-ledger.json');
const DESK = 'groups';

/** Paths whose drift carries no compiled behaviour. See the header. */
export const EXCLUDED_PATHS = new Set(['commit.txt', 'desk.docket-0']);

/** Where a rube fakeship's pier lives, and how to reach it. */
const SHIPS = {
  zod: {
    pier: join(REPO_ROOT, 'apps', 'tlon-web', 'rube', 'dist', 'zod', 'zod'),
    cache: 'zod.json',
  },
  ten: {
    pier: join(REPO_ROOT, 'apps', 'tlon-web', 'rube', 'dist', 'ten', 'ten'),
    cache: 'ten.json',
  },
};

function die(message, code = 2) {
  process.stderr.write(`DESK PREFLIGHT COULD NOT RUN: ${message}\n`);
  process.exit(code);
}

/**
 * Every file under `root`, by repo-relative path, hashed.
 *
 * `.DS_Store` is skipped for the same reason `assemble-desk.sh` excludes it:
 * Finder droppings have no clay mark and never reach a desk, so their presence
 * on one side is not drift.
 */
export function digestTree(root) {
  const files = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.name === '.git') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      files.set(
        relative(root, path),
        createHash('sha256').update(readFileSync(path)).digest('hex')
      );
    }
  };
  walk(root);
  return files;
}

/** What differs, ignoring the two paths the header explains. */
export function compareTrees(branch, ship) {
  const missing = [];
  const extra = [];
  const changed = [];
  for (const [path, hash] of branch) {
    if (EXCLUDED_PATHS.has(path)) continue;
    if (!ship.has(path)) missing.push(path);
    else if (ship.get(path) !== hash) changed.push(path);
  }
  for (const path of ship.keys()) {
    if (EXCLUDED_PATHS.has(path)) continue;
    if (!branch.has(path)) extra.push(path);
  }
  return {
    missing: missing.sort(),
    extra: extra.sort(),
    changed: changed.sort(),
    ok: missing.length === 0 && extra.length === 0 && changed.length === 0,
  };
}

/** One value standing for the whole assembled tree, for the ledger. */
export function contentDigest(files) {
  const hash = createHash('sha256');
  for (const path of [...files.keys()].sort()) {
    if (EXCLUDED_PATHS.has(path)) continue;
    hash.update(`${path}\0${files.get(path)}\0`);
  }
  return hash.digest('hex');
}

function assembleBranchDesk() {
  if (!existsSync(join(REPO_ROOT, 'desk-deps'))) {
    die(
      'desk-deps/ is not populated — run ./scripts/sync-deps.sh (peru sync) first. ' +
        'Without the vendored upstream the assembled desk is not the desk a ship runs.'
    );
  }
  const target = mkdtempSync(join(tmpdir(), 'surfaces-desk-'));
  try {
    execFileSync(join(REPO_ROOT, 'scripts', 'assemble-desk.sh'), [target], {
      cwd: REPO_ROOT,
      env: { ...process.env, SKIP_SYNC: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    const shell = error;
    die(
      `scripts/assemble-desk.sh failed: ${(shell.stderr ?? '').toString().trim()}`
    );
  }
  return target;
}

async function readPikeHash(ship) {
  const cachePath = join(
    process.env.HOME ?? '',
    '.tlon',
    'cache',
    SHIPS[ship].cache
  );
  let cached;
  try {
    cached = JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch {
    die(
      `no cached credential for ~${ship} at ${cachePath}. The live desk hash is read over eyre, ` +
        `so the ship has to be reachable and authenticated — run any \`tlon\` command against it first.`
    );
  }
  let response;
  try {
    response = await fetch(`${cached.url}/~/scry/hood/kiln/pikes.json`, {
      headers: { Cookie: cached.cookie, Accept: 'application/json' },
    });
  } catch (error) {
    die(`~${ship} at ${cached.url} is unreachable: ${error.message}`);
  }
  if (!response.ok) {
    die(
      `~${ship} answered ${response.status} for kiln/pikes.json. A 403 means the cached cookie has expired; ` +
        `run any \`tlon\` command against ~${ship} to refresh it.`
    );
  }
  const pikes = await response.json();
  const pike = pikes?.[DESK];
  if (!pike || typeof pike.hash !== 'string') {
    die(`~${ship} reports no %${DESK} desk in kiln/pikes.json.`);
  }
  return pike.hash;
}

/**
 * Whether the ship's build stamp names a commit this branch descends from.
 *
 * The stamp is excluded from the byte comparison because it moves on every
 * commit to anything. Ancestry is the part of it that means something: a stamp
 * that is not an ancestor of HEAD is a ship built from some other branch, and
 * every file matching is then a coincidence of two branches agreeing rather
 * than evidence about this one.
 */
export function stampStatus(stamp) {
  const commit = (stamp ?? '').trim();
  if (!/^[0-9a-f]{7,40}$/.test(commit)) {
    return { commit, status: 'unreadable' };
  }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return { commit, status: 'ancestor' };
  } catch {
    try {
      execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
      });
      return { commit, status: 'off-branch' };
    } catch {
      return { commit, status: 'unknown-commit' };
    }
  }
}

function readLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const record = argv.includes('--record');
  const at = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const ships = (at('--ship') ?? 'zod,ten')
    .split(',')
    .map((name) => name.trim().replace(/^~/, ''))
    .filter(Boolean);
  const pierOverrides = new Map();
  for (const [i, arg] of argv.entries()) {
    if (arg !== '--pier') continue;
    const [name, path] = (argv[i + 1] ?? '').split('=');
    if (!name || !path) die('--pier takes <ship>=<pier-path>');
    pierOverrides.set(name.replace(/^~/, ''), resolve(path));
  }

  for (const ship of ships) {
    if (!SHIPS[ship] && !pierOverrides.has(ship)) {
      die(
        `no pier known for ~${ship}. Known: ${Object.keys(SHIPS).join(', ')}. Pass --pier ${ship}=<path>.`
      );
    }
  }

  const target = assembleBranchDesk();
  let branch;
  try {
    branch = digestTree(target);
  } finally {
    // The digest is all that is wanted; the tree itself is not an artifact.
    rmSync(target, { recursive: true, force: true });
  }
  const digest = contentDigest(branch);

  const ledger = readLedger();
  const results = [];
  for (const ship of ships) {
    const pier = pierOverrides.get(ship) ?? SHIPS[ship].pier;
    const mount = join(pier, DESK);
    if (!existsSync(mount) || !statSync(mount).isDirectory()) {
      die(
        `~${ship} has no mounted %${DESK} desk at ${mount}. Mount it on the ship (\`|mount %${DESK}\`) — ` +
          `an unmounted desk cannot be compared against anything.`
      );
    }
    const shipFiles = digestTree(mount);
    const comparison = compareTrees(branch, shipFiles);
    const stamp = stampStatus(
      shipFiles.has('commit.txt')
        ? readFileSync(join(mount, 'commit.txt'), 'utf8')
        : ''
    );
    const pikeHash = await readPikeHash(ship);
    const recorded = ledger[ship] ?? null;

    // Clay: the mount can match the branch while clay still holds the old desk,
    // so a matching tree is necessary and not sufficient. See the header.
    let clay;
    if (record) {
      clay = { status: 'recorded', pikeHash, recordedDigest: digest };
    } else if (!recorded) {
      clay = { status: 'unrecorded', pikeHash, recordedDigest: null };
    } else if (recorded.contentDigest !== digest) {
      clay = {
        status: 'digest-moved',
        pikeHash,
        recordedDigest: recorded.contentDigest,
      };
    } else if (recorded.pikeHash !== pikeHash) {
      clay = {
        status: 'pike-moved',
        pikeHash,
        recordedDigest: recorded.contentDigest,
      };
    } else {
      clay = {
        status: 'verified',
        pikeHash,
        recordedDigest: recorded.contentDigest,
      };
    }

    results.push({
      ship,
      pier,
      mount,
      comparison,
      stamp,
      clay,
      docket:
        branch.get('desk.docket-0') === shipFiles.get('desk.docket-0')
          ? 'same'
          : 'differs',
      ok:
        comparison.ok &&
        stamp.status === 'ancestor' &&
        (record || clay.status === 'verified'),
    });
  }

  if (record) {
    const next = { ...ledger };
    for (const result of results) {
      if (!result.comparison.ok) continue;
      next[result.ship] = {
        contentDigest: digest,
        pikeHash: result.clay.pikeHash,
        recordedAt: new Date().toISOString(),
        branchHead: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
        }).trim(),
      };
    }
    writeFileSync(LEDGER, `${JSON.stringify(next, null, 2)}\n`);
  }

  const ok = results.every((result) => result.ok);
  if (asJson) {
    console.log(
      JSON.stringify({ ok, contentDigest: digest, results }, null, 2)
    );
  } else {
    console.log(
      `DESK PREFLIGHT — branch %${DESK} digest ${digest.slice(0, 12)}`
    );
    for (const result of results) {
      console.log('');
      console.log(`  ~${result.ship}  ${result.ok ? 'CURRENT' : 'STALE'}`);
      console.log(`    mount: ${result.mount}`);
      const { missing, extra, changed } = result.comparison;
      if (result.comparison.ok) {
        console.log(
          `    every one of the ${branch.size} desk files matches this branch`
        );
      } else {
        for (const [label, list] of [
          ['on this branch but NOT on the ship', missing],
          ['on the ship but NOT on this branch', extra],
          ['present on both and DIFFERENT', changed],
        ]) {
          if (list.length === 0) continue;
          console.log(`    ${list.length} ${label}:`);
          for (const path of list.slice(0, 12)) console.log(`        ${path}`);
          if (list.length > 12)
            console.log(`        … and ${list.length - 12} more`);
        }
      }
      console.log(
        `    build stamp: ${result.stamp.commit || '(none)'} — ${result.stamp.status}`
      );
      console.log(`    frontend glob: ${result.docket} (not served in dev)`);
      console.log(
        `    clay: ${result.clay.status} (pike ${result.clay.pikeHash.slice(0, 14)}…)`
      );
    }
    console.log('');
    if (!ok) {
      console.log(
        'To fix: ./scripts/assemble-desk.sh <target>, rsync -a --delete <target>/ <pier>/groups/,'
      );
      console.log(
        '        |commit %groups on the ship, then re-run this with --record.'
      );
    }
  }
  process.exit(ok ? 0 : 1);
}

// Importable for the unit tests without running the IO half.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => die(error?.stack ?? String(error)));
}
