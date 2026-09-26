import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  loadConfig,
  loadPromptSources,
  REPO_ROOT,
  RUNS_DIR,
  sha256,
} from './config.js';
import { judgePair } from './judge.js';
import { type CostMeter, OutOfCreditError } from './openrouter.js';
import {
  type ComparePair,
  metrics,
  renderCompareReport,
  renderRunSetReport,
} from './report.js';
import { importVerdicts, listPackets, writePackets } from './packets.js';
import { gradeRun, runPersona } from './runner.js';
import {
  createRunSet,
  loadPersonas,
  loadRunSet,
  resolveRunSet,
  writeRun,
} from './store.js';
import type { RunRecord } from './types.js';

const USAGE = `Onboarding lab: simulated users against the real onboarding skill and tools.

  pnpm lab run [options]            run personas and grade them
  pnpm lab ab --variant <dir> [...]  run baseline and a variant, then compare
  pnpm lab compare <setA> <setB>     judge two existing run sets side by side (judge model)
  pnpm lab packets <setA> <setB>     write judging packets for a Claude session to judge
  pnpm lab import <judging-dir>      fold packet verdicts into both sets and render reports
  pnpm lab report <set>              re-render a run set's report
  pnpm lab personas                  list persona cards

Options:
  --personas a,b      persona ids (default: all)
  --repeat N          runs per persona (default: 1 for run, 3 for ab)
  --variant DIR       folder of edited SKILL.md and/or tlonbot prompt files
  --label NAME        run set name (default: baseline or the variant folder)
  --concurrency N     personas in flight at once (default: 4)
  --max-turns N       user messages before giving up (default: 8)
  --bot-model ID      OpenRouter model for the bot
  --user-model ID     OpenRouter model for the simulated person
  --judge-model ID    OpenRouter model for the judge
  --no-judge          skip the judge (facts and keep verdict only)
  --no-search         run without web search (the bot sees it as unavailable)
  --resume SET        fill in a set's missing or failed runs instead of starting a new one
`;

async function pool<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    })
  );
  return results;
}

function progressLine(run: RunRecord) {
  const j = run.judgement;
  const status = run.error ? '✗' : '✓';
  return `${status} ${run.persona.id} #${run.repeat}  ending=${run.facts.ending}  matched=${j ? (j.outcome.matched ? 'yes' : 'no') : '-'}  conv=${j?.conversation.score ?? '-'}  result=${j?.result.score ?? '-'}  keep=${run.keep ? (run.keep.keep ? 'yes' : 'no') : '-'}  $${run.costUsd.toFixed(3)}  ${(run.durationMs / 1000).toFixed(0)}s${run.error ? `  (${run.error})` : ''}`;
}

type Options = {
  personas?: string;
  repeat?: string;
  variant?: string;
  label?: string;
  concurrency?: string;
  'max-turns'?: string;
  'bot-model'?: string;
  'user-model'?: string;
  'judge-model'?: string;
  'no-judge'?: boolean;
  'no-search'?: boolean;
  resume?: string;
};

async function runSet(
  options: Options,
  defaults: { repeat: number; label?: string }
) {
  const config = loadConfig(
    {
      bot: options['bot-model'],
      user: options['user-model'],
      judge: options['judge-model'],
    },
    { search: !options['no-search'] }
  );
  const variant = options.variant ? path.resolve(options.variant) : undefined;
  const sources = loadPromptSources(config, variant);
  const personas = loadPersonas(
    options.personas
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const repeat = Number(options.repeat ?? defaults.repeat);
  const label =
    defaults.label ??
    options.label ??
    (variant ? path.basename(variant) : 'baseline');
  const { dir, manifest } = createRunSet({
    label,
    config,
    sources,
    variant,
    personas,
    repeat,
  });
  console.log(
    `${label}: ${personas.length} personas × ${repeat} · bot ${config.models.bot} · prompts from ${config.tlonbotDir}${config.braveKey ? '' : ' · web search off'}`
  );
  const jobs = personas.flatMap((persona) =>
    Array.from({ length: repeat }, (_, index) => ({
      persona,
      repeat: index + 1,
    }))
  );
  const runs = await pool(
    jobs,
    Number(options.concurrency ?? 4),
    async (job) => {
      const run = await runPersona({
        ...job,
        config,
        sources,
        maxTurns: Number(options['max-turns'] ?? 8),
        judge: !options['no-judge'],
      });
      writeRun(dir, run);
      console.log(progressLine(run));
      return run;
    }
  );
  const reportPath = path.join(dir, 'report.html');
  writeFileSync(reportPath, renderRunSetReport(manifest, runs));
  const m = metrics(runs);
  console.log(
    `\n${label}: matched ${m.outcomeMatched === null ? '-' : `${Math.round(m.outcomeMatched * 100)}%`} · conversation ${m.conversation?.toFixed(2) ?? '-'} · result ${m.result?.toFixed(2) ?? '-'} · keep ${m.keep === null ? '-' : `${Math.round(m.keep * 100)}%`} · $${m.costUsd.toFixed(2)}\nReport: ${reportPath}`
  );
  return dir;
}

/**
 * Fill in a run set: rerun runs that are missing or crashed, and re-grade runs
 * whose conversation finished but grading failed. Refuses when the skill or
 * prompts changed since the set was created, so a set never mixes versions.
 */
async function resumeSet(reference: string, options: Options) {
  const set = loadRunSet(resolveRunSet(reference));
  const { manifest } = set;
  const config = {
    ...loadConfig({}, { search: manifest.search !== false }),
    models: manifest.models,
  };
  const sources = loadPromptSources(config, manifest.variant);
  const current = new Map(
    [...sources.skills, ...Object.values(sources.prompts)].map((file) => [
      file.path,
      sha256(file.text),
    ])
  );
  const changed = manifest.sources.filter(
    (source) =>
      current.get(path.resolve(REPO_ROOT, source.path)) !== source.sha256 &&
      current.get(source.path) !== source.sha256
  );
  if (changed.length) {
    throw new Error(
      `Sources changed since this set was created, so resuming would mix versions: ${changed.map((source) => source.path).join(', ')}`
    );
  }
  const personas = loadPersonas(manifest.personas);
  const existing = new Map(
    set.runs.map((run) => [`${run.persona.id}#${run.repeat}`, run])
  );
  const jobs = personas.flatMap((persona) =>
    Array.from({ length: manifest.repeat }, (_, index) => {
      const run = existing.get(`${persona.id}#${index + 1}`);
      const judged = Boolean(run?.judgement) || options['no-judge'];
      if (run && !run.error && judged) return [];
      const regrade = Boolean(run && run.facts.ending !== 'bot-error');
      return [{ persona, repeat: index + 1, run: regrade ? run : undefined }];
    }).flat()
  );
  console.log(
    `${manifest.label}: ${jobs.length} runs to fill (${jobs.filter((job) => job.run).length} re-grade only)`
  );
  await pool(jobs, Number(options.concurrency ?? 4), async (job) => {
    let run: RunRecord;
    if (job.run) {
      run = job.run;
      const meter: CostMeter = { usd: 0 };
      await gradeRun({
        record: run,
        config,
        sources,
        judge: !options['no-judge'],
        meter,
      });
      run.costUsd += meter.usd;
    } else {
      run = await runPersona({
        persona: job.persona,
        repeat: job.repeat,
        config,
        sources,
        maxTurns: Number(options['max-turns'] ?? 8),
        judge: !options['no-judge'],
      });
    }
    writeRun(set.dir, run);
    console.log(progressLine(run));
  });
  const runs = loadRunSet(set.dir).runs;
  const reportPath = path.join(set.dir, 'report.html');
  writeFileSync(reportPath, renderRunSetReport(manifest, runs));
  console.log(`Report: ${reportPath}`);
}

async function compare(aRef: string, bRef: string, judgeModel?: string) {
  const config = loadConfig({ judge: judgeModel });
  const a = loadRunSet(resolveRunSet(aRef));
  const b = loadRunSet(resolveRunSet(bRef));
  const key = (run: RunRecord) => `${run.persona.id}#${run.repeat}`;
  const byKey = new Map(b.runs.map((run) => [key(run), run]));
  const matched = a.runs
    .filter(
      (run) => byKey.has(key(run)) && !run.error && !byKey.get(key(run))!.error
    )
    .map((run) => ({ a: run, b: byKey.get(key(run))! }));
  if (!matched.length)
    throw new Error('The two run sets share no completed persona runs.');
  const meter: CostMeter = { usd: 0 };
  console.log(`Judging ${matched.length} pairs side by side…`);
  const pairs = await pool(matched, 4, async ({ a: runA, b: runB }) => {
    // Shuffle order so the judge's position bias does not favor either set.
    const flip = Math.random() < 0.5;
    const verdict = await judgePair({
      a: flip ? runB : runA,
      b: flip ? runA : runB,
      config,
      meter,
    });
    const winner =
      verdict.winner === 'tie'
        ? 'tie'
        : (verdict.winner === 'A') !== flip
          ? 'A'
          : 'B';
    return {
      persona: runA.persona.id,
      repeat: runA.repeat,
      a: runA,
      b: runB,
      verdict: { winner, why: verdict.why },
    } satisfies ComparePair;
  });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const reportPath = path.join(
    RUNS_DIR,
    `compare-${stamp}-${a.manifest.label}-vs-${b.manifest.label}.html`.replace(
      /[^a-z0-9.-]+/gi,
      '-'
    )
  );
  writeFileSync(reportPath, renderCompareReport({ a, b, pairs }));
  const wins = { A: 0, B: 0, tie: 0 };
  for (const pair of pairs) wins[pair.verdict.winner]++;
  console.log(
    `${b.manifest.label} won ${wins.B}, ${a.manifest.label} won ${wins.A}, ${wins.tie} ties · judging cost $${meter.usd.toFixed(2)}\nReport: ${reportPath}`
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      personas: { type: 'string' },
      repeat: { type: 'string' },
      variant: { type: 'string' },
      label: { type: 'string' },
      concurrency: { type: 'string' },
      'max-turns': { type: 'string' },
      'bot-model': { type: 'string' },
      'user-model': { type: 'string' },
      'judge-model': { type: 'string' },
      'no-judge': { type: 'boolean' },
      'no-search': { type: 'boolean' },
      resume: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, ...rest] = positionals;
  if (!command || values.help) {
    console.log(USAGE);
    return;
  }
  switch (command) {
    case 'run':
      if (values.resume) await resumeSet(values.resume, values);
      else await runSet(values, { repeat: 1 });
      return;
    case 'ab': {
      if (!values.variant) throw new Error('ab needs --variant <dir>');
      const baseline = await runSet(
        { ...values, variant: undefined },
        {
          repeat: 3,
          label: 'baseline',
        }
      );
      const candidate = await runSet(values, { repeat: 3 });
      await compare(baseline, candidate, values['judge-model']);
      return;
    }
    case 'compare':
      if (rest.length !== 2) throw new Error('compare needs two run sets');
      await compare(rest[0], rest[1], values['judge-model']);
      return;
    case 'packets': {
      if (rest.length !== 2) throw new Error('packets needs two run sets');
      const { dir, count } = writePackets(
        loadConfig(),
        resolveRunSet(rest[0]),
        resolveRunSet(rest[1])
      );
      console.log(
        `${count} packets in ${dir}\nInstructions: ${path.join(dir, 'INSTRUCTIONS.md')}`
      );
      for (const file of listPackets(dir)) console.log(file);
      return;
    }
    case 'import': {
      const { reportPath, pairs, missing, labels } = importVerdicts(
        path.resolve(rest[0] ?? '')
      );
      const wins = { A: 0, B: 0, tie: 0 };
      for (const pair of pairs) wins[pair.verdict.winner]++;
      console.log(
        `${labels[1]} won ${wins.B}, ${labels[0]} won ${wins.A}, ${wins.tie} ties${missing.length ? ` · ${missing.length} packets without a verdict: ${missing.join(', ')}` : ''}\nReport: ${reportPath}`
      );
      return;
    }
    case 'report': {
      const set = loadRunSet(resolveRunSet(rest[0] ?? ''));
      const reportPath = path.join(set.dir, 'report.html');
      writeFileSync(reportPath, renderRunSetReport(set.manifest, set.runs));
      console.log(`Report: ${reportPath}`);
      return;
    }
    case 'personas':
      for (const persona of loadPersonas()) {
        console.log(
          `${persona.id.padEnd(22)} expectPlan=${persona.expectPlan.padEnd(6)} ${persona.wants}`
        );
      }
      return;
    default:
      throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof OutOfCreditError) {
    console.error(
      'Finished runs are saved. Add credit or quota, then continue with --resume <set>.'
    );
  }
  process.exitCode = 1;
});
