/**
 * The assert-unsatisfied preflight: prove a revision request is NOT already
 * satisfied before it is issued.
 *
 * ## Why
 *
 * The format verdict has failed twice, both times because the discriminator
 * could not discriminate. 6a: the loop could not reach what it would edit, so
 * "it slot-fills" and "it cannot read its own bundle" produced identical
 * diffs. 6a.5: the loop was not asked to change anything — four of five
 * revision requests were already satisfied before the run, having been landed
 * by 6a's own revisions, so an empty regeneration column rested on five
 * observations none of which were forced.
 *
 * This closes the second one structurally. A request that this refuses is
 * REPLACED, not waved through, and `dev/surfaces-run.sh --request <id>` will
 * not send a request whose record this has not passed — the prompt text the
 * bot receives is read out of the same record the assertion was made against,
 * so the check and the request cannot drift apart. A preflight nobody invokes
 * is the same defect one level up; a preflight invoked against a different
 * sentence than the one that gets sent is the same defect wearing a hat.
 *
 * ## What it reads, and in what order
 *
 * 1. `tlon surface show <channel> --json --bundle-out <tmp>` — the RAW
 *    definition cell (action map, recipe, bundle pointer) and the bundle's
 *    verified bytes.
 * 2. `tlon surface state <channel> --json` — the channel's live reduced state,
 *    so the render measured is the one a member is looking at right now and not
 *    a pristine `initialState` nobody has seen since revision 1.
 * 3. `dev/surfaces-render-probe.ts` — twelve cells in headless Chromium
 *    through the production shell, reporting the text a browser painted.
 *
 * Both CLI reads run the CLI FROM SOURCE (`bun packages/tlon-skill/scripts/
 * main.ts`), never a compiled binary. 6a.5 nearly produced a clean-looking
 * replication of 6a's result because a container's CLI predated three of that
 * session's own fixes; running from source makes the staleness question
 * unaskable rather than guarded. The render probe imports the CLI's own
 * `renderSurfacePreview` for the same reason.
 *
 * ## The judgment
 *
 * All the judging is in `dev/surfaces-witness.mjs`, which is pure and tested;
 * read its header for the lattice and for why this is not a keyword grep. This
 * file is the IO half: it gathers surfaces, hands them over, and writes down
 * what came back.
 *
 * ## The evidence
 *
 * A boolean is not evidence. Every run writes `<out>/<id>/assertion.json`
 * carrying, verbatim: the full action map, the full recipe, the painted text
 * and control labels of every one of the twelve cells, the bundle's sha256 and
 * byte count, the witness with all of its patterns and both of its example
 * sets, the self-test result for each pattern list, and — for a refusal — the
 * matched span with seventy characters of context on each side and the name of
 * the surface it came from. A human can re-run any pattern against any quoted
 * surface by hand and get the same answer. `<out>/<id>/assertion.txt` is the
 * same thing readable.
 *
 * Exit codes:
 *   0  ABSENT  — the behaviour is not there; the request may be issued
 *   1  refused — PRESENT (already satisfied) or ABSTAIN (could not tell)
 *   2  the preflight could not run
 *
 * Usage:
 *   bun dev/surfaces-assert-unsatisfied.ts --request <id> [--out <dir>] [--json]
 *   bun dev/surfaces-assert-unsatisfied.ts --file <path> [...]
 *
 * Request records live in `dev/surfaces-requests/*.json`; see the README there.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeRender } from './surfaces-render-probe';
// @ts-expect-error -- plain-JS sibling, deliberately untyped so `node --test` can run it
import { VERDICT, decide, mayIssue } from './surfaces-witness.mjs';

const DEV_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(DEV_DIR, '..', '..', '..');
const CLI_ENTRY = join(
  REPO_ROOT,
  'packages',
  'tlon-skill',
  'scripts',
  'main.ts'
);
const REQUESTS_DIR = join(DEV_DIR, 'surfaces-requests');
const DEFAULT_OUT = join(DEV_DIR, 'surfaces-6a-out', 'assert-unsatisfied');

export interface RequestRecord {
  id: string;
  channel: string;
  /** The exact sentence the bot will be sent. Read from here, never retyped. */
  request: string;
  /** What "satisfied" would mean, in a sentence a human can check the patterns against. */
  behaviour: string;
  /** One of the three revision shapes the verdict run has to span. */
  shape: 'render-only' | 'action-map' | 'structural';
  witness: {
    renderPatterns: string[];
    renderPositive: string;
    renderPositiveSource: string;
    renderNegatives: string[];
    renderNegativesSource: string;
    actionPatterns: string[];
    actionPositive: string;
    actionPositiveSource: string;
    actionNegatives: string[];
    actionNegativesSource: string;
  };
}

function fail(message: string): never {
  process.stderr.write(`ASSERT-UNSATISFIED COULD NOT RUN: ${message}\n`);
  process.exit(2);
}

function cli(args: string[]): string {
  try {
    return execFileSync('bun', [CLI_ENTRY, ...args], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    fail(
      `\`tlon ${args.join(' ')}\` failed.\n` +
        `stdout: ${(shell.stdout ?? '').trim()}\n` +
        `stderr: ${(shell.stderr ?? '').trim()}`
    );
  }
}

function cliJson<T>(args: string[]): T {
  const out = cli(args);
  const line = out.trim().split('\n').at(-1) ?? '';
  try {
    return JSON.parse(line) as T;
  } catch {
    return fail(`\`tlon ${args.join(' ')}\` did not print JSON:\n${out}`);
  }
}

function loadRequest(argv: string[]): RequestRecord {
  const at = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const file = at('--file');
  const id = at('--request');
  let path: string;
  if (file) {
    path = resolve(file);
  } else if (id) {
    path = join(REQUESTS_DIR, `${id}.json`);
  } else {
    const available = readdirSync(REQUESTS_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => `  ${name.replace(/\.json$/, '')}`)
      .join('\n');
    return fail(
      `--request <id> or --file <path> is required. Records in ${REQUESTS_DIR}:\n${available}`
    );
  }
  let record: RequestRecord;
  try {
    record = JSON.parse(readFileSync(path, 'utf8')) as RequestRecord;
  } catch (error) {
    return fail(
      `${path} could not be read: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  for (const key of [
    'id',
    'channel',
    'request',
    'behaviour',
    'witness',
  ] as const) {
    if (record[key] === undefined) fail(`${path} has no "${key}"`);
  }
  return record;
}

/** Human-readable evidence. The JSON is authoritative; this is what gets read. */
function renderText(evidence: Record<string, any>): string[] {
  const lines: string[] = [];
  const d = evidence.decision;
  lines.push(`ASSERT-UNSATISFIED — ${evidence.request.id}`);
  lines.push('');
  lines.push(`  verdict:   ${d.verdict.toUpperCase()} (${d.reason})`);
  lines.push(
    `  issuable:  ${d.verdict === VERDICT.absent ? 'YES' : 'NO — replace this request'}`
  );
  lines.push(`  channel:   ${evidence.request.channel}`);
  lines.push(`  request:   ${JSON.stringify(evidence.request.request)}`);
  lines.push(`  behaviour: ${evidence.request.behaviour}`);
  lines.push(`  shape:     ${evidence.request.shape ?? '(unstated)'}`);
  lines.push('');
  lines.push(`  ${d.explanation}`);
  lines.push('');

  lines.push('── the witness, and whether it discriminates ──');
  for (const test of [d.selfTest?.render, d.selfTest?.actions]) {
    if (!test) continue;
    lines.push(
      `  ${test.label}: ${test.ok ? 'PASSED its self-test' : 'FAILED its self-test'}`
    );
    for (const pattern of test.patterns) lines.push(`      /${pattern}/i`);
    lines.push(`      positive: ${JSON.stringify(test.positive)}`);
    lines.push(
      `        ${test.positiveMatchedBy ? `matched by /${test.positiveMatchedBy}/ at ${JSON.stringify(test.positiveMatch)}` : 'MATCHED BY NOTHING'}`
    );
    for (const negative of test.negatives) {
      const hit = test.negativeHits.find((h: any) => h.negative === negative);
      lines.push(
        `      negative: ${JSON.stringify(negative)}${hit ? `  ← MATCHED by /${hit.pattern}/, so this pattern set does not discriminate` : '  (not matched — good)'}`
      );
    }
    for (const failure of test.failures) lines.push(`      FAIL: ${failure}`);
  }
  lines.push('');

  if (evidence.surfaces) {
    lines.push('── what was searched ──');
    lines.push(
      `  spec revision ${evidence.surfaces.specRevision}, surfaceId ${evidence.surfaces.surfaceId}`
    );
    lines.push(
      `  bundle ${evidence.surfaces.bundle.sha256} (${evidence.surfaces.bundle.size} bytes)`
    );
    lines.push(
      `  render: ${evidence.surfaces.render.cells.length} cells, state from ${evidence.surfaces.render.stateSource}`
    );
    lines.push('');
    lines.push('  ACTION MAP, in full:');
    const actions = Object.entries(evidence.surfaces.actions ?? {});
    if (actions.length === 0) lines.push('      (none declared)');
    for (const [id, definition] of actions) {
      lines.push(`      ${id}: ${JSON.stringify(definition)}`);
    }
    lines.push('');
    lines.push('  RECIPE, verbatim:');
    lines.push(
      evidence.surfaces.recipe
        ? `      ${JSON.stringify(evidence.surfaces.recipe)}`
        : '      (none — this definition was published without one)'
    );
    lines.push('');
    lines.push(
      '  PAINTED TEXT, per cell (whitespace-collapsed by the in-frame probe;'
    );
    lines.push(
      '  adjacent text nodes arrive concatenated, so `1responses` is a stat'
    );
    lines.push('  reading 1 above a label reading `responses`):');
    for (const cell of evidence.surfaces.render.cells) {
      lines.push(`      [${cell.cell}] ${JSON.stringify(cell.text)}`);
      lines.push(`          controls: ${JSON.stringify(cell.controls)}`);
    }
    lines.push('');
    lines.push('  What the render could not see:');
    for (const item of evidence.surfaces.render.notSeen)
      lines.push(`      · ${item}`);
    lines.push('');
  }

  const findings = d.findings ?? {};
  const named: [string, string][] = [
    ['actionHit', 'an action in the map'],
    ['recipeHit', 'the recipe'],
    ['renderHit', 'the painted render'],
    ['sourceHit', 'the bundle source'],
  ];
  lines.push('── the fulcrum ──');
  let any = false;
  for (const [key, label] of named) {
    const hit = findings[key];
    if (!hit) continue;
    any = true;
    lines.push(`  ${label} — ${hit.where}`);
    lines.push(`      pattern:  /${hit.pattern}/i`);
    lines.push(`      matched:  ${JSON.stringify(hit.match)}`);
    lines.push(`      context:  ${JSON.stringify(hit.context)}`);
  }
  if (!any) {
    lines.push(
      '  nothing matched on any surface — the quoted absence above IS the evidence.'
    );
  }
  if (findings.unprobedCells) {
    for (const cell of findings.unprobedCells) {
      lines.push(`  UNPROBED ${cell.cell}: ${cell.problem}`);
    }
  }
  lines.push('');
  return lines;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const record = loadRequest(argv);
  const outRoot = (() => {
    const i = argv.indexOf('--out');
    return i === -1 ? DEFAULT_OUT : resolve(argv[i + 1] ?? DEFAULT_OUT);
  })();
  const outDir = join(outRoot, record.id);
  mkdirSync(outDir, { recursive: true });

  const log = (...m: unknown[]) => {
    if (!asJson) console.log(...m);
  };

  log(`==> ${record.id}: ${record.channel}`);
  log(`    request: ${JSON.stringify(record.request)}`);

  const bundlePath = join(outDir, 'bundle.js');
  const show = cliJson<any>([
    'surface',
    'show',
    record.channel,
    '--json',
    '--bundle-out',
    bundlePath,
  ]);
  if (!show.ok)
    fail(`surface show refused: ${show.message ?? JSON.stringify(show)}`);

  const specPath = join(outDir, 'spec.json');
  writeFileSync(specPath, `${JSON.stringify(show.spec, null, 2)}\n`);

  const state = cliJson<any>(['surface', 'state', record.channel, '--json']);
  if (!state.ok)
    fail(`surface state refused: ${state.message ?? JSON.stringify(state)}`);
  const statePath = join(outDir, 'live-state.json');
  writeFileSync(statePath, `${JSON.stringify(state.state, null, 2)}\n`);

  log(`    rendering twelve cells at the channel's live state…`);
  let render: any;
  try {
    render = await probeRender({
      bundle: bundlePath,
      spec: specPath,
      state: statePath,
      out: join(outDir, 'render'),
    });
  } catch (error) {
    render = {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const bundleSource = readFileSync(bundlePath, 'utf8');
  const decision = decide({
    witness: record.witness,
    spec: show.spec,
    recipe: show.recipe,
    render,
    bundleSource,
  });

  const evidence = {
    ok: mayIssue(decision),
    assertedAt: new Date().toISOString(),
    request: record,
    // The CLI is run from source, so this names the tree the reads came from
    // rather than a binary's build date.
    cli: { entry: CLI_ENTRY, mode: 'from-source (bun)' },
    ship: {
      url: process.env.TLON_URL ?? null,
      ship: process.env.TLON_SHIP ?? null,
    },
    decision,
    surfaces: render.ok
      ? {
          surfaceId: show.surfaceId,
          specRevision: show.specRevision,
          group: show.group,
          actions: show.spec?.actions ?? {},
          recipe: show.recipe ?? null,
          recipePresent: show.recipePresent === true,
          bundle: {
            assetRef: show.bundle.assetRef,
            sha256: show.bundle.sha256,
            size: show.bundle.size,
            bytesFetched: show.bundle.bytes ?? null,
          },
          liveState: state.state,
          stateFold: {
            baseSnapshotSeq: state.baseSnapshotSeq,
            newestFoldedSeq: state.newestFoldedSeq,
            foldedEventCount: state.foldedEventCount,
            posts: state.posts,
          },
          render: {
            stateSource: render.stateSource,
            cells: render.cells,
            unprobedCells: render.unprobedCells,
            shellErrors: render.shellErrors,
            notSeen: render.notSeen,
          },
        }
      : null,
    artifacts: {
      dir: outDir,
      spec: specPath,
      bundle: bundlePath,
      liveState: statePath,
      renderProbe: render.ok
        ? join(outDir, 'render', 'render-probe.json')
        : null,
    },
  };

  writeFileSync(
    join(outDir, 'assertion.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  const text = renderText(evidence).join('\n');
  writeFileSync(join(outDir, 'assertion.txt'), `${text}\n`);

  if (asJson) {
    console.log(JSON.stringify(evidence, null, 2));
  } else {
    console.log('');
    console.log(text);
    console.log(`evidence: ${join(outDir, 'assertion.json')}`);
  }

  process.exit(decision.verdict === VERDICT.absent ? 0 : 1);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
});
