import type {
  DriverName,
  ExecResult,
  RuntimeContext,
} from '../../drivers/types.js';
import {
  execInContainer,
  resolveComposeContainer,
} from '../../runtime/docker-direct.js';
import { sleep } from '../../runtime/waiters.js';

const POLL_INTERVAL_MS = 500;
export const CRON_TEARDOWN_TIMEOUT_MS = 35_000;
export const CRON_TEARDOWN_CREATION_SETTLE_WAIT_MS = 10_000;
export const CRON_TEARDOWN_LATE_CAPTURE_WAIT_MS = 10_000;
export const CRON_TEARDOWN_COMMAND_TIMEOUT_MS = 10_000;

export interface CronJobSnapshot {
  id: string;
  name: string;
}

export interface CronCleanupTarget {
  name: string;
  id?: string;
  creationSettled: Promise<void>;
}

export interface CronCleanupOptions {
  timeoutMs?: number;
  creationSettleWaitMs?: number;
  lateCaptureWaitMs?: number;
  commandTimeoutMs?: number;
}

export interface CronCommandScope {
  containerId: string;
  deadlineAtMs: number;
  commandTimeoutMs: number;
}

/**
 * Observe both creation branches before choosing an error. Prompt rejection is
 * intentionally the primary failure because it is the more actionable error
 * when both branches fail independently.
 */
export async function settleCronJobCreation<T>(
  target: CronCleanupTarget,
  promptPromise: Promise<T>,
  jobPromise: Promise<CronJobSnapshot>
): Promise<[T, CronJobSnapshot]> {
  const outcomes = Promise.allSettled([promptPromise, jobPromise]);
  target.creationSettled = outcomes.then(() => undefined);
  const [promptOutcome, jobOutcome] = await outcomes;

  if (promptOutcome.status === 'rejected') {
    const cause =
      jobOutcome.status === 'rejected'
        ? new Error(
            `cron job lookup failed: ${errorMessage(jobOutcome.reason)}`
          )
        : undefined;
    throw new Error(
      `cron creation prompt failed: ${errorMessage(promptOutcome.reason)}`,
      cause ? { cause } : undefined
    );
  }
  if (jobOutcome.status === 'rejected') {
    throw new Error(
      `cron job lookup failed: ${errorMessage(jobOutcome.reason)}`
    );
  }
  return [promptOutcome.value, jobOutcome.value];
}

export async function listCronJobs(
  ctx: RuntimeContext,
  driverName: DriverName,
  scope: CronCommandScope
): Promise<CronJobSnapshot[]> {
  if (driverName === 'openclaw') {
    const result = await execScoped(
      ctx,
      scope,
      'list OpenClaw cron jobs',
      (timeoutMs) => [
        'openclaw',
        'cron',
        'list',
        '--all',
        '--json',
        '--timeout',
        String(timeoutMs),
      ]
    );
    requireSuccess(result, 'list OpenClaw cron jobs');
    const parsed = parseJson(result.stdout, 'OpenClaw cron list');
    if (!isRecord(parsed) || !Array.isArray(parsed.jobs)) {
      throw new Error(
        'OpenClaw cron list must return a JSON object with a jobs array.'
      );
    }
    return parsed.jobs.map((job, index) =>
      parseJob(job, `OpenClaw jobs[${index}]`)
    );
  }

  const result = await execScoped(ctx, scope, 'list Hermes cron jobs', () => [
    'python3',
    '-c',
    String.raw`
import json
from cron.jobs import list_jobs

print(json.dumps([{"id": job["id"], "name": job.get("name", "")} for job in list_jobs(include_disabled=True)]))
`,
  ]);
  requireSuccess(result, 'list Hermes cron jobs');
  const parsed = parseJson(result.stdout, 'Hermes cron list');
  if (!Array.isArray(parsed)) {
    throw new Error('Hermes cron list must return a JSON array.');
  }
  return parsed.map((job, index) => parseJob(job, `Hermes jobs[${index}]`));
}

export async function waitForCronJobCreated(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobName: string,
  timeoutMs: number
): Promise<CronJobSnapshot> {
  const deadlineAtMs = Date.now() + timeoutMs;
  const scope = await createCronCommandScope(ctx, deadlineAtMs);
  for (;;) {
    const jobs = await listCronJobs(ctx, driverName, scope);
    const matches = jobs.filter((job) => job.name === jobName);
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(
        `Expected exactly one cron job named ${JSON.stringify(jobName)}, found ${matches.length}.`
      );
    }
    await sleepUntilNextPoll(
      deadlineAtMs,
      `cron job ${jobName} creation`,
      timeoutMs
    );
  }
}

export async function waitForCronJobRemoved(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobId: string,
  timeoutMs = 15_000
): Promise<void> {
  const deadlineAtMs = Date.now() + timeoutMs;
  const scope = await createCronCommandScope(ctx, deadlineAtMs);
  for (;;) {
    const jobs = await listCronJobs(ctx, driverName, scope);
    if (!jobs.some((job) => job.id === jobId)) {
      return;
    }
    await sleepUntilNextPoll(
      deadlineAtMs,
      `cron job ${jobId} removal`,
      timeoutMs
    );
  }
}

export async function cleanupCronJobAndArtifacts(
  ctx: RuntimeContext,
  driverName: DriverName,
  target: CronCleanupTarget,
  opts: CronCleanupOptions = {}
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? CRON_TEARDOWN_TIMEOUT_MS;
  const creationSettleWaitMs =
    opts.creationSettleWaitMs ?? CRON_TEARDOWN_CREATION_SETTLE_WAIT_MS;
  const lateCaptureWaitMs =
    opts.lateCaptureWaitMs ?? CRON_TEARDOWN_LATE_CAPTURE_WAIT_MS;
  const commandTimeoutMs =
    opts.commandTimeoutMs ?? CRON_TEARDOWN_COMMAND_TIMEOUT_MS;
  const deadlineAtMs = Date.now() + timeoutMs;

  await waitForCreationSettled(
    target.creationSettled,
    Math.min(
      creationSettleWaitMs,
      remainingMs(deadlineAtMs, 'wait for cron creation')
    )
  );
  const scope = await createCronCommandScope(
    ctx,
    deadlineAtMs,
    commandTimeoutMs
  );
  const jobId =
    target.id ??
    (await captureCronJobIdForCleanup(
      ctx,
      driverName,
      target,
      scope,
      lateCaptureWaitMs
    ));

  if (!jobId) {
    const jobs = await listCronJobs(ctx, driverName, scope);
    if (target.id || jobs.some((job) => job.name === target.name)) {
      throw new Error(
        `Cron cleanup could not prove ${JSON.stringify(target.name)} is absent without an ID.`
      );
    }
    return;
  }

  if (driverName === 'openclaw') {
    const jobs = await listCronJobs(ctx, driverName, scope);
    if (jobs.some((job) => job.id === jobId)) {
      // OpenClaw resolves least-privilege operator scopes in
      // method-scopes.ts: cron.list is READ, while cron.update/remove are
      // WRITE. Scope upgrades need approval, so do not make unnecessary
      // WRITE calls after deleteAfterRun has already removed this job.
      await preventFutureCronFire(ctx, driverName, jobId, scope);
      await removeCronJob(ctx, driverName, jobId, scope);
    }
  } else {
    await preventFutureCronFire(ctx, driverName, jobId, scope);
    await removeCronJob(ctx, driverName, jobId, scope);
  }
  await removeCronArtifact(ctx, driverName, jobId, scope);
  await assertCronCleanupPostcondition(ctx, driverName, jobId, scope);
}

async function createCronCommandScope(
  ctx: RuntimeContext,
  deadlineAtMs: number,
  commandTimeoutMs = CRON_TEARDOWN_COMMAND_TIMEOUT_MS
): Promise<CronCommandScope> {
  const containerId = await resolveComposeContainer(
    ctx,
    ctx.services.bot,
    undefined,
    Math.min(
      commandTimeoutMs,
      remainingMs(deadlineAtMs, 'resolve cron container')
    )
  );
  return { containerId, deadlineAtMs, commandTimeoutMs };
}

async function captureCronJobIdForCleanup(
  ctx: RuntimeContext,
  driverName: DriverName,
  target: CronCleanupTarget,
  scope: CronCommandScope,
  lateCaptureWaitMs: number
): Promise<string | undefined> {
  if (target.id) {
    return target.id;
  }
  const captureDeadlineAtMs = Math.min(
    scope.deadlineAtMs,
    Date.now() + lateCaptureWaitMs
  );
  const captureScope = { ...scope, deadlineAtMs: captureDeadlineAtMs };
  for (;;) {
    if (target.id) {
      return target.id;
    }
    const jobs = await listCronJobs(ctx, driverName, captureScope);
    if (target.id) {
      return target.id;
    }
    const matches = jobs.filter((job) => job.name === target.name);
    if (matches.length === 1) {
      target.id = matches[0].id;
      return target.id;
    }
    if (matches.length > 1) {
      throw new Error(
        `Expected one late cron job named ${JSON.stringify(target.name)}, found ${matches.length}.`
      );
    }
    const remainingCaptureMs = captureDeadlineAtMs - Date.now();
    if (remainingCaptureMs <= 0) {
      // At least one listing succeeded this iteration (a failed listing
      // throws), so ending here is a proven "no late job appeared".
      return undefined;
    }
    await sleep(Math.min(POLL_INTERVAL_MS, remainingCaptureMs));
  }
}

async function preventFutureCronFire(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobId: string,
  scope: CronCommandScope
): Promise<void> {
  if (driverName === 'openclaw') {
    const result = await execScoped(
      ctx,
      scope,
      `disable OpenClaw cron job ${jobId}`,
      (timeoutMs) => [
        'openclaw',
        'cron',
        'disable',
        jobId,
        '--timeout',
        String(timeoutMs),
      ]
    );
    if (result.exitCode !== 0 && !isOpenClawUnknownJob(result, jobId)) {
      requireSuccess(result, `disable OpenClaw cron job ${jobId}`);
    }
    return;
  }

  const result = await execScoped(
    ctx,
    scope,
    `pause Hermes cron job ${jobId}`,
    () => [
      'python3',
      '-c',
      String.raw`
import json
import sys
from cron.jobs import pause_job

print(json.dumps(pause_job(sys.argv[1])))
`,
      jobId,
    ]
  );
  requireSuccess(result, `pause Hermes cron job ${jobId}`);
  const value = parseJson(result.stdout, `pause Hermes cron job ${jobId}`);
  if (value !== null && !isRecord(value)) {
    throw new Error(`Unexpected pause result for Hermes cron job ${jobId}.`);
  }
}

async function removeCronJob(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobId: string,
  scope: CronCommandScope
): Promise<void> {
  if (driverName === 'openclaw') {
    const result = await execScoped(
      ctx,
      scope,
      `remove OpenClaw cron job ${jobId}`,
      (timeoutMs) => [
        'openclaw',
        'cron',
        'rm',
        jobId,
        '--json',
        '--timeout',
        String(timeoutMs),
      ]
    );
    if (result.exitCode !== 0 && !isOpenClawIdNotFound(result)) {
      requireSuccess(result, `remove OpenClaw cron job ${jobId}`);
    }
    return;
  }

  const result = await execScoped(
    ctx,
    scope,
    `remove Hermes cron job ${jobId}`,
    () => [
      'python3',
      '-c',
      String.raw`
import json
import sys
from cron.jobs import remove_job

print(json.dumps(remove_job(sys.argv[1])))
`,
      jobId,
    ]
  );
  requireSuccess(result, `remove Hermes cron job ${jobId}`);
  const value = parseJson(result.stdout, `remove Hermes cron job ${jobId}`);
  if (value !== true && value !== false) {
    throw new Error(`Unexpected remove result for Hermes cron job ${jobId}.`);
  }
}

async function removeCronArtifact(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobId: string,
  scope: CronCommandScope
): Promise<void> {
  const argv =
    driverName === 'openclaw'
      ? [
          'node',
          '-e',
          String.raw`
const fs = require('node:fs/promises');
fs.unlink('/root/.openclaw/cron/runs/' + process.argv[1] + '.jsonl').catch((error) => {
  if (error && error.code !== 'ENOENT') throw error;
});
`,
          jobId,
        ]
      : [
          'python3',
          '-c',
          String.raw`
import os
import shutil
import sys
from pathlib import Path

path = Path(os.environ['HERMES_HOME']) / 'cron' / 'output' / sys.argv[1]
try:
    shutil.rmtree(path)
except FileNotFoundError:
    pass
`,
          jobId,
        ];
  const result = await execScoped(
    ctx,
    scope,
    `remove ${driverName} cron artifact ${jobId}`,
    () => argv
  );
  requireSuccess(result, `remove ${driverName} cron artifact ${jobId}`);
}

async function assertCronCleanupPostcondition(
  ctx: RuntimeContext,
  driverName: DriverName,
  jobId: string,
  scope: CronCommandScope
): Promise<void> {
  const jobs = await listCronJobs(ctx, driverName, scope);
  if (jobs.some((job) => job.id === jobId)) {
    throw new Error(
      `Cron cleanup left job ${jobId} in the ${driverName} store.`
    );
  }

  const argv =
    driverName === 'openclaw'
      ? [
          'node',
          '-e',
          String.raw`
const fs = require('node:fs/promises');
const path = '/root/.openclaw/cron/runs/' + process.argv[1] + '.jsonl';
fs.access(path).then(() => {
  console.log(JSON.stringify({ exists: true }));
}).catch((error) => {
  if (error && error.code === 'ENOENT') {
    console.log(JSON.stringify({ exists: false }));
  } else {
    throw error;
  }
});
`,
          jobId,
        ]
      : [
          'python3',
          '-c',
          String.raw`
import json
import os
import sys
from pathlib import Path

path = Path(os.environ['HERMES_HOME']) / 'cron' / 'output' / sys.argv[1]
print(json.dumps({"exists": path.exists()}))
`,
          jobId,
        ];
  const result = await execScoped(
    ctx,
    scope,
    `verify ${driverName} cron artifact ${jobId}`,
    () => argv
  );
  requireSuccess(result, `verify ${driverName} cron artifact ${jobId}`);
  const parsed = parseJson(
    result.stdout,
    `verify ${driverName} cron artifact ${jobId}`
  );
  if (!isRecord(parsed) || parsed.exists !== false) {
    throw new Error(
      `Cron cleanup left artifact for ${driverName} job ${jobId}.`
    );
  }
}

async function execScoped(
  ctx: RuntimeContext,
  scope: CronCommandScope,
  label: string,
  argv: (timeoutMs: number) => string[]
): Promise<ExecResult> {
  const timeoutMs = Math.min(
    scope.commandTimeoutMs,
    remainingMs(scope.deadlineAtMs, label)
  );
  return execInContainer(ctx, scope.containerId, argv(timeoutMs), {
    timeoutMs,
  });
}

async function waitForCreationSettled(
  creationSettled: Promise<void>,
  timeoutMs: number
): Promise<void> {
  if (timeoutMs <= 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    creationSettled,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timer) {
    clearTimeout(timer);
  }
}

async function sleepUntilNextPoll(
  deadlineAtMs: number,
  description: string,
  timeoutMs: number
): Promise<void> {
  const remaining = deadlineAtMs - Date.now();
  if (remaining <= 0) {
    throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms.`);
  }
  await sleep(Math.min(POLL_INTERVAL_MS, remaining));
  if (Date.now() >= deadlineAtMs) {
    throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms.`);
  }
}

function remainingMs(deadlineAtMs: number, label: string): number {
  const remaining = deadlineAtMs - Date.now();
  if (remaining <= 0) {
    throw new Error(`Cron deadline expired before ${label}.`);
  }
  return remaining;
}

function parseJson(stdout: string, label: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(
      `Could not parse JSON from ${label}: ${errorMessage(error)}. Output: ${JSON.stringify(stdout)}`
    );
  }
}

function parseJob(value: unknown, label: string): CronJobSnapshot {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string'
  ) {
    throw new Error(`${label} must include string id and name fields.`);
  }
  return { id: value.id, name: value.name };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireSuccess(result: ExecResult, label: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${label} failed with exit ${result.exitCode}: ${(result.stderr || result.stdout).trim()}`
    );
  }
}

function isOpenClawUnknownJob(result: ExecResult, jobId: string): boolean {
  const output = `${result.stderr}\n${result.stdout}`;
  const escapedId = escapeRegExp(jobId);
  return new RegExp(`unknown cron job id: ${escapedId}`).test(output);
}

// The pinned gateway reports a missing job on remove with this fixed message,
// which deliberately omits the job id (openclaw@v2026.5.28
// src/gateway/server-methods/cron.ts:483-489). Substring rather than exact
// match: handleCronCliError() prints String(err) through a color helper, so the
// surrounding decoration is not pinned by any contract this test controls. The
// near-miss cases ("missing id", unrelated gateway errors) do not contain this
// text, so the tolerance does not widen into swallowing real failures.
const OPENCLAW_REMOVE_ID_NOT_FOUND = 'invalid cron.remove params: id not found';

function isOpenClawIdNotFound(result: ExecResult): boolean {
  const output = `${result.stderr}\n${result.stdout}`
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .trim();
  return output.includes(OPENCLAW_REMOVE_ID_NOT_FOUND);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
