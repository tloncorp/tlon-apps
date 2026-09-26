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
import { LabStack } from './stack.js';
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

/** Run each job, one at a time, against the lab's sandbox stack. */
export async function runRealSet(input: {
  dir: string;
  jobs: { persona: Persona; repeat: number }[];
  config: LabConfig;
  sources: PromptSources;
  agent: DeployedAgent | undefined;
  maxTurns: number;
  judge: boolean;
  checkpoint: Pick<
    PromptCheckpoint,
    'rubric' | 'simulatorPolicy' | 'keepPolicy'
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
  const proxy = new ModelProxy(Number(process.env.LAB_PROXY_PORT ?? 48790));
  await proxy.start();
  try {
    const stack = new LabStack(config.tlonbotDir);
    console.log(`Preparing the sandbox on plugin ${ref.slice(0, 10)}…`);
    await stack.up(
      ref,
      input.agent,
      proxy.port,
      Boolean(config.braveKey),
      false
    );
    stack.applySkills(sources);
    const runs: RunRecord[] = [];
    // What the workspace holds once OpenClaw has set it up for a run.
    let workspaceFiles: string[] | undefined;
    for (const job of input.jobs) {
      const stem = path.join(input.dir, `${job.persona.id}.${job.repeat}`);
      const { exchanges, ...run } = await runRealPersona({
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
        onProgress: (transcript) =>
          writeFileSync(
            `${stem}.partial.json`,
            JSON.stringify({ persona: job.persona.id, transcript })
          ),
      });
      writeRun(input.dir, run);
      // Every model request and reply, exactly as OpenClaw sent them.
      writeFileSync(`${stem}.model.json`, JSON.stringify(exchanges));
      rmSync(`${stem}.partial.json`, { force: true });
      input.onRun?.(run);
      runs.push(run);
      workspaceFiles ??= stack.workspaceFiles();
    }
    calibrate({
      dir: input.dir,
      runs,
      stack,
      sources,
      ref,
      workspaceFiles: (workspaceFiles ?? []).filter(
        (name) => name in sources.prompts || name === 'HEARTBEAT.md'
      ),
    });
    return runs;
  } finally {
    await proxy.stop();
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
