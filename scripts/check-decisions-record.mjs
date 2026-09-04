/**
 * Guard the decision record's location and its coverage.
 *
 * THE FAILURE THIS EXISTS FOR, three times over. A decision entry was
 * appended to a `DECISIONS.md` that was not the tracked one at the repo
 * root — twice because a shell's working directory had persisted from an
 * earlier command, once on the very day the "grep the tracked file from the
 * repo root" check was written down. Each time the commit claiming the
 * decision did not contain it, and each time it was caught by luck (a
 * decision tail reading one number lower than expected) rather than by
 * anything mechanical.
 *
 * Two checks, because the failure has two halves:
 *
 *   1. LOCATION — there is exactly one `DECISIONS.md`, at the repo root. A
 *      second one anywhere else is the bug itself, sitting on disk.
 *   2. COVERAGE — no document cites a decision number the tracked record
 *      does not contain. That is what actually goes wrong when half 1 is
 *      violated: the report says "D168" and the record stops at D167.
 *
 * Deliberately dependency-free and run from `ci-config-check`, the one CI
 * job with no path filter — a stray root markdown matches no filter, so a
 * gated job would be skipped exactly when this is needed. Same reasoning as
 * `check-ci-path-filters.mjs`, which is the precedent for this shape.
 *
 * Run: node scripts/check-decisions-record.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECORD = 'DECISIONS.md';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'ios',
  'android',
  'desk-deps',
  'coverage',
  'test-results',
  'playwright-report',
]);

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue; // a broken symlink is not our problem
    }
    if (stats.isDirectory()) {
      walk(full, found);
    } else if (name === RECORD) {
      found.push(full);
    }
  }
  return found;
}

const failures = [];

// ---------------------------------------------------------------------------
// 1. location
// ---------------------------------------------------------------------------

const records = walk(repoRoot);
const rootRecord = join(repoRoot, RECORD);
const strays = records.filter((path) => path !== rootRecord);

if (!records.includes(rootRecord)) {
  failures.push(
    `${RECORD} is missing from the repo root. The tracked record is the only one that counts.`
  );
}

for (const stray of strays) {
  failures.push(
    `${relative(repoRoot, stray)} is a second ${RECORD}. Decisions go in the root ` +
      `${RECORD} and nowhere else — a stray one is almost always a persisted \`cd\` ` +
      `writing to the wrong file, and its entries will not be in the commit that ` +
      `claims them. Move its contents into the root record and delete it.`
  );
}

// ---------------------------------------------------------------------------
// 2. coverage
// ---------------------------------------------------------------------------

/** Every `D<n>` (and `D<n>.<m>`) the record actually defines. */
function definedDecisions(text) {
  const defined = new Set();
  // entries are written as `- **D123: title` or `## D123`
  for (const match of text.matchAll(/(?:^|\n)\s*(?:-\s+\*\*|#+\s*)D(\d+)/g)) {
    defined.add(Number(match[1]));
  }
  return defined;
}

/** Every `D<n>` a document cites. */
function citedDecisions(text) {
  const cited = new Set();
  for (const match of text.matchAll(/\bD(\d+)(?:\.\d+)?\b/g)) {
    cited.add(Number(match[1]));
  }
  return cited;
}

if (records.includes(rootRecord)) {
  const record = readFileSync(rootRecord, 'utf8');
  const defined = definedDecisions(record);
  const highestDefined = Math.max(0, ...defined);

  // Documents that CITE decisions. Prompts are excluded on purpose: a
  // handoff prompt names the number the next session will start at, so it
  // legitimately refers forward to an entry that does not exist yet.
  const scanned = [];
  const candidates = [
    ...readdirSync(repoRoot)
      .filter((name) => name.endsWith('.md') && name !== RECORD)
      .map((name) => join(repoRoot, name)),
  ];
  const auditDir = join(repoRoot, 'audit-notes');
  try {
    for (const name of readdirSync(auditDir)) {
      if (name.endsWith('.md')) candidates.push(join(auditDir, name));
    }
  } catch {
    // no audit notes on this branch
  }

  for (const path of candidates) {
    const name = relative(repoRoot, path);
    if (name.endsWith('-prompt.md')) continue;
    scanned.push(name);
    const text = readFileSync(path, 'utf8');
    const missing = [...citedDecisions(text)]
      .filter((n) => n > 0 && n <= highestDefined && !defined.has(n))
      .sort((a, b) => a - b);
    const beyond = [...citedDecisions(text)]
      .filter((n) => n > highestDefined)
      .sort((a, b) => a - b);

    if (beyond.length > 0) {
      failures.push(
        `${name} cites ${beyond.map((n) => `D${n}`).join(', ')}, but the tracked ` +
          `${RECORD} stops at D${highestDefined}. Either the entry was written to a ` +
          `stray record, or it was never written at all.`
      );
    }
    if (missing.length > 0) {
      failures.push(
        `${name} cites ${missing.map((n) => `D${n}`).join(', ')}, which ${RECORD} ` +
          `does not define even though it defines higher numbers — a gap, not a ` +
          `forward reference.`
      );
    }
  }

  if (process.env.DECISIONS_CHECK_VERBOSE === '1') {
    console.log(
      `record defines ${defined.size} decisions, highest D${highestDefined}`
    );
    console.log(`scanned ${scanned.length} citing document(s):`);
    for (const name of scanned) console.log(`  ${name}`);
  }

  // Coverage is only as good as what is on disk. In CI that is the tracked
  // set; locally it includes untracked working documents, which is where the
  // three real incidents were caught. Say so rather than letting a green run
  // read as "every report was checked".
  if (scanned.length === 0) {
    console.log(
      `note: no citing documents present, so only the location check ran.`
    );
  }
}

if (failures.length > 0) {
  console.error('Decision record check failed:\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `Decision record OK: one ${RECORD}, at the repo root, covering every decision cited on this branch.`
);
