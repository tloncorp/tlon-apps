/**
 * Re-derive the mechanically checkable half of one eval run, from the bytes.
 *
 *   bun dev/surfaces-eval-probe.ts --bundle app.js --spec spec.json \
 *     [--rubric rubric.json]
 *
 * Prints one JSON document on stdout and exits 0 whether the app passes or
 * fails — a gate failure is a RESULT here, not an error. Exit 2 means the
 * probe could not run, which is a different thing and must never be scored as
 * a failing app.
 *
 * ## Why the scorer does not read the run's own lint output
 *
 * Every artifact a bot-harness run deposits is something the run said about
 * itself. `publish.json` says the gate passed; `manifest.json` says the
 * defect pass was clean. Scoring those at face value produces a scoreboard
 * that measures the run's self-report, and this project has already shipped
 * one guard per session that could not fail. So the two things that can be
 * recomputed from the artifacts — the gate and the rubric sheet — are
 * recomputed here, from the same implementations `surface publish` uses, and
 * the scorer compares its own answer against what the run claimed. A
 * disagreement is a `contradiction`, which is louder than a failure.
 *
 * ## Why this is a bun script and not part of the .mjs scorer
 *
 * `lintSurfaceBundle` and `validateRubricArtifact` are the real
 * implementations, in TypeScript, in `packages/tlon-skill`. A second copy of
 * the rubric's completeness rules living in `dev/` would drift from the one
 * `surface publish` enforces, and the drift would be silent and in the
 * direction of leniency. Importing them costs a subprocess per request and
 * buys the guarantee that the harness scores what publish enforces.
 *
 * ## The cwd trap, which this script refuses rather than mis-reports
 *
 * The gate's smoke render runs the REAL shell, whose primitives are `.tsx`
 * compiled against preact. Bun transpiles them with the tsconfig it finds
 * from the *current working directory*, and only `packages/tlon-skill`'s
 * tsconfig sets `jsxImportSource: "preact"` (its comment says exactly this).
 * Run from the repo root instead, the shell's elements come out as React
 * elements — frozen in dev — and preact's renderer throws
 *
 *   TypeError: Attempting to define property on object that is not extensible
 *
 * which surfaces as a `smoke-render` violation on templates that lint clean.
 * That is an environment fault wearing an app fault's clothes, and scoring it
 * as an app fault would put a fabricated failure on the scoreboard. So the
 * probe detects that exact error and exits 2 naming the cwd, instead of
 * reporting a violation it does not believe.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  SURFACE_LINT_RULES,
  type SurfaceLintResult,
  type SurfaceLintRule,
  lintSurfaceBundle,
} from '../../tlon-skill/scripts/surface-lint';
import {
  POPULATED_CITED_CHECK,
  REACHABILITY_CITED_CHECK,
  validateRubricArtifact,
} from '../../tlon-skill/scripts/surface-rubric-artifact';

/**
 * The gate's rules, split into the two questions the scoreboard asks
 * separately.
 *
 * `fold` is the behavioural half: the rules that EVALUATE the bundle — they
 * run the app, through the real shell or the real reducer, and can only fail
 * for a reason about how it behaves. `lint` is everything decided by reading
 * the source and the spec. They are separated because "the app has a style
 * violation" and "the app throws when a member taps a button" are not the
 * same news, and a single gate boolean reports them identically.
 *
 * `gate` is the union — the thing `surface publish` actually enforces — and is
 * reported as its own axis rather than left for a reader to derive, because
 * publish's answer is the one that decides whether an app could ship.
 */
const FOLD_RULES: readonly SurfaceLintRule[] = [
  'smoke-render',
  'action-idempotency',
  // Renders the app at two host-supplied `now` values and errors if the
  // painted text differs. Behavioural: it is a fact about what the app does
  // when the clock moves, not about what its source says.
  'time-display',
];

const STATIC_RULES: readonly SurfaceLintRule[] = [
  'byte-cap',
  'module-syntax',
  'external-reference',
  'forbidden-api',
  'navigation-vector',
  'entry-point',
  'undeclared-action',
  'pointer-hygiene',
  'spec-schema',
  'style',
  'chart-sizing',
  'jargon',
  // Filed beside `jargon` for the same reason: it reads the rendered copy at
  // the states the gate already draws, and says nothing about what the app
  // does when state or the clock moves. The split these two lists make is
  // fold-versus-not, not rendered-versus-not.
  'count-agreement',
  'member-interaction',
];

/**
 * A rule the gate has and this probe has not classified.
 *
 * The complement approach — "fold is these two, everything else is static" —
 * files every future rule under `lint` silently, and `time-display` (added
 * mid-session, and behavioural) is the demonstration that new rules do arrive.
 * A mis-filed behavioural rule would report an app that throws when the clock
 * moves as a style problem, on a scoreboard whose whole purpose is to keep
 * those apart. So the two lists have to exhaust the gate, and a rule in
 * neither stops the probe rather than being defaulted into one.
 */
const UNCLASSIFIED_RULES = SURFACE_LINT_RULES.filter(
  (rule) => !FOLD_RULES.includes(rule) && !STATIC_RULES.includes(rule)
);

const CWD_TRAP =
  'Attempting to define property on object that is not extensible';

export interface ProbeAxis {
  verdict: 'pass' | 'fail';
  violations: {
    rule: string;
    severity: string;
    message: string;
    specPath?: string;
    line?: number;
  }[];
}

function axisFrom(result: SurfaceLintResult, rules: 'fold' | 'static' | 'all') {
  const chosen = result.violations.filter((violation) => {
    if (rules === 'all') return true;
    const isFold = FOLD_RULES.includes(violation.rule);
    return rules === 'fold' ? isFold : !isFold;
  });
  return {
    verdict: chosen.length === 0 ? 'pass' : 'fail',
    violations: chosen.map((violation) => ({
      rule: violation.rule,
      severity: violation.severity,
      message: violation.message,
      ...(violation.specPath === undefined
        ? {}
        : { specPath: violation.specPath }),
      ...(violation.line === undefined ? {} : { line: violation.line }),
    })),
  } satisfies ProbeAxis;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function readFlag(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    fail(`${name} needs a path`);
  }
  return value;
}

function main(): void {
  if (UNCLASSIFIED_RULES.length > 0) {
    fail(
      [
        'REFUSING TO SCORE: the gate has rule(s) this probe does not classify:',
        '',
        ...UNCLASSIFIED_RULES.map((rule) => `  ${rule}`),
        '',
        'Add each to FOLD_RULES if it evaluates the app (runs the shell or the',
        'reducer) or to STATIC_RULES if it is decided by reading the source and',
        'the spec. Defaulting would file a behavioural rule under `lint` on a',
        'scoreboard whose entire purpose is to keep those two apart.',
      ].join('\n')
    );
  }

  const args = process.argv.slice(2);
  const bundlePath = readFlag(args, '--bundle');
  const specPath = readFlag(args, '--spec');
  const rubricPath = readFlag(args, '--rubric');
  if (bundlePath === null || specPath === null) {
    fail(
      'usage: surfaces-eval-probe.ts --bundle <app.js> --spec <spec.json> [--rubric <sheet.json>]'
    );
  }

  let bundleSource: string;
  let bundleBytes: Buffer;
  try {
    bundleBytes = fs.readFileSync(bundlePath);
    bundleSource = bundleBytes.toString('utf-8');
  } catch (error) {
    fail(`could not read the bundle at ${bundlePath}: ${String(error)}`);
  }

  let spec: unknown;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
  } catch (error) {
    // A spec that is not JSON is an app fault, not a probe fault — but it is
    // one the gate cannot express, because every rule downstream of parsing
    // needs an object. Reported as its own outcome so the scoreboard does not
    // have to guess which.
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          reason: 'spec-unparseable',
          detail: String(error),
          bundleSha256: createHash('sha256').update(bundleBytes).digest('hex'),
        },
        null,
        2
      )}\n`
    );
    return;
  }

  let result: SurfaceLintResult;
  try {
    result = lintSurfaceBundle({ bundleSource, spec });
  } catch (error) {
    fail(`the gate threw rather than reporting: ${String(error)}`);
  }

  const trap = result.violations.find((violation) =>
    violation.message.includes(CWD_TRAP)
  );
  if (trap !== undefined) {
    fail(
      [
        'REFUSING TO SCORE: the gate reported',
        '',
        `  ${trap.rule}: ${trap.message}`,
        '',
        'which is the jsx-runtime trap, not a defect in this app. Bun picked up',
        `a tsconfig without jsxImportSource: "preact" from cwd ${process.cwd()},`,
        "so the shell's primitives compiled to React elements and preact could",
        'not render them. Re-run this probe with cwd set to packages/tlon-skill.',
        '',
        'Scoring this as a smoke-render failure would put a fabricated defect on',
        'the scoreboard, which is worse than having no number for this request.',
      ].join('\n')
    );
  }

  const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');

  let rubric: Record<string, unknown> | null = null;
  if (rubricPath !== null) {
    let raw: unknown;
    let parseError: string | null = null;
    try {
      raw = JSON.parse(fs.readFileSync(rubricPath, 'utf-8'));
    } catch (error) {
      parseError = String(error);
    }
    if (parseError !== null) {
      rubric = {
        present: true,
        verdict: 'fail',
        code: 'rubric-unreadable',
        problems: [parseError],
      };
    } else {
      const validation = validateRubricArtifact(raw, spec);
      // Identity is checked here rather than inside the validator because the
      // validator is handed a sheet and has no bundle. `surface publish`
      // makes the same comparison against the bytes it is about to upload;
      // this makes it against the bytes on disk. A sheet that is complete but
      // scores different bytes is the failure mode that looks most like
      // success — twelve filled cells, seven verdicts, and none of it about
      // this app.
      const declared =
        typeof (raw as { bundleSha256?: unknown })?.bundleSha256 === 'string'
          ? (raw as { bundleSha256: string }).bundleSha256
          : null;
      const identical = declared === bundleSha256;

      // A sheet recorded before part of the artifact's SHAPE existed is NOT an
      // author error, and must not be scored as one.
      //
      // This probe reads past runs; it does not gate a write. `surface publish`
      // refuses such a sheet, correctly and with no lenient path, because there
      // the sheet is a claim about what somebody looked at before something
      // lands. Here the run already happened, the recording is the evidence,
      // and re-scoring it under a rule that did not exist would put a
      // fabricated author-error on the scoreboard — the same failure as the
      // smoke-render case above, where a tooling problem was nearly recorded as
      // a bad app.
      //
      // So: reader, not gate. Do NOT "fix" this into strictness to match
      // publish; the two are answering different questions about the same file.
      // `surfaces-score.mjs` needs no copy of this rule — it spawns this probe
      // and reads the verdict below, so the tolerance is single-sourced here by
      // construction rather than by discipline.
      //
      // The list GROWS as the artifact grows. Every field added to
      // `RubricArtifact` since these recordings were made belongs here, or the
      // next one silently turns four historical sheets into four fabricated
      // failures — which is exactly how this was found the second time.
      const PRE_BINDING_FIELDS = [
        'specSha256',
        'stateSource',
        'stateSha256',
      ] as const;
      const missingBindings: string[] = PRE_BINDING_FIELDS.filter(
        (field) => (raw as Record<string, unknown>)?.[field] === undefined
      );
      // Check 7's `reachability` citation and check 5's `populated` citation
      // are the same class one level in: they live on a check entry rather than
      // at the top level, so absence is read there. Only when the entry EXISTS
      // and lacks the line — a sheet missing the check altogether is genuinely
      // incomplete and keeps failing.
      const scoredChecks = (raw as { checks?: unknown })?.checks;
      const entryFor = (id: string): Record<string, unknown> | undefined => {
        if (
          typeof scoredChecks !== 'object' ||
          scoredChecks === null ||
          Array.isArray(scoredChecks)
        ) {
          return undefined;
        }
        const entry = (scoredChecks as Record<string, unknown>)[id];
        return typeof entry === 'object' &&
          entry !== null &&
          !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : undefined;
      };
      const citedCheck = entryFor(REACHABILITY_CITED_CHECK);
      if (citedCheck !== undefined && citedCheck.reachability === undefined) {
        missingBindings.push('reachability');
      }
      const populatedCheck = entryFor(POPULATED_CITED_CHECK);
      if (
        populatedCheck !== undefined &&
        populatedCheck.populated === undefined
      ) {
        missingBindings.push('populated');
      }
      const predatesBindings = missingBindings.length > 0;
      // Only the complaints about the fields this sheet is older than are set
      // aside. A sheet that ALSO left three cells blank is still incomplete,
      // and says so — the tolerance is scoped to the shape change, not to the
      // scoring. Every one of the validator's messages names its field in
      // double quotes, which is what makes this match narrow rather than a
      // substring guess.
      const validationProblems = (
        validation.ok ? [] : validation.problems
      ).filter(
        (problem) =>
          !missingBindings.some((field) => problem.includes(`"${field}"`))
      );
      const problems = [...validationProblems];
      if (!identical) {
        problems.push(
          `the sheet scores bundle ${declared ?? '(none declared)'} but the run's bundle is ${bundleSha256}`
        );
      }
      rubric = {
        present: true,
        verdict: problems.length === 0 ? 'pass' : 'fail',
        code:
          validationProblems.length > 0
            ? validation.code
            : identical
              ? null
              : 'rubric-mismatch',
        // `surfaces-score.mjs` renders this as the rubric axis's detail line,
        // so dropping it leaves a failing axis with nothing said about why.
        problems,
        // Said plainly rather than left to be inferred from a silence: this
        // sheet is older than part of the artifact's shape.
        ...(predatesBindings
          ? {
              predatesBindings: missingBindings,
              note: `this sheet was recorded before ${missingBindings.join(', ')} joined the rubric artifact; those fields are not scored against it`,
            }
          : {}),
        declaredBundleSha256: declared,
        // The screenshot scoring itself: reported, never adjudicated by this
        // probe. It is a judgement somebody made while looking at twelve
        // captures, and the harness's job is to carry it to the scoreboard
        // intact, not to second-guess it.
        verdicts: tallyVerdicts(raw),
      };
    }
  } else {
    rubric = { present: false };
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        bundlePath: path.resolve(bundlePath),
        specPath: path.resolve(specPath),
        bundleSha256,
        bundleBytes: bundleBytes.length,
        surfaceId:
          typeof (spec as { surfaceId?: unknown })?.surfaceId === 'string'
            ? (spec as { surfaceId: string }).surfaceId
            : null,
        gate: axisFrom(result, 'all'),
        lint: axisFrom(result, 'static'),
        fold: axisFrom(result, 'fold'),
        warnings: result.warnings.map((warning) => ({
          rule: warning.rule,
          message: warning.message,
        })),
        skipped: result.skipped,
        rubric,
      },
      null,
      2
    )}\n`
  );
}

/**
 * The filled sheet's verdict tally, by check.
 *
 * Counted rather than judged. `RUBRIC.md` says `fail` and `residual` are both
 * publishable after two repair rounds, so a sheet carrying them is a sheet
 * that did its job; what the scoreboard wants is the shape of what was found,
 * with the notes attached so a reader can see whether "residual" meant "the
 * chart is tight on a phone" or "nobody can use this app".
 */
function tallyVerdicts(raw: unknown): {
  counts: Record<string, number>;
  nonPass: { check: string; verdict: string; cell: string; note: string }[];
} | null {
  const checks = (raw as { checks?: unknown })?.checks;
  if (typeof checks !== 'object' || checks === null || Array.isArray(checks)) {
    return null;
  }
  const counts: Record<string, number> = {};
  const nonPass: {
    check: string;
    verdict: string;
    cell: string;
    note: string;
  }[] = [];
  for (const [id, entry] of Object.entries(checks as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const verdict = (entry as { verdict?: unknown }).verdict;
    if (typeof verdict !== 'string') continue;
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    if (verdict !== 'pass') {
      nonPass.push({
        check: id,
        verdict,
        cell: String((entry as { cell?: unknown }).cell ?? ''),
        note: String((entry as { note?: unknown }).note ?? ''),
      });
    }
  }
  return { counts, nonPass };
}

main();
