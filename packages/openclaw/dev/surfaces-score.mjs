#!/usr/bin/env node

/**
 * Score an eval run against the corpus and emit the scoreboard.
 *
 *   node dev/surfaces-score.mjs --run dev/surfaces-eval-out/<label> \
 *     [--corpus dev/surfaces-corpus] [--out <dir>] [--baseline <file>] \
 *     [--label <name>]
 *
 * Writes `scoreboard.json` and `scoreboard.md` into `--out` (default: the run
 * directory). Exits 0 when it scored what it could, 1 when it found a
 * CONTRADICTION, and 2 when it could not run at all.
 *
 * ══════════════════════════════════════════════════════════════════════
 * What this is for
 * ══════════════════════════════════════════════════════════════════════
 *
 * `plan.md` §10: M2's exit additionally gates the freeform-generation
 * posture, and the numbers that decide it are lint/fold/preview pass rates
 * plus rubric-scored screenshots over a corpus of realistic requests. This is
 * the thing that produces those numbers. The corpus run itself needs the bot
 * harness and a live container and happens outside build sessions; this
 * scorer runs anywhere, on the evidence that run leaves behind.
 *
 * ══════════════════════════════════════════════════════════════════════
 * The four properties this scorer is built around
 * ══════════════════════════════════════════════════════════════════════
 *
 * **1. Re-derive, do not trust.** Everything in a run directory is something
 * the run said about itself. `publish.json` says the gate passed. The
 * preview manifest says the defect pass was clean. A scoreboard that reads
 * those at face value measures the run's self-report, and session 6a
 * contains two runs that published successfully and told the user they had
 * failed — the self-report and the world had already come apart. So the gate
 * and the rubric sheet are recomputed from the artifact bytes (see
 * `surfaces-eval-probe.ts`), and where the recomputation disagrees with the
 * claim the row is scored `contradiction`, which is louder than `fail`.
 *
 * **2. `unscored` is never `pass`.** Every axis has three or four outcomes
 * and the totals report each separately. There is deliberately no single
 * "pass rate" anywhere in the output, because the one number a reader would
 * quote is the one that hides how much went unmeasured — and a corpus run
 * where preview never ran would otherwise report the same headline as one
 * where it ran and was clean. `dev/surfaces-preflight.mjs` and the preview
 * manifest's own `unprobedCells` make the same distinction for the same
 * reason.
 *
 * **3. A missing request is `missing`, loudly.** A run that produced nothing
 * for twenty of thirty-three requests must not look like a run of thirteen.
 * The corpus is the denominator, always, and requests with no run directory
 * are counted and named.
 *
 * **4. A cap kill is a result.** `meta.json`'s `capSeconds` / `turnSeconds` /
 * `killedAtCap` feed a `budget` axis and a `cap-killed` outcome, and per-phase
 * seconds are derived from the transcript's own timestamps. The verdict run
 * measured generation-from-nothing at roughly twice the cost of a revision —
 * median around 160s against a 300s cap, one turn killed outright — while
 * 6a.5's "the budget is not the constraint" came from a sample that was
 * almost entirely revisions. A harness that dropped or retried cap kills, or
 * that reported one wall-clock number per request, would reproduce that wrong
 * reading across the whole corpus.
 *
 * ══════════════════════════════════════════════════════════════════════
 * The run directory contract
 * ══════════════════════════════════════════════════════════════════════
 *
 *   <run-dir>/
 *     run.json                 optional — label, container, model, date
 *     <request-id>/
 *       transcript.jsonl       the agent turn (routing evidence)
 *       artifacts/app.js       the bundle the run produced
 *       artifacts/spec.json    the spec the run produced
 *       preview/manifest.json  `surface preview`'s manifest, verbatim
 *       preview/rubric.json    the FILLED scoring sheet  ← screenshot input
 *       publish.json           `surface publish --json`, verbatim
 *       meta.json              runner-written: capSeconds, turnSeconds,
 *                              killedAtCap, channel, exit statuses
 *
 * Every file is optional and every absence is a specific `unscored` reason
 * rather than a hole. A request directory that does not exist at all is
 * `missing`.
 *
 * `preview/rubric.json` is the slot the bot-harness run fills. Nothing in
 * this repo can fill it, because it is a judgement made while looking at
 * twelve captures; the harness carries it to the scoreboard, validates that
 * it is complete and that it scores THESE bytes, and reports its verdicts
 * without adjudicating them.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(DEV_DIR, '..', '..', '..');
const TLON_SKILL_DIR = path.join(REPO_ROOT, 'packages', 'tlon-skill');
const PROBE = path.join(DEV_DIR, 'surfaces-eval-probe.ts');
const DEFAULT_CORPUS = path.join(DEV_DIR, 'surfaces-corpus');

/* ------------------------------------------------------------------ */
/* Routing detection                                                   */
/* ------------------------------------------------------------------ */

/**
 * What counts as "this request reached the surfaces skill".
 *
 * Exported and pattern-shaped rather than buried in a conditional, because
 * routing is the axis the out-of-scope third of the corpus exists to measure
 * and a detector nobody can read is a detector nobody can argue with. The
 * three signals are deliberately different in kind:
 *
 * - `SKILL_READ` — the skill document was opened. Weakest: a model can read
 *   a skill and then do something else.
 * - `SURFACE_COMMAND` — a `tlon surface …` command ran. This is the real
 *   signal: the pipeline was entered.
 * - `SKILL_TOOL` — a harness that activates skills as tool calls rather than
 *   as file reads. Present so a runtime change does not silently make every
 *   row read "never routed".
 *
 * `routed` is the disjunction. An out-of-scope request is scored on it being
 * FALSE, so a detector that misses a signal turns an over-trigger into a
 * clean pass — which is why the weak signal is included rather than dropped.
 */
export const ROUTING_SIGNALS = {
  SKILL_READ: /skills?[/\\]surfaces[/\\]SKILL\.md|surfaces[/\\]SKILL\.md/i,
  SURFACE_COMMAND: /^\s*surface(\s|$)/,
  SKILL_TOOL: /^surfaces$/i,
};

/** Tool-result text that means the `message` tool refused a poll parameter. */
const MESSAGE_POLL_REJECTION = /action:\s*"?poll"?|poll(Duration|Options)/i;

function toolParts(entry) {
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  return content;
}

function partArgs(part) {
  return part.arguments ?? part.input ?? part.args ?? {};
}

/**
 * Read one turn's transcript and report what the run actually did.
 *
 * Returns `null` when there is no transcript to read — which is an
 * `unscored` routing axis, never a `routed: false`. The distinction matters:
 * "the bot did not route here" and "nobody recorded what the bot did" are
 * opposite news for an out-of-scope request, and collapsing them would score
 * every unrecorded run as a clean routing pass.
 */
export function readTranscript(text) {
  const observations = {
    routed: false,
    skillRead: false,
    surfaceCommands: [],
    published: false,
    announced: false,
    imagesDelivered: 0,
    messageToolRejections: 0,
    toolCalls: 0,
    /**
     * Where the turn's seconds went, derived from the transcript's own
     * timestamps rather than from anything the runner wrote down.
     *
     * The reason the split matters: the verdict run measured
     * generation-from-nothing at roughly twice the cost of revising an
     * existing board, and 6a.5's "the budget is not the constraint" was read
     * off a sample that was almost entirely revisions. One wall-clock number
     * per request cannot tell those two apart, and a corpus run reporting
     * only totals would reproduce the same wrong reading thirty-three times.
     *
     * `beforeFirstSurfaceCommand` is routing plus generation: everything from
     * the turn's first event to the moment the pipeline was first entered. It
     * is the phase the verdict run found expensive, and the one with no
     * command of its own to be timed by.
     */
    phases: null,
  };
  const marks = [];
  const surfaceCalls = [];
  let firstSurfaceSignalAt = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(entry.timestamp ?? '');
    if (Number.isFinite(at)) marks.push({ at, entry });
    for (const part of toolParts(entry)) {
      if (part.type === 'image') {
        observations.imagesDelivered += 1;
        continue;
      }
      const isCall =
        part.type === 'toolCall' ||
        part.type === 'tool_use' ||
        part.type === 'tool-call';
      const isResult =
        part.type === 'toolResult' ||
        part.type === 'tool_result' ||
        part.type === 'tool-result';
      if (isResult) {
        const out = part.result ?? part.content ?? part.output;
        const text = typeof out === 'string' ? out : JSON.stringify(out ?? '');
        if (MESSAGE_POLL_REJECTION.test(text)) {
          observations.messageToolRejections += 1;
        }
        continue;
      }
      if (!isCall) continue;
      observations.toolCalls += 1;
      const name = String(part.name ?? part.toolName ?? '');
      const args = partArgs(part);
      if (
        ROUTING_SIGNALS.SKILL_TOOL.test(String(args.skill ?? args.name ?? ''))
      ) {
        observations.routed = true;
        observations.skillRead = true;
      }
      const readPath = String(args.path ?? args.file_path ?? '');
      if (readPath !== '' && ROUTING_SIGNALS.SKILL_READ.test(readPath)) {
        observations.routed = true;
        observations.skillRead = true;
      }
      if (name.toLowerCase() === 'tlon') {
        const command = String(args.command ?? '');
        if (ROUTING_SIGNALS.SURFACE_COMMAND.test(command)) {
          observations.routed = true;
          const sub = command.trim().split(/\s+/).slice(0, 2).join(' ');
          observations.surfaceCommands.push(sub);
          if (Number.isFinite(at)) surfaceCalls.push({ at, sub });
          if (/^surface publish\b/.test(command.trim())) {
            observations.published = true;
          }
        }
        if (/^\s*posts\s+send\b/.test(command)) observations.announced = true;
      }
      if (
        Number.isFinite(at) &&
        firstSurfaceSignalAt === null &&
        observations.routed
      ) {
        firstSurfaceSignalAt = at;
      }
    }
  }
  observations.phases = derivePhases(marks, surfaceCalls, firstSurfaceSignalAt);
  return observations;
}

/**
 * Turn the transcript's marks into seconds per phase.
 *
 * Each surface command is charged the interval from its own timestamp to the
 * next mark in the transcript — which is the wall time between issuing it and
 * anything else happening, i.e. the command plus whatever the model spent
 * reading its output. That is deliberately generous to the command: the
 * question the corpus run has to answer is where a 300-second budget goes,
 * and "the preview ran fast but the twelve captures took ninety seconds to
 * look at" is the same ninety seconds as far as the cap is concerned.
 *
 * Returns `null` when the transcript carries no usable timestamps, which is
 * an unscored budget rather than a zero.
 */
function derivePhases(marks, surfaceCalls, firstSurfaceSignalAt) {
  if (marks.length < 2) return null;
  const first = marks[0].at;
  const last = marks[marks.length - 1].at;
  const nextMarkAfter = (at) => {
    for (const mark of marks) if (mark.at > at) return mark.at;
    return last;
  };
  const byCommand = {};
  for (const call of surfaceCalls) {
    const seconds = (nextMarkAfter(call.at) - call.at) / 1000;
    byCommand[call.sub] = Number(
      ((byCommand[call.sub] ?? 0) + seconds).toFixed(3)
    );
  }
  const lastSurfaceAt =
    surfaceCalls.length > 0
      ? nextMarkAfter(surfaceCalls[surfaceCalls.length - 1].at)
      : null;
  return {
    source: 'transcript',
    totalSeconds: Number(((last - first) / 1000).toFixed(3)),
    beforeFirstSurfaceCommand:
      firstSurfaceSignalAt === null
        ? null
        : Number(((firstSurfaceSignalAt - first) / 1000).toFixed(3)),
    afterLastSurfaceCommand:
      lastSurfaceAt === null
        ? null
        : Number(((last - lastSurfaceAt) / 1000).toFixed(3)),
    byCommand,
  };
}

/* ------------------------------------------------------------------ */
/* Reading one request's evidence                                      */
/* ------------------------------------------------------------------ */

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return { present: false, value: null };
  try {
    return {
      present: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
    };
  } catch (error) {
    return { present: true, value: null, error: String(error) };
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Run the probe over one request's artifacts.
 *
 * cwd is pinned to `packages/tlon-skill` and not negotiable — see the probe's
 * header. The probe refuses rather than reports if the pin is missing, so a
 * change here surfaces as an environment refusal instead of as a corpus-wide
 * smoke-render failure.
 *
 * Because the cwd moves, every path handed over is resolved here first. A
 * relative `--run` argument otherwise produces a corpus-wide ENOENT that
 * reads as "the probe could not run" on every row — a silent all-unscored
 * scoreboard, which is the exact shape of failure the `unscored` column
 * exists to make visible and would in this case have been caused by the
 * harness itself.
 */
function runProbe(bundlePath, specPath, rubricPath) {
  const args = [
    PROBE,
    '--bundle',
    path.resolve(bundlePath),
    '--spec',
    path.resolve(specPath),
  ];
  if (rubricPath !== null) args.push('--rubric', path.resolve(rubricPath));
  const result = spawnSync('bun', args, {
    cwd: TLON_SKILL_DIR,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    return {
      ok: false,
      reason: 'probe-unavailable',
      detail: String(result.error),
    };
  }
  if (result.status === 2) {
    return {
      ok: false,
      reason: 'probe-refused',
      detail: (result.stderr ?? '').trim(),
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      reason: 'probe-unreadable',
      detail: `${String(error)}\n${(result.stderr ?? '').slice(0, 2000)}`,
    };
  }
}

const PASS = 'pass';
const FAIL = 'fail';
const UNSCORED = 'unscored';
const NA = 'n/a';

function axis(verdict, detail) {
  return detail === undefined ? { verdict } : { verdict, detail };
}

/**
 * Score one corpus record against one run directory.
 *
 * The shape of this function is the whole design: each axis is decided from
 * one source, every absence names itself, and the cross-checks that compare
 * two sources against each other are collected separately as
 * `contradictions` rather than folded into an axis. A contradiction is not a
 * worse failure — it is a different kind of news. "The app did not pass the
 * gate" is a fact about the app. "The run says it published an app that does
 * not pass the gate" is a fact about the harness or the bot, and the person
 * who needs to see it is not the person tuning templates.
 */
export function scoreRequest(record, dir, probeRunner = runProbe) {
  const inScope = record.expect.routes === true;
  const axes = {
    routing: axis(UNSCORED, 'no transcript.jsonl'),
    lint: axis(UNSCORED, 'no artifacts/'),
    fold: axis(UNSCORED, 'no artifacts/'),
    gate: axis(UNSCORED, 'no artifacts/'),
    preview: axis(UNSCORED, 'no preview/manifest.json'),
    rubric: axis(UNSCORED, 'no preview/rubric.json'),
    publish: axis(UNSCORED, 'no publish.json'),
    screenshotRubric: axis(UNSCORED, 'no preview/rubric.json'),
    budget: axis(UNSCORED, 'no meta.json timing'),
  };
  const contradictions = [];
  const observations = {};

  if (dir === null || !fs.existsSync(dir)) {
    return {
      id: record.id,
      request: record.request,
      origin: record.origin,
      expected: record.expect,
      outcome: 'missing',
      axes: Object.fromEntries(
        Object.keys(axes).map((key) => [
          key,
          axis(UNSCORED, 'no run directory'),
        ])
      ),
      contradictions,
      observations,
    };
  }

  /* ---- routing ------------------------------------------------------ */
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  let routing = null;
  if (fs.existsSync(transcriptPath)) {
    routing = readTranscript(fs.readFileSync(transcriptPath, 'utf-8'));
    observations.routing = routing;
    axes.routing =
      routing.routed === inScope
        ? axis(
            PASS,
            inScope ? 'reached the surfaces skill' : 'routed away, as it should'
          )
        : axis(
            FAIL,
            inScope
              ? 'never reached the surfaces skill'
              : `over-triggered: ran ${routing.surfaceCommands.join(', ') || 'the surfaces skill'}`
          );
  }

  /* ---- artifacts, and everything derived from them ------------------ */
  const bundlePath = path.join(dir, 'artifacts', 'app.js');
  const specPath = path.join(dir, 'artifacts', 'spec.json');
  const rubricPath = path.join(dir, 'preview', 'rubric.json');
  const hasArtifacts = fs.existsSync(bundlePath) && fs.existsSync(specPath);
  let probe = null;
  let artifactSha = null;

  if (hasArtifacts) {
    artifactSha = sha256File(bundlePath);
    observations.bundleSha256 = artifactSha;
    probe = probeRunner(
      bundlePath,
      specPath,
      fs.existsSync(rubricPath) ? rubricPath : null
    );
    if (probe.ok !== true) {
      const detail = `${probe.reason}: ${String(probe.detail ?? '').split('\n')[0]}`;
      axes.lint = axis(UNSCORED, detail);
      axes.fold = axis(UNSCORED, detail);
      axes.gate = axis(UNSCORED, detail);
      // The rubric axes go with them. They default to "no sheet", and leaving
      // that default standing over a probe that never ran would report a
      // present, filled sheet as absent — the harness misdescribing its own
      // inputs, which is the one thing a scoreboard may never do.
      if (fs.existsSync(rubricPath)) {
        axes.rubric = axis(UNSCORED, detail);
        axes.screenshotRubric = axis(UNSCORED, detail);
      }
      if (probe.reason === 'spec-unparseable') {
        // Not an environment fault: the run emitted a spec that is not JSON.
        // Recorded as a gate failure with the parse error, because that is
        // exactly what `surface publish` would do with it.
        axes.gate = axis(FAIL, 'spec.json is not valid JSON');
        axes.lint = axis(FAIL, 'spec.json is not valid JSON');
        axes.fold = axis(
          UNSCORED,
          'spec.json is not valid JSON; nothing to fold'
        );
      }
    } else {
      axes.lint = axis(
        probe.lint.verdict,
        probe.lint.violations
          .map((v) => `${v.rule}: ${v.message}`)
          .join('; ') || 'no static-rule violations'
      );
      axes.fold = axis(
        probe.fold.verdict,
        probe.fold.violations
          .map((v) => `${v.rule}: ${v.message}`)
          .join('; ') || 'smoke render and double-fold both clean'
      );
      axes.gate = axis(
        probe.gate.verdict,
        `${probe.gate.violations.length} error-severity violation(s); ${probe.warnings.length} warning(s); ${probe.skipped.length} rule(s) skipped`
      );
      observations.gateWarnings = probe.warnings;
      observations.gateSkipped = probe.skipped;
      observations.surfaceId = probe.surfaceId;

      if (probe.rubric?.present === true) {
        axes.rubric = axis(
          probe.rubric.verdict,
          probe.rubric.verdict === PASS
            ? 'twelve cells observed, every applicable check scored, sheet names these bytes'
            : (probe.rubric.problems ?? []).join('; ')
        );
        const tally = probe.rubric.verdicts;
        if (probe.rubric.verdict !== PASS) {
          axes.screenshotRubric = axis(
            UNSCORED,
            'the sheet is incomplete or scores other bytes, so its verdicts do not describe this app'
          );
        } else if (tally === null) {
          axes.screenshotRubric = axis(UNSCORED, 'the sheet carries no checks');
        } else {
          observations.rubricVerdicts = tally.counts;
          observations.rubricNonPass = tally.nonPass;
          const failed = tally.nonPass.filter((e) => e.verdict === 'fail');
          axes.screenshotRubric =
            failed.length === 0
              ? axis(
                  PASS,
                  tally.nonPass.length === 0
                    ? 'every check passed'
                    : `${tally.nonPass.length} check(s) repaired or shipped as a stated residual`
                )
              : axis(
                  FAIL,
                  failed.map((e) => `${e.check}: ${e.note}`).join('; ')
                );
        }
      }
    }
  }

  /* ---- preview ------------------------------------------------------ */
  const manifest = readJsonIfPresent(
    path.join(dir, 'preview', 'manifest.json')
  );
  if (manifest.present) {
    if (manifest.value === null) {
      axes.preview = axis(UNSCORED, `manifest is not JSON: ${manifest.error}`);
    } else {
      const defects = manifest.value.defects ?? [];
      const unprobed = manifest.value.unprobedCells ?? [];
      const shellErrors = manifest.value.shellErrors ?? [];
      observations.preview = {
        defects: defects.length,
        unprobedCells: unprobed.length,
        shellErrors: shellErrors.length,
        now: manifest.value.now ?? null,
        notChecked: (manifest.value.notChecked ?? []).length,
      };
      const problems = [];
      if (defects.length > 0) {
        problems.push(
          `${defects.length} machine defect(s): ${defects
            .map((d) => d.check ?? d.rule ?? 'defect')
            .join(', ')}`
        );
      }
      if (shellErrors.length > 0) {
        problems.push(`${shellErrors.length} shell error(s) while capturing`);
      }
      // An unprobed cell is neither a pass nor a failure of the app. It is
      // the defect pass admitting it could not look, which the manifest
      // reports separately for exactly this reason — so it lands as
      // `unscored`, not as a clean row.
      if (problems.length > 0) {
        axes.preview = axis(FAIL, problems.join('; '));
      } else if (unprobed.length > 0) {
        axes.preview = axis(
          UNSCORED,
          `${unprobed.length} cell(s) could not be measured: ${unprobed
            .map((c) => c.cell)
            .join(', ')}`
        );
      } else {
        axes.preview = axis(
          PASS,
          'no overflow, tap-target or jargon defects in twelve cells'
        );
      }
      if (
        artifactSha !== null &&
        typeof manifest.value.bundleSha256 === 'string' &&
        manifest.value.bundleSha256 !== artifactSha
      ) {
        contradictions.push({
          kind: 'preview-captured-other-bytes',
          detail: `the capture matrix was rendered from ${manifest.value.bundleSha256} but the run's bundle is ${artifactSha}`,
        });
      }
    }
  }

  /* ---- publish ------------------------------------------------------ */
  const publish = readJsonIfPresent(path.join(dir, 'publish.json'));
  if (publish.present) {
    if (publish.value === null) {
      axes.publish = axis(
        UNSCORED,
        `publish.json is not JSON: ${publish.error}`
      );
    } else {
      const doc = publish.value;
      observations.publish = {
        outcome: doc.outcome ?? null,
        channel: doc.channel ?? null,
        group: doc.group ?? null,
        specRevision: doc.specRevision ?? null,
        sha256: doc.sha256 ?? null,
        observed: doc.observed ?? null,
      };
      const claimed =
        doc.ok !== false &&
        (doc.outcome === 'published' ||
          doc.outcome === 'no-op' ||
          doc.outcome === 'migration-repaired');
      // The success clause is `observed`, not `outcome`. SKILL.md's first
      // rule is that success is observed rather than assumed; publish only
      // sets `observed` after reading the definition back off the ship, so
      // an outcome without one is a claim with nothing behind it.
      axes.publish = claimed
        ? typeof doc.observed === 'string' && doc.observed.trim() !== ''
          ? axis(PASS, doc.observed)
          : axis(FAIL, `outcome "${doc.outcome}" with no read-back observation`)
        : axis(
            FAIL,
            `${doc.code ?? 'failed'}: ${String(doc.message ?? '').slice(0, 200)}`
          );

      if (claimed && artifactSha !== null && typeof doc.sha256 === 'string') {
        if (doc.sha256 !== artifactSha) {
          contradictions.push({
            kind: 'published-other-bytes',
            detail: `publish reported bundle ${doc.sha256}; the artifacts scored here hash to ${artifactSha}. The scoreboard's numbers are about a different app than the one on the ship.`,
          });
        }
      }
      if (claimed && axes.gate.verdict === FAIL) {
        contradictions.push({
          kind: 'published-over-failing-gate',
          detail:
            'publish reports success while the gate, re-run over the same bytes, fails. Either the gate was bypassed or the artifacts are not what was published.',
        });
      }
      if (!inScope) {
        contradictions.push({
          kind: 'published-out-of-scope-request',
          detail: `${record.id} is a request that should have routed away, and it published a surface to ${doc.channel ?? 'a channel'}.`,
        });
      }
    }
  }

  if (!inScope && hasArtifacts) {
    contradictions.push({
      kind: 'artifacts-for-out-of-scope-request',
      detail:
        'a request that should have routed away produced an app bundle and a spec.',
    });
  }

  /* ---- meta, and the budget ----------------------------------------- */
  //
  // A turn killed on the cap is a RESULT about the pipeline, not a failed
  // measurement to be retried and forgotten. The verdict run measured
  // generation-from-nothing at roughly twice the cost of revising an existing
  // board — median around 160s, one turn killed outright at 300s — while
  // 6a.5 concluded "the budget is not the constraint" from a sample that was
  // almost entirely revisions. A harness that dropped or silently retried cap
  // kills would reproduce that wrong reading at corpus scale, so a cap kill
  // gets its own axis and its own outcome and rides into the baseline.
  const meta = readJsonIfPresent(path.join(dir, 'meta.json'));
  let capKilled = false;
  if (meta.present && meta.value !== null) {
    observations.meta = meta.value;
    const cap = Number(meta.value.capSeconds);
    const turn = Number(meta.value.turnSeconds);
    // Derived, not taken on trust — and `killedAtCap` is honoured too,
    // because a runner that watched the process die knows something the
    // clock does not. Either witness is enough.
    const overCap =
      Number.isFinite(cap) && Number.isFinite(turn) && turn >= cap;
    capKilled = overCap || meta.value.killedAtCap === true;
    if (capKilled) {
      axes.budget = axis(
        FAIL,
        Number.isFinite(cap)
          ? `the turn hit the ${cap}s cap (${Number.isFinite(turn) ? `${turn}s` : 'killed'})`
          : 'the runner reported the turn was killed on the cap'
      );
    } else if (Number.isFinite(cap) && Number.isFinite(turn)) {
      axes.budget = axis(
        PASS,
        `${turn}s of a ${cap}s cap, ${(cap - turn).toFixed(1)}s of headroom`
      );
    } else if (Number.isFinite(turn)) {
      axes.budget = axis(
        UNSCORED,
        `the turn took ${turn}s and meta.json declares no capSeconds to judge it against`
      );
    }
    if (meta.value.phases !== undefined && meta.value.phases !== null) {
      observations.phases = { ...meta.value.phases };
    }
  }
  // Transcript-derived phases win over anything the runner wrote down, on the
  // same re-derive-do-not-trust principle as the gate. The runner's own
  // numbers stay as the fallback for a run with no usable timestamps.
  if (routing?.phases) observations.phases = routing.phases;

  /* ---- out-of-scope axes are not applicable ------------------------- */
  //
  // Unconditionally, including when the run DID produce artifacts. An
  // over-triggered request that then linted clean and published cleanly would
  // otherwise contribute four passes to the axis columns, and those columns
  // are read as "how good are the apps this pipeline builds" — an app that
  // should not exist has no place in that average, however clean it is. The
  // over-trigger is not lost: it is a routing failure and a contradiction,
  // both of which are reported where they belong.
  if (!inScope) {
    for (const key of [
      'lint',
      'fold',
      'gate',
      'preview',
      'rubric',
      'screenshotRubric',
      'publish',
    ]) {
      const built = axes[key].verdict !== UNSCORED;
      axes[key] = axis(
        NA,
        built
          ? `out-of-scope request: nothing should have been built, and this axis would otherwise have read "${axes[key].verdict}"`
          : 'out-of-scope request: nothing should have been built'
      );
    }
  }

  const verdicts = Object.values(axes).map((a) => a.verdict);
  // `n/a` is not a measurement, so a row that is nothing but `n/a` and
  // `unscored` measured nothing and says so. Counting those `n/a` cells as
  // evidence would let an out-of-scope request with no transcript read
  // `partial` — "nothing failed" — when the truth is that nobody looked.
  const measured = verdicts.filter((verdict) => verdict !== NA);
  let outcome;
  if (contradictions.length > 0) outcome = 'contradiction';
  // Above `fail`, below `contradiction`. A cap kill truncates the turn, so
  // every axis downstream of it describes a pipeline that was interrupted
  // rather than one that finished badly — reporting the row as a plain `fail`
  // would file it beside apps that had their whole turn and still came out
  // wrong. A contradiction still wins, because that says a number is about
  // something other than what it claims, cap or no cap.
  else if (capKilled) outcome = 'cap-killed';
  else if (verdicts.includes(FAIL)) outcome = 'fail';
  else if (measured.every((verdict) => verdict === UNSCORED))
    outcome = 'unscored';
  else if (measured.includes(UNSCORED)) outcome = 'partial';
  else outcome = 'pass';

  return {
    id: record.id,
    request: record.request,
    origin: record.origin,
    expected: record.expect,
    outcome,
    axes,
    contradictions,
    observations,
  };
}

/* ------------------------------------------------------------------ */
/* Corpus                                                              */
/* ------------------------------------------------------------------ */

export function loadCorpus(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`no corpus records in ${dir}`);
  }
  const records = files.map((name) => {
    const record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
    if (record.id !== name.replace(/\.json$/, '')) {
      throw new Error(`${name}: id "${record.id}" does not match the filename`);
    }
    if (typeof record.request !== 'string' || record.request.trim() === '') {
      throw new Error(`${name}: no request sentence`);
    }
    if (typeof record.expect?.routes !== 'boolean') {
      throw new Error(`${name}: expect.routes must be a boolean`);
    }
    return record;
  });
  // The corpus's own identity, so a scoreboard names the corpus it scored and
  // a later comparison against a baseline can tell "the numbers moved" from
  // "somebody edited the questions".
  // JSON, not a delimiter: `record.request` is free-form English, so `::`,
  // `|` and spaces all occur naturally and any of them as a separator could
  // make two different corpora hash alike. The NUL this replaced was safe
  // but made the file binary to `grep`. Note the digest CHANGED when this
  // did — `surfaces-eval-baseline.json`'s `corpus.sha256` was regenerated in
  // the same commit, since a stale one would report `corpusChanged: true`
  // and read as "somebody edited the questions".
  const hash = createHash('sha256');
  for (const record of records)
    hash.update(JSON.stringify([record.id, record.request]));
  return { records, sha256: hash.digest('hex') };
}

/* ------------------------------------------------------------------ */
/* Scoreboard                                                          */
/* ------------------------------------------------------------------ */

const AXES = [
  'routing',
  'lint',
  'fold',
  'gate',
  'preview',
  'rubric',
  'screenshotRubric',
  'publish',
  'budget',
];

export function buildScoreboard({ corpus, rows, runDir, label, runMeta }) {
  const axisTotals = {};
  for (const name of AXES) {
    axisTotals[name] = { pass: 0, fail: 0, unscored: 0, 'n/a': 0 };
  }
  const outcomes = {
    pass: 0,
    partial: 0,
    fail: 0,
    'cap-killed': 0,
    contradiction: 0,
    unscored: 0,
    missing: 0,
  };
  for (const row of rows) {
    outcomes[row.outcome] += 1;
    for (const name of AXES) axisTotals[name][row.axes[name].verdict] += 1;
  }
  const contradictions = rows.flatMap((row) =>
    row.contradictions.map((c) => ({ id: row.id, ...c }))
  );
  const templateChoice = rows
    .filter((row) => row.expected.template != null)
    .map((row) => ({
      id: row.id,
      expected: row.expected.template,
      observed: row.observations.surfaceId ?? null,
    }));
  return {
    version: 1,
    label,
    generatedAt: new Date().toISOString(),
    runDir,
    runMeta: runMeta ?? null,
    corpus: {
      dir: corpus.dir,
      sha256: corpus.sha256,
      requests: corpus.records.length,
      inScope: corpus.records.filter((r) => r.expect.routes).length,
      outOfScope: corpus.records.filter((r) => !r.expect.routes).length,
    },
    totals: { outcomes, axes: axisTotals },
    contradictions,
    templateChoice,
    requests: rows,
  };
}

/**
 * The comparable core of a scoreboard, for recording as a baseline.
 *
 * Trimmed rather than the whole document: a baseline is a thing later runs
 * are diffed against and read by a person, and the per-request `observations`
 * carry absolute paths, container names and a copy of every gate message —
 * megabytes of provenance about one machine on one afternoon. What survives
 * is what a comparison needs and what a reader has to see to know what the
 * numbers were about: the corpus hash, the totals, and one line per request.
 *
 * Emitted by the tool rather than hand-written, so the recorded baseline
 * cannot be a summary of a run somebody remembers.
 */
export function toBaseline(scoreboard, note) {
  return {
    version: 1,
    label: scoreboard.label,
    generatedAt: scoreboard.generatedAt,
    note: note ?? null,
    corpus: scoreboard.corpus,
    totals: scoreboard.totals,
    contradictions: scoreboard.contradictions,
    requests: scoreboard.requests.map((row) => ({
      id: row.id,
      outcome: row.outcome,
      axes: Object.fromEntries(
        Object.entries(row.axes).map(([name, entry]) => [name, entry.verdict])
      ),
    })),
  };
}

/**
 * Which family an outcome belongs to.
 *
 * The comparison does NOT put the six outcomes in one total order, because
 * two of them are not about quality at all. `missing` and `unscored` say how
 * much was measured; `pass`/`fail` say how it went. A single rank has to
 * decide whether `fail → missing` is better or worse, and both answers are
 * wrong: the app did not improve, and the pipeline did not break — a request
 * stopped being measured, which is its own news and the kind that quietly
 * flatters a run. So movement is bucketed by family instead, and a change
 * that crosses into or out of `unmeasured` is reported as a coverage change
 * under its own heading rather than laundered into the win column.
 *
 * Measured first with a total order inside each family: `pass > partial` and
 * `fail > contradiction`, since a contradiction is strictly worse news than a
 * failure — it means a number somewhere is about something other than what it
 * says.
 */
const OUTCOME_FAMILY = {
  pass: 'good',
  partial: 'good',
  fail: 'bad',
  contradiction: 'bad',
  missing: 'unmeasured',
  unscored: 'unmeasured',
};
const WITHIN_FAMILY_RANK = {
  pass: 1,
  partial: 0,
  fail: 1,
  contradiction: 0,
  missing: 0,
  unscored: 0,
};

export function compareToBaseline(scoreboard, baseline) {
  const before = new Map(baseline.requests.map((row) => [row.id, row]));
  const after = new Map(scoreboard.requests.map((row) => [row.id, row]));
  const regressions = [];
  const improvements = [];
  const coverageLost = [];
  const coverageGained = [];
  const added = [];
  const dropped = [];
  for (const [id, row] of after) {
    const previous = before.get(id);
    if (previous === undefined) {
      added.push(id);
      continue;
    }
    if (row.outcome === previous.outcome) continue;
    const entry = { id, was: previous.outcome, now: row.outcome };
    const wasFamily = OUTCOME_FAMILY[previous.outcome];
    const nowFamily = OUTCOME_FAMILY[row.outcome];
    if (wasFamily === nowFamily) {
      // `missing → unscored` and back are both "still not measured". There is
      // no better or worse inside that family, and calling either one an
      // improvement is how a run that measured less than the last one ends up
      // with entries in the win column.
      if (wasFamily === 'unmeasured') continue;
      if (
        WITHIN_FAMILY_RANK[row.outcome] < WITHIN_FAMILY_RANK[previous.outcome]
      ) {
        regressions.push(entry);
      } else {
        improvements.push(entry);
      }
    } else if (nowFamily === 'unmeasured') {
      coverageLost.push(entry);
    } else if (wasFamily === 'unmeasured') {
      coverageGained.push(entry);
    } else if (nowFamily === 'bad') {
      regressions.push(entry);
    } else {
      improvements.push(entry);
    }
  }
  for (const id of before.keys()) if (!after.has(id)) dropped.push(id);
  return {
    baselineLabel: baseline.label,
    baselineGeneratedAt: baseline.generatedAt,
    corpusChanged: baseline.corpus?.sha256 !== scoreboard.corpus.sha256,
    regressions,
    improvements,
    coverageLost,
    coverageGained,
    added,
    dropped,
  };
}

/**
 * The budget section: where the seconds went, and every turn the cap killed.
 *
 * Reported as a section of its own rather than as a column, because the
 * question it answers is not "did this request pass" but "what does this
 * pipeline cost, and which phase is eating it". The verdict run's finding —
 * generation-from-nothing at roughly twice the cost of a revision, median
 * around 160s against a 300s cap, one turn killed outright — is a finding
 * about a phase, and a per-request wall-clock column cannot carry it.
 *
 * Medians, not means: one 300s kill drags a mean across a corpus of
 * thirty-three and makes every phase look expensive.
 */
function renderBudget(scoreboard) {
  const timed = scoreboard.requests.filter(
    (row) => row.observations?.phases != null
  );
  const killed = scoreboard.requests.filter(
    (row) => row.outcome === 'cap-killed'
  );
  const lines = ['## Budget', ''];
  if (killed.length > 0) {
    lines.push(
      `**${killed.length} turn(s) hit the cap.** A cap kill is a result about the pipeline, not a measurement to retry: the turn was cut off mid-pipeline, so every axis after the cut describes something that was interrupted rather than something that finished badly.`
    );
    lines.push('');
    for (const row of killed) {
      lines.push(`- \`${row.id}\` — ${row.axes.budget.detail}`);
    }
    lines.push('');
  }
  if (timed.length === 0) {
    lines.push(
      'No request carried usable phase timings, so nothing here says where the budget goes. That is a gap in the run, not a clean result.'
    );
    lines.push('');
    return lines.join('\n');
  }
  const phaseNames = new Set();
  for (const row of timed) {
    const phases = row.observations.phases;
    if (phases.beforeFirstSurfaceCommand != null) {
      phaseNames.add('routing + generation (before the first surface command)');
    }
    for (const name of Object.keys(phases.byCommand ?? {}))
      phaseNames.add(name);
    if (phases.afterLastSurfaceCommand != null) {
      phaseNames.add('after the last surface command');
    }
  }
  const seconds = (row, name) => {
    const phases = row.observations.phases;
    if (name.startsWith('routing + generation')) {
      return phases.beforeFirstSurfaceCommand;
    }
    if (name.startsWith('after the last'))
      return phases.afterLastSurfaceCommand;
    return (phases.byCommand ?? {})[name];
  };
  lines.push(
    `Phase seconds across the ${timed.length} request(s) that carried timings. Medians, because one cap kill would drag a mean across the whole corpus.`
  );
  lines.push('');
  lines.push('| phase | requests | median s | max s |');
  lines.push('| --- | --- | --- | --- |');
  for (const name of phaseNames) {
    const values = timed
      .map((row) => seconds(row, name))
      .filter((value) => typeof value === 'number')
      .sort((a, b) => a - b);
    if (values.length === 0) continue;
    const median = values[Math.floor((values.length - 1) / 2)];
    lines.push(
      `| ${name} | ${values.length} | ${median.toFixed(1)} | ${values[values.length - 1].toFixed(1)} |`
    );
  }
  lines.push('');
  const sources = new Set(timed.map((row) => row.observations.phases.source));
  lines.push(
    `Timing source: ${[...sources].join(', ')}. \`transcript\` means derived from the turn's own timestamps; anything else was written down by the runner and is only as good as what it watched.`
  );
  lines.push('');
  return lines.join('\n');
}

function pct(part, whole) {
  if (whole === 0) return '—';
  return `${part}/${whole}`;
}

export function renderMarkdown(scoreboard, comparison) {
  const { totals, corpus } = scoreboard;
  const lines = [];
  lines.push(`# Surface generation scoreboard — ${scoreboard.label}`);
  lines.push('');
  lines.push(
    `Corpus \`${corpus.sha256.slice(0, 12)}\` — ${corpus.requests} requests ` +
      `(${corpus.inScope} in scope, ${corpus.outOfScope} deliberately out of scope). ` +
      `Scored ${scoreboard.generatedAt}.`
  );
  lines.push('');
  if (scoreboard.contradictions.length > 0) {
    lines.push(`## ${scoreboard.contradictions.length} CONTRADICTION(S)`);
    lines.push('');
    lines.push(
      'A contradiction is not a failing app. It is the run and the artifacts disagreeing about what happened, which means at least one number elsewhere on this page is about something other than what it says.'
    );
    lines.push('');
    for (const c of scoreboard.contradictions) {
      lines.push(`- **${c.id}** — \`${c.kind}\`: ${c.detail}`);
    }
    lines.push('');
  }
  lines.push('## Outcomes');
  lines.push('');
  lines.push('| outcome | count | meaning |');
  lines.push('| --- | --- | --- |');
  const meaning = {
    pass: 'every applicable axis passed',
    partial: 'nothing failed, but something went unmeasured',
    fail: 'at least one axis failed',
    'cap-killed': 'the turn hit the run cap and was cut off mid-pipeline',
    contradiction: 'the evidence disagrees with itself',
    unscored: 'a run directory with nothing scoreable in it',
    missing: 'no run directory — this request was never issued',
  };
  for (const [name, count] of Object.entries(totals.outcomes)) {
    lines.push(`| ${name} | ${count} | ${meaning[name]} |`);
  }
  lines.push('');
  lines.push('## Axes');
  lines.push('');
  lines.push(
    'Read the columns separately. There is no single pass rate on purpose: an `unscored` cell is not a pass, and a headline ratio is exactly the number that would hide how many of them there are.'
  );
  lines.push('');
  lines.push('| axis | pass | fail | unscored | n/a |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const name of AXES) {
    const t = totals.axes[name];
    lines.push(
      `| ${name} | ${t.pass} | ${t.fail} | ${t.unscored} | ${t['n/a']} |`
    );
  }
  lines.push('');
  lines.push('## Per request');
  lines.push('');
  lines.push(
    '| request | outcome | routing | gate | preview | rubric | screenshots | publish | budget |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of scoreboard.requests) {
    lines.push(
      `| \`${row.id}\` | ${row.outcome} | ${row.axes.routing.verdict} | ${row.axes.gate.verdict} | ${row.axes.preview.verdict} | ${row.axes.rubric.verdict} | ${row.axes.screenshotRubric.verdict} | ${row.axes.publish.verdict} | ${row.axes.budget.verdict} |`
    );
  }
  lines.push('');
  const missing = scoreboard.requests.filter((r) => r.outcome === 'missing');
  if (missing.length > 0) {
    lines.push(
      `${missing.length} of ${corpus.requests} requests have no run directory: ${pct(
        corpus.requests - missing.length,
        corpus.requests
      )} of the corpus was actually issued.`
    );
    lines.push('');
  }
  lines.push(renderBudget(scoreboard));
  if (comparison) {
    lines.push('## Against the baseline');
    lines.push('');
    lines.push(
      `Baseline \`${comparison.baselineLabel}\` (${comparison.baselineGeneratedAt}).` +
        (comparison.corpusChanged
          ? ' **The corpus changed between the two runs** — some of the movement below is a different set of questions, not a different set of answers.'
          : '')
    );
    lines.push('');
    for (const [heading, entries] of [
      ['Regressions', comparison.regressions],
      ['Improvements', comparison.improvements],
      ['Stopped being measured (not an improvement)', comparison.coverageLost],
      ['Measured for the first time', comparison.coverageGained],
    ]) {
      lines.push(`**${heading}:** ${entries.length}`);
      for (const entry of entries) {
        lines.push(`- \`${entry.id}\`: ${entry.was} → ${entry.now}`);
      }
      lines.push('');
    }
    if (comparison.added.length > 0) {
      lines.push(`**New in this corpus:** ${comparison.added.join(', ')}`);
      lines.push('');
    }
    if (comparison.dropped.length > 0) {
      lines.push(
        `**Dropped since the baseline:** ${comparison.dropped.join(', ')}`
      );
      lines.push('');
    }
  }
  lines.push('## What this page does not measure');
  lines.push('');
  lines.push(
    '- Whether the app is the thing that was asked for. That is rubric check 7 and it lives in `preview/rubric.json`, filled by whoever looked at the twelve captures.'
  );
  lines.push(
    '- Doctrine violations the gate does not encode — `0.5` for a chess draw against the integers-only rule shipped through a clean gate in session 6a.'
  );
  lines.push(
    '- Whether the copy means anything to a member, which the preview defect pass says it cannot check on every run, including clean ones.'
  );
  lines.push(
    "- Whether the app was published to the RIGHT channel. `published-other-bytes` catches a swap of the bundle; the channel binding is `dev/surfaces-run.sh`'s write fence, upstream of here."
  );
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function flag(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    process.stderr.write(`${name} needs a value\n`);
    process.exit(2);
  }
  return value;
}

function main(argv) {
  const runDir = flag(argv, '--run');
  if (runDir === null) {
    process.stderr.write(
      'usage: surfaces-score.mjs --run <dir> [--corpus <dir>] [--out <dir>] [--baseline <file>] [--emit-baseline <file>] [--label <name>] [--note <text>]\n'
    );
    process.exit(2);
  }
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`no run directory at ${runDir}\n`);
    process.exit(2);
  }
  const corpusDir = flag(argv, '--corpus', DEFAULT_CORPUS);
  const outDir = flag(argv, '--out', runDir);
  const baselinePath = flag(argv, '--baseline');
  const runMetaRead = readJsonIfPresent(path.join(runDir, 'run.json'));
  const label =
    flag(argv, '--label') ??
    runMetaRead.value?.label ??
    path.basename(path.resolve(runDir));

  const corpus = loadCorpus(corpusDir);
  const rows = corpus.records.map((record) => {
    const dir = path.join(runDir, record.id);
    return scoreRequest(record, fs.existsSync(dir) ? dir : null);
  });
  const scoreboard = buildScoreboard({
    corpus: { ...corpus, dir: path.resolve(corpusDir) },
    rows,
    runDir: path.resolve(runDir),
    label,
    runMeta: runMetaRead.value,
  });

  let comparison = null;
  if (baselinePath !== null) {
    if (!fs.existsSync(baselinePath)) {
      process.stderr.write(`no baseline at ${baselinePath}\n`);
      process.exit(2);
    }
    comparison = compareToBaseline(
      scoreboard,
      JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
    );
    scoreboard.comparison = comparison;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'scoreboard.json');
  const mdPath = path.join(outDir, 'scoreboard.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(scoreboard, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(scoreboard, comparison));

  const emitBaseline = flag(argv, '--emit-baseline');
  if (emitBaseline !== null) {
    fs.writeFileSync(
      emitBaseline,
      `${JSON.stringify(toBaseline(scoreboard, flag(argv, '--note')), null, 2)}\n`
    );
  }

  process.stdout.write(renderMarkdown(scoreboard, comparison));
  process.stdout.write(`\nscoreboard: ${jsonPath}\n            ${mdPath}\n`);
  if (emitBaseline !== null) {
    process.stdout.write(`  baseline: ${emitBaseline}\n`);
  }

  // A contradiction exits non-zero. It is the one outcome that says the
  // scoreboard's own inputs cannot all be true at once, and a caller that
  // only checks the exit code should still be told.
  process.exit(scoreboard.contradictions.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
