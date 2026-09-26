import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { LAB_DIR, PLUGIN_DIR, REPO_ROOT, RUNS_DIR } from './config.js';
import { metrics, renderChat, renderRunDetails } from './report.js';
import type { RunRecord, TranscriptEvent } from './types.js';
import { loadPersonas, loadRunSet } from './store.js';
import { describeVariant, variantOverview } from './changesets.js';
import { renderApp } from './web.js';
import {
  type TipSample,
  createVariant,
  listVariants as workbenchVariants,
  personalizeTipCase,
  previewTips,
  readVariantFile,
  variantFiles,
  writeVariantFile,
} from './workbench.js';

// A small local control panel for the lab: browse run sets, judging folders
// and reports, and start runs, packets and imports as child processes. It
// binds to localhost only and never runs anything but the lab CLI.

const VARIANTS_DIR = path.join(LAB_DIR, 'variants');
const CLI = path.join(LAB_DIR, 'src/cli.ts');
const MAX_LOG_LINES = 600;

type Job = {
  id: number;
  kind: 'run' | 'packets' | 'import';
  title: string;
  args: string[];
  status: 'running' | 'done' | 'failed' | 'stopped';
  exitCode: number | null;
  startedAt: string;
  endedAt?: string;
  log: string[];
  child?: ChildProcess;
};

const jobs: Job[] = [];

function tsxBinary() {
  const candidates = [
    path.join(PLUGIN_DIR, 'node_modules/.bin/tsx'),
    path.join(REPO_ROOT, 'node_modules/.bin/tsx'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('tsx not found; run pnpm install');
  return found;
}

function startJob(kind: Job['kind'], title: string, args: string[]) {
  const job: Job = {
    id: jobs.length + 1,
    kind,
    title,
    args,
    status: 'running',
    exitCode: null,
    startedAt: new Date().toISOString(),
    log: [],
  };
  const child = spawn(tsxBinary(), [CLI, ...args], {
    cwd: PLUGIN_DIR,
    env: process.env,
  });
  job.child = child;
  const append = (chunk: Buffer) => {
    job.log.push(...chunk.toString().split('\n').filter(Boolean));
    if (job.log.length > MAX_LOG_LINES) {
      job.log.splice(0, job.log.length - MAX_LOG_LINES);
    }
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('close', (code) => {
    job.exitCode = code;
    if (job.status === 'running') job.status = code === 0 ? 'done' : 'failed';
    job.endedAt = new Date().toISOString();
    job.child = undefined;
  });
  jobs.push(job);
  return job;
}

function jobView(job: Job, withLog: boolean) {
  const { id, kind, title, args, status, exitCode, startedAt, endedAt, log } =
    job;
  // The CLI prints "Report: <path>" when it writes one; link the newest.
  const report = [...log]
    .reverse()
    .map((line) => /Report: (.+\.html)\s*$/.exec(line)?.[1])
    .find(Boolean);
  const reportPath =
    report && report.startsWith(`${RUNS_DIR}${path.sep}`)
      ? `/files/${path.relative(RUNS_DIR, report).split(path.sep).map(encodeURIComponent).join('/')}`
      : undefined;
  return {
    ...{ id, kind, title, args, status, exitCode, startedAt, endedAt },
    ...(reportPath ? { reportPath } : {}),
    ...(withLog ? { log } : { lastLine: log.at(-1) ?? '' }),
  };
}

/** The live or finished conversation for a test started from the editor. */
function simView(label: string, jobId: number) {
  if (!/^sim-[\w.-]+$/.test(label)) throw new Error('Unknown test');
  const job = jobs.find((entry) => entry.id === jobId);
  const status = job?.status ?? 'done';
  const error = status === 'failed' ? job?.log.slice(-4).join('\n') : undefined;
  const dirName = existsSync(RUNS_DIR)
    ? readdirSync(RUNS_DIR).find((name) => name.endsWith(`-${label}`))
    : undefined;
  if (!dirName) return { status, error, html: '' };
  const dir = path.join(RUNS_DIR, dirName);
  const final = readdirSync(dir).find((name) => /\.1\.json$/.test(name));
  if (final) {
    const run = JSON.parse(
      readFileSync(path.join(dir, final), 'utf8')
    ) as RunRecord;
    return {
      status,
      html: renderRunDetails(run),
      costUsd: run.costUsd,
      durationMs: run.durationMs,
      reportPath: `/files/${encodeURIComponent(dirName)}/report.html`,
    };
  }
  const partial = readdirSync(dir).find((name) =>
    name.endsWith('.partial.json')
  );
  if (!partial) return { status, error, html: '' };
  try {
    const { transcript } = JSON.parse(
      readFileSync(path.join(dir, partial), 'utf8')
    ) as { transcript: TranscriptEvent[] };
    return { status, error, html: renderChat(transcript) };
  } catch {
    // Caught mid-write; the next poll will read it.
    return { status, html: null };
  }
}

function listVariants() {
  return workbenchVariants()
    .map((variant) => variant.name)
    .filter((name) => name !== 'baseline');
}

function summarizeSets() {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter((name) => existsSync(path.join(RUNS_DIR, name, 'manifest.json')))
    .sort()
    .reverse()
    .map((name) => {
      const set = loadRunSet(path.join(RUNS_DIR, name));
      const m = metrics(set.runs);
      return {
        name,
        label: set.manifest.label,
        createdAt: set.manifest.createdAt,
        variant: set.manifest.variant
          ? path.basename(set.manifest.variant)
          : null,
        models: set.manifest.models,
        search: set.manifest.search !== false,
        persona:
          set.manifest.personas.length === 1 ? set.manifest.personas[0] : null,
        gitRev: set.manifest.gitRev,
        expected: set.manifest.personas.length * set.manifest.repeat,
        runs: set.runs.length,
        errors: set.runs.filter((run) => run.error).length,
        judged: set.runs.filter((run) => run.judgement).length,
        metrics: m,
        hasReport: existsSync(path.join(RUNS_DIR, name, 'report.html')),
      };
    });
}

function summarizeJudging() {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter(
      (name) =>
        name.startsWith('judging-') &&
        statSync(path.join(RUNS_DIR, name)).isDirectory()
    )
    .sort()
    .reverse()
    .map((name) => {
      const dir = path.join(RUNS_DIR, name);
      const files = readdirSync(dir);
      const mappingFile = existsSync(`${dir}.mapping.json`)
        ? `${dir}.mapping.json`
        : path.join(dir, 'mapping.json');
      let sets: string[] = [];
      try {
        const mapping = JSON.parse(readFileSync(mappingFile, 'utf8')) as {
          sets?: string[];
          setA?: string;
          setB?: string;
        };
        sets = (mapping.sets ?? [mapping.setA!, mapping.setB!]).map((set) =>
          path.basename(set)
        );
      } catch {
        // A folder without a mapping is still listed so it can be cleaned up.
      }
      return {
        name,
        sets,
        packets: files.filter((file) => /\.\d+\.md$/.test(file)).length,
        verdicts: files.filter((file) => /\.\d+\.json$/.test(file)).length,
        reports: files.filter(
          (file) => file.startsWith('compare') && file.endsWith('.html')
        ),
      };
    });
}

function modelComparisons() {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR)
    .filter((name) => name.startsWith('compare-') && name.endsWith('.html'))
    .sort()
    .reverse();
}

async function readBody(request: http.IncomingMessage) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new Error('request too large');
  }
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

function send(
  response: http.ServerResponse,
  status: number,
  body: string,
  type = 'application/json'
) {
  response.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

const json = (response: http.ServerResponse, status: number, value: unknown) =>
  send(response, status, JSON.stringify(value));

/** The folder name of a run set or judging folder inside runs/, or an error. */
function runsEntry(name: unknown) {
  const value = String(name ?? '');
  if (!/^[\w.-]+$/.test(value) || !existsSync(path.join(RUNS_DIR, value))) {
    throw new Error(`unknown run folder: ${value}`);
  }
  return value;
}

function runArgs(body: Record<string, unknown>) {
  const args = ['run', '--no-judge'];
  const variant = String(body.variant ?? '');
  if (variant && variant !== 'baseline') {
    if (!listVariants().includes(variant)) {
      throw new Error(`unknown variant: ${variant}`);
    }
    args.push('--variant', path.join(VARIANTS_DIR, variant));
  }
  if (body.judge === 'model') args.splice(args.indexOf('--no-judge'), 1);
  const known = new Set(loadPersonas().map((persona) => persona.id));
  const personas = Array.isArray(body.personas)
    ? body.personas.map(String).filter((id) => known.has(id))
    : [];
  if (personas.length && personas.length < known.size) {
    args.push('--personas', personas.join(','));
  }
  const repeat = Math.min(Math.max(Number(body.repeat) || 1, 1), 5);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 4, 1), 8);
  args.push('--repeat', String(repeat), '--concurrency', String(concurrency));
  const tips = Number(body.tips ?? 0);
  if (!Number.isInteger(tips) || tips < 0 || tips > 5)
    throw new Error('tips must be an integer from 0 through 5');
  args.push('--tips', String(tips));
  if (body.search === false) args.push('--no-search');
  const label = String(body.label ?? '').trim();
  if (label) {
    if (!/^[\w.-]{1,40}$/.test(label))
      throw new Error('label: letters, numbers, . _ - only');
    args.push('--label', label);
  }
  return args;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.md': 'text/markdown',
};

async function handle(
  request: http.IncomingMessage,
  response: http.ServerResponse
) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const method = request.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/') {
    return send(response, 200, renderApp(), 'text/html');
  }
  if (method === 'GET' && url.pathname === '/api/state') {
    return json(response, 200, {
      sets: summarizeSets(),
      judging: summarizeJudging(),
      modelComparisons: modelComparisons(),
      variants: ['baseline', ...listVariants()],
      personas: loadPersonas().map(({ id, wants, expectPlan, opening }) => ({
        id,
        wants,
        expectPlan,
        blank: !opening,
      })),
      jobs: [...jobs].reverse().map((job) => jobView(job, false)),
    });
  }
  const jobMatch = /^\/api\/jobs\/(\d+)(\/stop)?$/.exec(url.pathname);
  if (jobMatch) {
    const job = jobs.find((entry) => entry.id === Number(jobMatch[1]));
    if (!job) return json(response, 404, { error: 'no such job' });
    if (method === 'POST' && jobMatch[2]) {
      if (job.child) {
        job.status = 'stopped';
        job.child.kill('SIGTERM');
      }
      return json(response, 200, jobView(job, true));
    }
    return json(response, 200, jobView(job, true));
  }
  if (method === 'GET' && url.pathname === '/api/variants') {
    return json(response, 200, workbenchVariants());
  }
  if (method === 'GET' && url.pathname === '/api/variants/overview') {
    return json(response, 200, variantOverview());
  }
  if (method === 'POST' && url.pathname === '/api/variants/describe') {
    const body = await readBody(request);
    return json(
      response,
      200,
      await describeVariant(String(body.name ?? ''), body.force === true)
    );
  }
  if (method === 'GET' && url.pathname === '/api/variants/files') {
    return json(
      response,
      200,
      variantFiles(url.searchParams.get('variant') ?? '')
    );
  }
  if (method === 'GET' && url.pathname === '/api/variants/file') {
    return json(
      response,
      200,
      readVariantFile(
        url.searchParams.get('variant') ?? '',
        url.searchParams.get('file') ?? ''
      )
    );
  }
  if (method === 'PUT' && url.pathname === '/api/variants/file') {
    const body = await readBody(request);
    writeVariantFile(
      String(body.variant ?? ''),
      String(body.file ?? ''),
      String(body.text ?? '')
    );
    return json(response, 200, { ok: true });
  }
  if (method === 'POST' && url.pathname === '/api/variants') {
    const body = await readBody(request);
    return json(
      response,
      200,
      createVariant(String(body.name ?? ''), String(body.from ?? 'baseline'))
    );
  }
  if (method === 'POST' && url.pathname === '/api/tips/preview') {
    const body = await readBody(request);
    return json(response, 200, {
      cases: previewTips(
        String(body.yaml ?? ''),
        (body.sample ?? {}) as TipSample
      ),
    });
  }
  if (method === 'POST' && url.pathname === '/api/tips/personalize') {
    const body = await readBody(request);
    return json(
      response,
      200,
      await personalizeTipCase(
        String(body.yaml ?? ''),
        (body.sample ?? {}) as TipSample,
        String(body.id ?? '')
      )
    );
  }
  if (method === 'POST' && url.pathname === '/api/sim') {
    const body = await readBody(request);
    const variant = String(body.variant ?? 'baseline');
    const label = `sim-${variant.slice(0, 24)}-${Date.now().toString(36)}`;
    const args = runArgs({
      variant,
      personas: [String(body.persona ?? '')],
      repeat: 1,
      concurrency: 1,
      tips: Number(body.tips ?? 0),
      search: body.search === true,
      judge: 'claude',
      label,
    });
    if (!args.includes('--personas')) throw new Error('Pick one persona');
    const job = startJob(
      'run',
      `Test ${variant} · ${String(body.persona)}`,
      args
    );
    return json(response, 200, { job: jobView(job, false), label });
  }
  if (method === 'GET' && url.pathname === '/api/sim') {
    return json(
      response,
      200,
      simView(
        url.searchParams.get('label') ?? '',
        Number(url.searchParams.get('job'))
      )
    );
  }
  if (method === 'POST' && url.pathname === '/api/runs') {
    const body = await readBody(request);
    const args = runArgs(body);
    const variant = String(body.variant || 'baseline');
    return json(
      response,
      200,
      jobView(startJob('run', `Run ${variant}`, args), false)
    );
  }
  if (method === 'POST' && url.pathname === '/api/packets') {
    const body = await readBody(request);
    const sets = Array.isArray(body.sets) ? body.sets.map(runsEntry) : [];
    if (sets.length < 2 || sets.length > 4) {
      throw new Error('pick 2 to 4 run sets; the first is the control');
    }
    return json(
      response,
      200,
      jobView(
        startJob('packets', `Packets: ${sets.join(' vs ')}`, [
          'packets',
          ...sets.map((set) => path.join(RUNS_DIR, set)),
        ]),
        false
      )
    );
  }
  if (method === 'POST' && url.pathname === '/api/import') {
    const body = await readBody(request);
    const dir = runsEntry(body.dir);
    return json(
      response,
      200,
      jobView(
        startJob('import', `Import ${dir}`, [
          'import',
          path.join(RUNS_DIR, dir),
        ]),
        false
      )
    );
  }
  if (method === 'GET' && url.pathname.startsWith('/files/')) {
    const relative = decodeURIComponent(url.pathname.slice('/files/'.length));
    const target = path.resolve(RUNS_DIR, relative);
    const type = CONTENT_TYPES[path.extname(target)];
    if (
      !target.startsWith(`${RUNS_DIR}${path.sep}`) ||
      !type ||
      !existsSync(target)
    ) {
      return send(response, 404, 'Not found', 'text/plain');
    }
    return send(response, 200, readFileSync(target, 'utf8'), type);
  }
  return send(response, 404, 'Not found', 'text/plain');
}

export function serve(port: number) {
  const server = http.createServer((request, response) => {
    handle(request, response).catch((error: unknown) =>
      json(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Onboarding lab: http://localhost:${port}`);
  });
  const shutdown = () => {
    for (const job of jobs) job.child?.kill('SIGTERM');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
