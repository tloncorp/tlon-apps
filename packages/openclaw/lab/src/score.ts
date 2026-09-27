import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadCheckpoint } from './checkpoint.js';
import { REPO_ROOT, loadConfig } from './config.js';
import type { CostMeter } from './openrouter.js';
import { writeRun } from './store.js';
import type { KeepVerdict, RunRecord, RunSetManifest } from './types.js';
import { keepVerdict } from './user.js';

type RunSet = { dir: string; manifest: RunSetManifest; runs: RunRecord[] };

// Code the bot runs from git; a variant changes prompts and skills, not these.
const CODE_PATHS = [
  'packages/openclaw/src',
  'packages/openclaw/index.ts',
  'packages/openclaw/package.json',
  'packages/api/src',
  'desk',
];

/**
 * What differs between two sets besides the variant, so a baseline reused
 * from an earlier round is only trusted when it was run the same way.
 */
export function setupDifferences(a: RunSet, b: RunSet): string[] {
  const found: string[] = [];
  const ma = a.manifest;
  const mb = b.manifest;
  if ((ma.mode ?? 'fast') !== (mb.mode ?? 'fast')) {
    found.push(`mode: ${ma.mode ?? 'fast'} vs ${mb.mode ?? 'fast'}`);
  }
  for (const role of ['bot', 'user'] as const) {
    if (ma.models[role] !== mb.models[role]) {
      found.push(`${role} model: ${ma.models[role]} vs ${mb.models[role]}`);
    }
  }
  if ((ma.search ?? true) !== (mb.search ?? true)) found.push('web search');
  const openclaw = (m: RunSetManifest) =>
    m.deployment?.openclaw.calibrated ?? m.template?.openclaw;
  if (openclaw(ma) !== openclaw(mb)) {
    found.push(`OpenClaw: ${openclaw(ma)} vs ${openclaw(mb)}`);
  }
  if (ma.gitRev !== mb.gitRev) {
    try {
      execFileSync(
        'git',
        [
          '-C',
          REPO_ROOT,
          'diff',
          '--quiet',
          ma.gitRev,
          mb.gitRev,
          '--',
          ...CODE_PATHS,
        ],
        { stdio: 'ignore' }
      );
    } catch {
      found.push(`plugin code: ${ma.gitRev} vs ${mb.gitRev}`);
    }
  }
  // Prompt and skill files neither set overrode with a variant.
  const shared = (m: RunSetManifest) =>
    new Map(
      m.sources
        .filter((source) => !m.variant || !source.path.startsWith(m.variant))
        .map((source) => [path.basename(source.path), source.sha256])
    );
  const sa = shared(ma);
  const sb = shared(mb);
  const overridden = new Set(
    [ma, mb].flatMap((m) =>
      m.sources
        .filter((source) => m.variant && source.path.startsWith(m.variant))
        .map((source) => path.basename(source.path))
    )
  );
  for (const [name, sha] of sa) {
    if (!overridden.has(name) && sb.has(name) && sb.get(name) !== sha) {
      found.push(`${name} differs`);
    }
  }
  return found;
}

/** The survey's own ranking of a run: overall, then the four 1–5 scores. */
function surveyScore(keep: KeepVerdict) {
  const parts = [keep.answered, keep.effort, keep.ending, keep.notes ?? 0];
  return [keep.overall ?? 0, parts.reduce<number>((a, b) => a + (b ?? 0), 0)];
}

export type ScoredPair = {
  key: string;
  a?: KeepVerdict;
  b?: KeepVerdict;
  winner: 'A' | 'B' | 'tie' | 'missing';
};

/**
 * Pair two sets' runs by persona and repeat and pick each pair's winner from
 * the person's survey. Runs graded before the survey get one now, with the
 * set's frozen user model, and are saved.
 */
export async function scoreSets(
  a: RunSet,
  b: RunSet,
  meter: CostMeter,
  /** Survey every run again, not only those without one. */
  fresh = false
): Promise<ScoredPair[]> {
  const key = (run: RunRecord) => `${run.persona.id}.${run.repeat}`;
  const inB = new Set(b.runs.map(key));
  const inBoth = new Set(a.runs.map(key).filter((k) => inB.has(k)));
  for (const set of [a, b]) {
    const models = loadCheckpoint(set.dir, set.manifest)?.models;
    const config = loadConfig(models ? { user: models.user } : {}, {
      search: false,
    });
    const missing = set.runs.filter(
      (run) =>
        inBoth.has(key(run)) &&
        !run.error &&
        (fresh || run.keep?.overall === undefined)
    );
    let next = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < missing.length) {
          const run = missing[next++];
          const survey = await keepVerdict({
            persona: run.persona,
            events: run.transcript,
            secondResult: run.secondResult,
            config,
            meter,
          });
          // Keep the verdict the set was graded with; add the survey.
          run.keep = run.keep
            ? { ...survey, ...run.keep, ...pick(survey) }
            : survey;
          writeRun(set.dir, run);
        }
      })
    );
  }
  const byKey = new Map(b.runs.map((run) => [key(run), run]));
  // A reused base set can cover more personas than the round did.
  const shared = a.runs.filter((run) => byKey.has(key(run)));
  return shared.map((runA) => {
    const runB = byKey.get(key(runA));
    const sa = runA.error ? undefined : runA.keep;
    const sb = runB && !runB.error ? runB.keep : undefined;
    if (sa?.overall === undefined || sb?.overall === undefined) {
      return { key: key(runA), a: sa, b: sb, winner: 'missing' as const };
    }
    const [oa, ta] = surveyScore(sa);
    const [ob, tb] = surveyScore(sb);
    const diff = ob - oa || tb - ta;
    return {
      key: key(runA),
      a: sa,
      b: sb,
      winner:
        diff > 0
          ? ('B' as const)
          : diff < 0
            ? ('A' as const)
            : ('tie' as const),
    };
  });
}

function pick(survey: KeepVerdict) {
  const { answered, effort, ending, notes, overall, worst } = survey;
  return { answered, effort, ending, notes, overall, worst };
}
