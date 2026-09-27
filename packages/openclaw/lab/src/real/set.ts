import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PromptCheckpoint } from '../checkpoint.js';
import { type LabConfig, type PromptSources, REPO_ROOT } from '../config.js';
import type { DeployedAgent } from '../deployed.js';
import { writeRun } from '../store.js';
import type { Persona, RunRecord } from '../types.js';
import { type ModelExchange, ModelProxy } from './proxy.js';
import { runRealPersona } from './runner.js';
import { LabStack, labStackOptions } from './stack.js';
import {
  extractTemplate,
  renderLikeSandbox,
  writeTemplate,
} from '../template.js';

// Code the sandbox loads from git: uncommitted edits here would silently not
// be what the real bot runs.
const COMMITTED_PATHS = [
  'packages/openclaw/src',
  'packages/openclaw/skills',
  'packages/openclaw/index.ts',
  'packages/openclaw/package.json',
  'packages/api/src',
  'desk',
];

/**
 * Run each job against the lab's sandbox stacks: one at a time per sandbox,
 * with `sandboxes` of them taking the next job as they finish.
 */
export async function runRealSet(input: {
  dir: string;
  jobs: { persona: Persona; repeat: number }[];
  sandboxes?: number;
  config: LabConfig;
  sources: PromptSources;
  agent: DeployedAgent | undefined;
  maxTurns: number;
  judge: boolean;
  checkpoint: Partial<
    Pick<
      PromptCheckpoint,
      'rubric' | 'simulatorPolicy' | 'keepPolicy' | 'doubleTextRate'
    >
  >;
  onRun?: (run: RunRecord) => void;
}): Promise<RunRecord[]> {
  const { config, sources } = input;
  if (sources.coordinator || sources.tipCopy) {
    throw new Error(
      'coordinator.yaml and tips.yaml overrides only apply in the fast lab; the real plugin has no hook for them'
    );
  }
  const dirty = execFileSync(
    'git',
    ['-C', REPO_ROOT, 'status', '--porcelain', '--', ...COMMITTED_PATHS],
    { encoding: 'utf8' }
  ).trim();
  if (dirty) {
    throw new Error(
      `Commit these first; the sandbox loads committed code:\n${dirty}`
    );
  }
  const ref = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  // A proxy records one run at a time, so each sandbox gets its own.
  const proxyPort = Number(process.env.LAB_PROXY_PORT ?? 48790);
  const lanes = Array.from(
    { length: Math.max(1, input.sandboxes ?? 1) },
    (_, index) => ({
      index,
      stack: new LabStack(config.tlonbotDir, labStackOptions(index)),
      proxy: new ModelProxy(proxyPort + index),
    })
  );
  for (const lane of lanes) await lane.proxy.start();
  // Urbit clients keep event streams open in the background; when a reset
  // restarts a ship agent those streams reject with nobody awaiting them.
  // Anything else still ends the set.
  const onRejection = (reason: unknown) => {
    const message = String((reason as Error)?.message ?? reason);
    const cause = String((reason as { cause?: Error })?.cause?.message ?? '');
    if (
      /fetch failed|other side closed|ECONNRESET|socket/i.test(
        `${message} ${cause}`
      )
    ) {
      console.warn(
        `Ignored a dropped ship connection: ${message} ${cause}`.trim()
      );
      return;
    }
    throw reason;
  };
  process.on('unhandledRejection', onRejection);
  try {
    for (const { stack, proxy } of lanes) {
      console.log(`Preparing ${stack.project} on plugin ${ref.slice(0, 10)}…`);
      await stack.up(
        ref,
        input.agent,
        proxy.port,
        Boolean(config.braveKey),
        false
      );
      stack.applySkills(sources);
    }
    const runs: RunRecord[] = [];
    // What the workspace holds once OpenClaw has set it up for a run.
    let workspaceFiles: string[] | undefined;
    let next = 0;
    await Promise.all(
      lanes.map(async ({ index, stack, proxy }) => {
        while (next < input.jobs.length) {
          const job = input.jobs[next++];
          const stem = path.join(input.dir, `${job.persona.id}.${job.repeat}`);
          const { exchanges, ...result } = await runRealPersona({
            ...job,
            config,
            sources,
            maxTurns: input.maxTurns,
            judge: input.judge,
            stack,
            proxy,
            rubric: input.checkpoint.rubric,
            simulatorPolicy: input.checkpoint.simulatorPolicy,
            keepPolicy: input.checkpoint.keepPolicy,
            doubleTextRate: input.checkpoint.doubleTextRate,
            onProgress: (transcript) =>
              writeFileSync(
                `${stem}.partial.json`,
                JSON.stringify({ persona: job.persona.id, transcript })
              ),
          });
          const run = lanes.length > 1 ? { ...result, sandbox: index } : result;
          writeRun(input.dir, run);
          // Every model request and reply, exactly as OpenClaw sent them.
          writeFileSync(`${stem}.model.json`, JSON.stringify(exchanges));
          rmSync(`${stem}.partial.json`, { force: true });
          input.onRun?.(run);
          runs.push(run);
          workspaceFiles ??= stack.workspaceFiles();
        }
      })
    );
    const order = (run: RunRecord) =>
      input.jobs.findIndex(
        (job) => job.persona.id === run.persona.id && job.repeat === run.repeat
      );
    runs.sort((a, b) => order(a) - order(b));
    calibrate({
      dir: input.dir,
      runs,
      stack: lanes[0].stack,
      sources,
      ref,
      workspaceFiles: (workspaceFiles ?? []).filter(
        (name) => name in sources.prompts || name === 'HEARTBEAT.md'
      ),
    });
    return runs;
  } finally {
    process.off('unhandledRejection', onRejection);
    for (const lane of lanes) await lane.proxy.stop();
  }
}

/**
 * Refresh the fast lab's calibration template from this set's captured
 * traffic, so fast runs keep matching what OpenClaw actually sends.
 */
export function calibrate(input: {
  dir: string;
  runs: RunRecord[];
  stack: LabStack;
  sources: PromptSources;
  ref: string;
  workspaceFiles: string[];
}) {
  const perRun = input.runs.map((run) => {
    const file = path.join(
      input.dir,
      `${run.persona.id}.${run.repeat}.model.json`
    );
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as ModelExchange[])
      : [];
  });
  const exchanges = perRun.flat();
  if (!exchanges.length) return;
  const substitutions = input.stack.substitutions();
  try {
    const template = extractTemplate({
      exchanges,
      rendered: Object.fromEntries(
        Object.entries(input.sources.prompts).map(([name, file]) => [
          name,
          renderLikeSandbox(file.text, { substitutions }),
        ])
      ),
      workspaceFiles: input.workspaceFiles,
      substitutions,
      sources: input.sources,
      openclaw: input.stack.openclawVersion(),
      pluginCommit: input.ref,
      capturedFrom: path.basename(input.dir),
    });
    const file = writeTemplate(template);
    console.log(
      file
        ? `Calibrated fast mode${template.cron ? ' (with the scheduled run)' : ''}: ${file}`
        : 'Fast mode calibration unchanged.'
    );
  } catch (error) {
    console.warn(
      `Could not calibrate fast mode: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
