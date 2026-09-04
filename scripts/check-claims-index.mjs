/**
 * Guard the claims index against the failure it exists to catch.
 *
 * THE FAILURE THIS EXISTS FOR. `surface-channels-claims-index.md` pairs every
 * outward claim the Surface Channels project makes with the control that would
 * fail if the claim stopped being true. Its first revision named a DIRTY
 * working tree as its subject, said so in its own header — "Nothing here is
 * verified against any commit" — and then carried several hundred `file:line`
 * citations measured against a tree nobody else could reconstruct. An index
 * that cannot say which tree it describes is a claim, not evidence, which is
 * the exact failure mode the index was written to catch. It caught it in
 * everyone else's documents and not in its own.
 *
 * Four checks, because the document can go stale in four independent ways:
 *
 *   1. ANCHORS — every `path/to/file.ts:NNN` citation resolves: the file
 *      exists and has at least that many lines. A citation that points past
 *      the end of a file is the ordinary way this document rots, because code
 *      moves and prose does not.
 *   2. CITED TESTS — where a row names a test by its title next to a file, the
 *      file still contains that title. Deliberately conservative; see below.
 *   3. HEAD — the header records a real commit, and no SURFACE file the index
 *      cites has moved between that commit and HEAD. The exact-tree claim
 *      cannot be a repo-wide gate: the index cites `DECISIONS.md`,
 *      `.github/workflows/ci.yml` and other files that change on work with no
 *      connection to Surface Channels, so enforced everywhere it would turn
 *      most of the repo's pull requests red until somebody regenerated a
 *      document they do not own. The ownership split keeps the hard failure
 *      where the claims are load-bearing and where the person moving the file
 *      is the person who owns the index; drift anywhere else is reported and
 *      the run stays green. The owned set is listed at the check.
 *   4. NO DIRTY-TREE DISCLAIMER — the header does not say it was measured
 *      against a working tree. Naming a commit is the whole point.
 *
 * Deliberately dependency-free and run from `ci-config-check`, the one CI job
 * with no path filter — the index is a stray root markdown that matches no
 * filter, so a gated job would be skipped exactly when this is needed. Same
 * reasoning as `check-decisions-record.mjs` and `check-ci-path-filters.mjs`,
 * which are the precedent for this shape.
 *
 * Run: node scripts/check-claims-index.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'surface-channels-claims-index.md';
const indexPath = resolve(repoRoot, INDEX);

const failures = [];

if (!existsSync(indexPath)) {
  // Not a failure: the index is a working document for one project and may not
  // exist on every branch. Say so rather than failing a branch that never had
  // one, and say it loudly enough that a DELETED index is visible in the log.
  console.log(
    `note: ${INDEX} is not present on this branch; nothing to check.`
  );
  process.exit(0);
}

const text = readFileSync(indexPath, 'utf8');

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ---------------------------------------------------------------------------
// citation extraction
// ---------------------------------------------------------------------------

/**
 * Citations appear inside backticks, inside prose, and inside table cells, so
 * this scans the whole document rather than trying to parse markdown. The
 * lookbehind and lookahead are what keep the glob spellings the document also
 * uses — `dev/*.test.mjs`, `{sandbox,navigation}.spec.ts`,
 * `use{Browser,Desktop}Notifications.test.ts` — from being read as filenames:
 * a citation may not begin immediately after `*`, `,`, `{`, `}` or `.`.
 *
 * Extensions are ordered longest-first on purpose. `ts` before `tsx` would
 * match `SurfaceSandboxHost.native.ts` out of `…native.tsx`, and `js` before
 * `json` would turn every `package.json` into a nonexistent `package.js`.
 */
const CITATION =
  /(?<![A-Za-z0-9_@/,{}*.~-])((?:\.\/)?[A-Za-z0-9_@][A-Za-z0-9_.@-]*(?:\/[A-Za-z0-9_.@-]+)*\.(?:tsx|ts|mjs|cjs|jsx|js|json|yaml|yml|hoon|css|html|md))(?::(\d+(?:\s*[-,]\s*\d+)*))?(?![A-Za-z0-9_-])/g;

const tracked = git(['ls-files']).split('\n').filter(Boolean);
const trackedSet = new Set(tracked);

/** `cited path` -> the set of `:NNN` specs the document attaches to it. */
const citations = new Map();
for (const match of text.matchAll(CITATION)) {
  const cited = match[1].replace(/^\.\//, '');
  if (!citations.has(cited)) citations.set(cited, new Set());
  if (match[2]) citations.get(cited).add(match[2]);
}

/** Build output is not tracked and this CI job does not build; skip it. */
const isBuildOutput = (cited) => /(^|\/)dist\//.test(cited);

function candidatesFor(cited) {
  if (trackedSet.has(cited)) return [cited];
  const suffix = tracked.filter((path) => path.endsWith(`/${cited}`));
  if (suffix.length > 0) return suffix;
  // A file added in the same change as the row that cites it is not in
  // `git ls-files` yet. Resolve it off disk so the index can cite a guard it
  // ships with. The head check below cannot compare such a file across
  // commits — there is no commit that has it — which is one more reason the
  // index is stamped after the change lands, not during it.
  const onDisk = resolve(repoRoot, cited);
  return existsSync(onDisk) && statSync(onDisk).isFile() ? [cited] : [];
}

const cited = [...citations.keys()].filter((c) => !isBuildOutput(c));
const skippedBuildOutput = [...citations.keys()].filter(isBuildOutput);

/**
 * Resolution runs in two passes because the document writes a file two ways.
 *
 * A citation carrying enough path to be unique — `scripts/surface-lint.ts`,
 * `packages/api/src/client/surface/schemas.ts` — resolves on its own, and
 * every such citation counts as the document DECLARING that file. A bare
 * basename then resolves either because nothing else in the tree shares it, or
 * because exactly one of the files that do share it was declared that way.
 *
 * The remaining case — a bare basename matching several tracked files, none of
 * them declared — is a failure rather than a silent skip. `surface-lint.ts`
 * exists twice under `packages/tlon-skill/scripts/`, and a row citing a line
 * number in "the one you meant" is not evidence a reader can follow either.
 */
const resolved = new Map(); // cited -> repo-relative path
const declared = new Set(); // tracked paths the document spells out
const ambiguous = [];

for (const path of cited.filter((c) => c.includes('/'))) {
  const candidates = candidatesFor(path);
  if (candidates.length === 1) {
    resolved.set(path, candidates[0]);
    declared.add(candidates[0]);
  } else if (candidates.length === 0) {
    failures.push(
      `\`${path}\` does not exist. A citation to a file that is not in the ` +
        `tree is a dead anchor: the control it names has been moved, renamed ` +
        `or deleted, and the row still claims it.`
    );
  } else {
    ambiguous.push([path, candidates]);
  }
}

for (const name of cited.filter((c) => !c.includes('/'))) {
  const candidates = candidatesFor(name);
  if (candidates.length === 1) {
    resolved.set(name, candidates[0]);
  } else if (candidates.length === 0) {
    failures.push(
      `\`${name}\` does not exist. A citation to a file that is not in the ` +
        `tree is a dead anchor: the control it names has been moved, renamed ` +
        `or deleted, and the row still claims it.`
    );
  } else {
    const named = candidates.filter((c) => declared.has(c));
    if (named.length === 1) resolved.set(name, named[0]);
    else ambiguous.push([name, candidates]);
  }
}

for (const [name, candidates] of ambiguous) {
  failures.push(
    `\`${name}\` is ambiguous: ${candidates.length} tracked files share that ` +
      `name (${candidates.join(', ')}). Write enough of the path to name one ` +
      `of them, at least once in the document.`
  );
}

// A path can be in `git ls-files` and gone from disk — a deleted test that has
// not been committed yet is exactly that, and it is the case this whole arm is
// for. Check the file is really there before reading it, or the guard crashes
// on the failure it exists to report.
for (const [name, path] of [...resolved]) {
  if (!existsSync(resolve(repoRoot, path))) {
    resolved.delete(name);
    failures.push(
      `\`${name}\` is tracked as ${path} but is not on disk. A cited control ` +
        `that has been deleted is the row's claim going uncontrolled without ` +
        `the row saying so.`
    );
  }
}

for (const [name, path] of resolved) {
  const lineCount = readFileSync(resolve(repoRoot, path), 'utf8').split(
    '\n'
  ).length;
  const lineSpecs = citations.get(name);
  for (const spec of lineSpecs) {
    const numbers = spec.split(/[-,]/).map((n) => Number(n.trim()));
    const highest = Math.max(...numbers);
    if (highest > lineCount) {
      failures.push(
        `\`${name}:${spec}\` points past the end of ${path}, which has ` +
          `${lineCount} lines. The code moved and the citation did not.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. cited tests
// ---------------------------------------------------------------------------

/**
 * A row that names a test by its `it(...)` / `test(...)` title next to a file
 * is asserting that the test is there. This greps the file for the title.
 *
 * CONSERVATIVE ON PURPOSE, in three ways, because the alternative is a check
 * that fails on the document's prose rather than on its evidence:
 *
 *   - Only titles in straight double quotes DIRECTLY after a citation count.
 *     A quotation somewhere else in the same cell is usually the CLAIM being
 *     controlled, not the test's name, and matching those would mean grepping
 *     source files for sentences out of a plan document.
 *   - Any quotation containing a backtick, `**`, or `…` is skipped. The
 *     document abbreviates and emphasises inside quotations it is describing
 *     rather than naming, and neither survives a literal grep.
 *   - Only `*.test.ts(x)` and `*.spec.ts` files are searched.
 *
 * The result is that some named tests go unchecked. That is the right trade:
 * this arm exists to catch a DELETED or RENAMED test still being cited, and it
 * does that on every citation written in the plain form. Being clever here
 * would buy a handful more checks and a stream of false failures, and a check
 * people learn to ignore protects nothing.
 */
const TITLE_AFTER_CITATION =
  /`([A-Za-z0-9_@][A-Za-z0-9_.@/-]*\.(?:test\.tsx?|spec\.ts))(?::[\d,\s-]+)?`\s*(?:—|-|,)?\s*"([^"]{8,})"/g;

let titlesChecked = 0;
for (const match of text.matchAll(TITLE_AFTER_CITATION)) {
  const file = match[1].replace(/^\.\//, '');
  const title = match[2];
  if (/[`…]|\*\*/.test(title)) continue;
  const path = resolved.get(file);
  if (!path) continue; // already reported as dead or ambiguous above
  const source = readFileSync(resolve(repoRoot, path), 'utf8');
  titlesChecked += 1;
  if (!source.includes(title)) {
    failures.push(
      `${path} no longer contains the test "${title}", which the index cites ` +
        `as the control. Either the test was renamed and the row was not, or ` +
        `the control is gone and the claim is uncontrolled.`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. the head the index claims
// ---------------------------------------------------------------------------

/**
 * The head is always required to be a real commit reachable from HEAD, because
 * a measurement names the thing it measured or it is an anecdote.
 *
 * The exact-tree half — "and no file the index cites has moved since" — is
 * SPLIT BY OWNERSHIP, and the split is a cost decision, not a softening.
 *
 * The index cites 113 distinct paths, and among them are `DECISIONS.md`,
 * `.github/workflows/ci.yml`, `apps/tlon-web/package.json` and
 * `packages/shared/src/db/queries.ts`. Enforced repo-wide, this check would
 * mean that after this branch merges, most pull requests in the repo go red
 * until someone regenerates a Surface Channels working document they have
 * nothing to do with. A repo-wide gate on one project's index is a tax on
 * everyone else, and taxes get routed around — the check would be deleted, and
 * with it the two arms that catch real rot.
 *
 * So the tree claim is enforced where the claims are load-bearing and where
 * the person moving the file is the person who owns the index: the surface
 * paths listed below. Everywhere else a moved cited file is REPORTED and the
 * run stays green, because the honest statement about `DECISIONS.md` moving is
 * "some rows may be stale", not "this branch is broken".
 *
 * Checks 1, 2 and 4 stay hard failures repo-wide. A citation pointing past the
 * end of a file is wrong whoever moved the file.
 *
 * Note for CI: this needs the recorded commit to be present, so the job that
 * runs it checks out with `fetch-depth: 0`.
 */
const SURFACE_OWNED_PREFIXES = [
  'packages/tlon-skill/',
  'packages/api/src/client/surface/',
  'packages/shared/src/store/surface/',
  'packages/surface-shell/',
  'packages/app/ui/components/SurfaceChannel/',
  'apps/tlon-web/sandbox-posture/',
];
const SURFACE_OWNED_FILES = ['apps/tlon-web/hostCsp.ts'];
// `packages/api/src/__tests__/` holds this project's reducer/schema/caps suites
// beside tests that have nothing to do with it, so the directory cannot be
// listed as a prefix — the surface files in it are named by their prefix
// instead.
const SURFACE_OWNED_PATTERNS = [/^packages\/api\/src\/__tests__\/surface/];

const isSurfaceOwned = (path) =>
  SURFACE_OWNED_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
  SURFACE_OWNED_FILES.includes(path) ||
  SURFACE_OWNED_PATTERNS.some((pattern) => pattern.test(path)) ||
  /^surface-channels-[^/]*\.md$/.test(path);

/** Cited files that moved but are nobody's to regenerate; reported, not fatal. */
let driftedElsewhere = [];
const headMatch = text.match(/^\*\*Head:\*\*\s+`([0-9a-f]{7,40})`/m);
if (!headMatch) {
  failures.push(
    `the header does not record a head. It must carry a line beginning ` +
      `\`**Head:** \\\`<sha>\\\`\` naming the commit the index was measured at.`
  );
} else {
  const recorded = headMatch[1];
  let isCommit = true;
  try {
    git(['rev-parse', '--verify', '--quiet', `${recorded}^{commit}`]);
  } catch {
    isCommit = false;
  }

  if (!isCommit) {
    failures.push(
      `the header records \`${recorded}\`, which is not a commit in this ` +
        `repository. The index has to name a tree that exists.`
    );
  } else {
    let reachable = true;
    try {
      git(['merge-base', '--is-ancestor', recorded, 'HEAD']);
    } catch {
      reachable = false;
    }
    if (!reachable) {
      failures.push(
        `the header records \`${recorded}\`, which is not an ancestor of ` +
          `HEAD. The index describes a tree this branch never had.`
      );
    } else {
      const moved = new Set(
        git(['diff', '--name-only', `${recorded}..HEAD`])
          .split('\n')
          .filter(Boolean)
      );
      const citedAndMoved = [...new Set(resolved.values())]
        .filter((path) => moved.has(path))
        .sort();
      const owned = citedAndMoved.filter(isSurfaceOwned);
      driftedElsewhere = citedAndMoved.filter((path) => !isSurfaceOwned(path));

      if (owned.length > 0) {
        failures.push(
          `${owned.length} surface file(s) the index cites have changed ` +
            `between the recorded head \`${recorded}\` and HEAD, so the index ` +
            `no longer describes this tree — regenerate the index:\n` +
            owned.map((path) => `      ${path}`).join('\n')
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. no dirty-tree disclaimer
// ---------------------------------------------------------------------------

/**
 * The first revision of the index named a commit and then spent a blockquote
 * explaining that the commit was not what it measured. That disclaimer is not
 * honesty, it is the defect: an index measured against an unreproducible
 * working tree cannot be re-run by anyone, so none of its rows can be checked.
 * The header region — everything above the first `---` rule — must not say it.
 */
const header = text.split(/^---$/m)[0];
const DIRTY_TREE_PHRASES = [
  /working tree/i,
  /is \*?\*?not\*?\*? clean/i,
  /nothing here is verified against any commit/i,
  /names the base, not the state/i,
  /uncommitted/i,
  /untracked/i,
];
for (const phrase of DIRTY_TREE_PHRASES) {
  const found = header.match(phrase);
  if (found) {
    failures.push(
      `the header says "${found[0]}", which means the index is describing a ` +
        `working tree rather than a commit. A tree nobody else can check out ` +
        `is not evidence. Measure at a commit and record it.`
    );
  }
}

// ---------------------------------------------------------------------------

// Printed whether or not anything failed, and never fatal: these are files the
// index happens to cite that other people's work moves. Naming them is the
// whole obligation — somebody re-reading those rows should know they may be
// describing an older tree.
if (driftedElsewhere.length > 0) {
  console.log(
    `The index may be stale for rows citing these ${driftedElsewhere.length} ` +
      `file(s), which have changed since the head the header records. They are ` +
      `outside the surface paths, so this is a notice and not a failure:`
  );
  for (const path of driftedElsewhere) console.log(`  ${path}`);
  console.log('');
}

if (failures.length > 0) {
  console.error('Claims index check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `Claims index OK: ${resolved.size} citation(s) resolve, ${titlesChecked} ` +
    `named test(s) still exist, and every cited surface file is unchanged ` +
    `since the head the header records.`
);
if (skippedBuildOutput.length > 0) {
  console.log(
    `note: ${skippedBuildOutput.length} build-output citation(s) not checked ` +
      `(${skippedBuildOutput.join(', ')}) — dist/ is gitignored and this job ` +
      `does not build.`
  );
}
