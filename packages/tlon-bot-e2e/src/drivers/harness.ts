import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { applyDesk } from '../runtime/branch-desk.js';
import { sleep } from '../runtime/waiters.js';
import type {
  BotDriver,
  CronJobSnapshot,
  DriverRuntimeSpec,
  ModelScript,
  RuntimeContext,
} from './types.js';

const ACP_CALL_TIMEOUT_MS = 90_000;
const HARNESS_MODEL = 'tlon-test-scripted';
// Far enough ahead that the creating turn finishes before the job fires.
const SCHEDULE_AT_OFFSET_MS = 60_000;
const SCHEDULE_POLL_INTERVAL_MS = 500;

function harnessUnsupported(method: string): never {
  throw new Error(`${method} is not supported by the harness driver.`);
}

// Harness publishes the final assistant text to the originating chat itself,
// so a reply is a plain text step; the tlon tool takes structured actions.
// Every Tlon conversation is offered `tlon_read_history`. The `tlon` tool is
// offered only where granted: the owner's conversations and a trusted ship
// given it. The ships the scenarios allow have no `tlon` grant.
function textScript(texts: string[]): ModelScript {
  return {
    steps: texts.map((content) => ({ kind: 'text' as const, content })),
    expectations: {
      advertisedTools: { include: ['tlon_read_history'] },
      expectedCallCount: texts.length,
    },
  };
}

// The scenarios phrase tlon commands as CLI strings; Harness's tlon tool takes
// an action and named arguments. Only the commands an enabled scenario sends
// are translated.
export function harnessTlonAction(command: string): Record<string, unknown> {
  const profile = /^contacts update-profile --nickname (".*")$/.exec(command);
  if (profile) {
    return {
      action: 'update_profile',
      nickname: JSON.parse(profile[1]) as string,
    };
  }
  return harnessUnsupported(`The tlon command ${JSON.stringify(command)}`);
}

export const harnessDriver: BotDriver = {
  name: 'harness',

  // Harness runs on the bot ship and holds no SSE connection to it.
  streamFaultLogMarkers: [],

  packageDir(seed) {
    return path.join(seed.repoRoot, 'packages/harness');
  },

  resolveRuntime(seed): DriverRuntimeSpec {
    const sharedPackageDir = path.join(seed.repoRoot, 'packages/tlon-bot-e2e');
    return {
      packageDir: this.packageDir(seed),
      composeProjectName: `tlon-bot-e2e-harness-${seed.runId}`,
      composeFiles: [
        path.join(sharedPackageDir, 'docker/docker-compose.base.yml'),
      ],
      services: {
        ships: 'ships',
        fakeModel: 'fake-model',
        logServices: ['ships', 'fake-model'],
      },
      composeEnv: {
        REPO_ROOT: seed.repoRoot,
        FAKE_MODEL_PORT: String(seed.endpoints.fakeModel.hostPort),
        ZOD_PORT: String(seed.endpoints.ships.zod.hostPort),
        TEN_PORT: String(seed.endpoints.ships.ten.hostPort),
        MUG_PORT: String(seed.endpoints.ships.mug.hostPort),
        ...(process.env.FAKE_SHIP_CACHE_DIR
          ? { FAKE_SHIP_CACHE_DIR: process.env.FAKE_SHIP_CACHE_DIR }
          : {}),
      },
      testEnv: {
        TLON_BOT_E2E_DRIVER: 'harness',
        TLON_URL: seed.endpoints.ships.zod.hostUrl,
        TLON_SHIP: seed.endpoints.ships.zod.ship,
        TLON_CODE: seed.endpoints.ships.zod.code,
        TEST_USER_URL: seed.endpoints.ships.ten.hostUrl,
        TEST_USER_SHIP: seed.endpoints.ships.ten.ship,
        TEST_USER_CODE: seed.endpoints.ships.ten.code,
        TEST_THIRD_PARTY_URL: seed.endpoints.ships.mug.hostUrl,
        TEST_THIRD_PARTY_SHIP: seed.endpoints.ships.mug.ship,
        TEST_THIRD_PARTY_CODE: seed.endpoints.ships.mug.code,
        FAKE_MODEL_BASE_URL: seed.endpoints.fakeModel.hostBaseUrl,
      },
    };
  },

  async waitReady(ctx) {
    await applyDesk(ctx, {
      desk: 'harness',
      justfile: path.join(ctx.packageDir, 'justfile'),
      ships: ['zod'],
      readyScry: '/~/scry/harness-tlon/status.json',
      install: true,
    });
    await configureHarness(ctx);
  },

  async assertRuntimeConfig(ctx) {
    const { tlon, defaults } = await withHarnessAcp(ctx, async (call) => ({
      tlon: (await call('harness/tlon')) as HarnessTlonStatus,
      defaults: (await call('harness/defaults')) as HarnessDefaults,
    }));
    const expected = expectedPolicy(ctx);
    const failures: string[] = [];
    for (const [key, value] of Object.entries(expected)) {
      const actual = tlon.policy[key as keyof HarnessPolicy];
      if (JSON.stringify(actual) !== JSON.stringify(value)) {
        failures.push(
          `policy.${key} must be ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`
        );
      }
    }
    if (defaults.url !== harnessModelUrl(ctx)) {
      failures.push(`defaults.url must be ${harnessModelUrl(ctx)}`);
    }
    if (defaults.model !== HARNESS_MODEL) {
      failures.push(`defaults.model must be ${HARNESS_MODEL}`);
    }
    if (failures.length > 0) {
      throw new Error(
        `Harness E2E config assertion failed:\n${failures
          .map((failure) => `- ${failure}`)
          .join('\n')}`
      );
    }
  },

  async collectDiagnostics(ctx) {
    const status = await withHarnessAcp(ctx, (call) => call('harness/tlon'));
    return `harness/tlon:\n${JSON.stringify(status, null, 2)}`;
  },

  model: {
    botSelfPrefix: '',

    replyText(text) {
      return textScript([text]);
    },

    replyTexts(texts) {
      return textScript(texts);
    },

    looseReplyText(text) {
      return {
        steps: [{ kind: 'text', content: text }],
        expectations: { expectedCallCount: 1 },
      };
    },

    readOrAdmin(command, finalText = 'Harness completed the tlon command.') {
      return {
        steps: [
          { kind: 'tool_call', name: 'tlon', args: harnessTlonAction(command) },
          { kind: 'text', content: finalText },
        ],
        expectations: {
          advertisedTools: { include: ['tlon'] },
          expectedCallCount: 2,
          expectedCallSequence: [
            { kind: 'model_request' },
            { kind: 'tool_call', toolName: 'tlon' },
            { kind: 'model_request' },
            { kind: 'final_model_text' },
          ],
          toolLoopResult: true,
          streamedToolLoop: true,
        },
      };
    },

    sendMessage() {
      return harnessUnsupported('sendMessage');
    },

    imageSearch() {
      return harnessUnsupported('imageSearch');
    },

    createCronJob({ firedPrompt, finalText }) {
      return {
        steps: [
          {
            kind: 'tool_call',
            name: 'schedule_once',
            args: {
              at: new Date(Date.now() + SCHEDULE_AT_OFFSET_MS).toISOString(),
              prompt: firedPrompt,
            },
          },
          { kind: 'text', content: finalText },
        ],
        expectations: {
          advertisedTools: { include: ['schedule_once', 'tlon'] },
          expectedCallCount: 2,
          expectedCallSequence: [
            { kind: 'model_request' },
            { kind: 'tool_call', toolName: 'schedule_once' },
            { kind: 'model_request' },
            { kind: 'final_model_text' },
          ],
          toolLoopResult: true,
          streamedToolLoop: true,
        },
      };
    },
  },

  async allowDmSender(ctx, ship) {
    let undo: DmGrant['undo'];
    await updateAllowedShips(ctx, (allowed) => {
      const grant = dmGrant(allowed, ship);
      undo = grant.undo;
      return grant.allowed;
    });
    const revoke = undo;
    return async () => {
      if (revoke) {
        await updateAllowedShips(ctx, revoke);
      }
    };
  },

  cronJobs: {
    async list(ctx, timeoutMs) {
      const schedules = await withHarnessAcp(
        ctx,
        (call) => call('harness/cron') as Promise<HarnessSchedule[]>,
        timeoutMs
      );
      return schedules.map(harnessScheduleSnapshot);
    },

    // Harness schedules have no name; the scenario's prompt is unique to it.
    listingName({ firedPrompt }) {
      return firedPrompt;
    },

    remove(ctx, id, deadlineAtMs) {
      return removeHarnessSchedule(
        (method, params) =>
          withHarnessAcp(
            ctx,
            (call) => call(method, params),
            deadlineAtMs - Date.now()
          ),
        id,
        deadlineAtMs
      );
    },
  },
};

export interface HarnessSchedule {
  id: string;
  prompt: string;
  state: 'active' | 'paused' | 'cancelled' | 'complete';
  /** Completed or cancelled, with no execution or delivery still in flight. */
  clearable: boolean;
}

// A completed one-shot stays listed until it is cleared. Once its run and
// delivery have settled it can never run or publish again.
export function harnessScheduleSnapshot(
  schedule: HarnessSchedule
): CronJobSnapshot {
  return {
    id: schedule.id,
    name: schedule.prompt,
    finished: schedule.state === 'complete' && schedule.clearable,
  };
}

// Harness clears only settled schedules, and cancelling does not retract a run
// already dispatched, so a cancelled job is polled until its work settles.
export async function removeHarnessSchedule(
  call: (method: string, params?: unknown) => Promise<unknown>,
  id: string,
  deadlineAtMs: number
): Promise<void> {
  for (;;) {
    const schedules = (await call('harness/cron')) as HarnessSchedule[];
    const schedule = schedules.find((entry) => entry.id === id);
    if (!schedule) {
      return;
    }
    if (schedule.clearable) {
      await call('harness/cron/clear', { id });
      return;
    }
    if (schedule.state !== 'cancelled') {
      await call('harness/cron/cancel', { id });
      continue;
    }
    const remaining = deadlineAtMs - Date.now();
    if (remaining <= 0) {
      throw new Error(
        `Harness schedule ${id} still has work in flight; it was cancelled but cannot be cleared.`
      );
    }
    await sleep(Math.min(SCHEDULE_POLL_INTERVAL_MS, remaining));
  }
}

export interface DmGrant {
  allowed: string[];
  /** Absent when the ship was already allowed, so revoking leaves it. */
  undo?: (allowed: string[]) => string[];
}

// Undo removes only this ship from the policy as it reads at revoke time,
// keeping any other change made in between.
export function dmGrant(allowed: string[], ship: string): DmGrant {
  if (allowed.includes(ship)) {
    return { allowed };
  }
  return {
    allowed: [...allowed, ship],
    undo: (current) => current.filter((entry) => entry !== ship),
  };
}

async function updateAllowedShips(
  ctx: RuntimeContext,
  update: (allowed: string[]) => string[]
): Promise<void> {
  await withHarnessAcp(ctx, async (call) => {
    const { policy, revision } = (await call(
      'harness/tlon'
    )) as HarnessTlonStatus;
    await call('harness/tlon/configure', {
      ...policy,
      allowed: update(policy.allowed),
      expectedOwner: policy.owner,
      expectedRevision: revision,
    });
  });
}

interface HarnessPolicy {
  enabled: boolean;
  owner: string | null;
  response: 'off' | 'mentions' | 'all';
  allowed: string[];
  channels: unknown[];
  trusted: unknown[];
}

interface HarnessTlonStatus {
  policy: HarnessPolicy;
  revision: string;
  siblingMoonOwners: boolean;
}

interface HarnessDefaults {
  url: string;
  model: string;
  [key: string]: unknown;
}

function expectedPolicy(ctx: RuntimeContext): HarnessPolicy {
  return {
    enabled: true,
    owner: ctx.endpoints.ships.ten.ship,
    response: 'mentions',
    allowed: [],
    channels: [],
    trusted: [],
  };
}

// Harness speaks Chat Completions to a custom endpoint URL, which the ship
// reaches over the compose network.
function harnessModelUrl(ctx: RuntimeContext): string {
  return `${ctx.endpoints.fakeModel.containerOpenAiBaseUrl}/chat/completions`;
}

async function configureHarness(ctx: RuntimeContext): Promise<void> {
  const policy = expectedPolicy(ctx);
  await withHarnessAcp(ctx, async (call) => {
    const initial = (await call('harness/tlon')) as HarnessTlonStatus;
    await call('harness/tlon/owner/set', {
      owner: policy.owner,
      expectedOwner: initial.policy.owner,
      siblingMoonOwners: initial.siblingMoonOwners,
      expectedSiblingMoonOwners: initial.siblingMoonOwners,
    });
    const defaults = (await call('harness/defaults')) as HarnessDefaults;
    await call('harness/defaults/configure', {
      config: {
        ...defaults,
        url: harnessModelUrl(ctx),
        model: HARNESS_MODEL,
        key: '',
        headers: [],
      },
    });
    const owned = (await call('harness/tlon')) as HarnessTlonStatus;
    await call('harness/tlon/configure', {
      ...policy,
      expectedOwner: policy.owner,
      expectedRevision: owned.revision,
    });
  });
}

type AcpCall = (method: string, params?: unknown) => Promise<unknown>;

// Runs Harness's own stdio ACP bridge against the bot ship and correlates its
// JSON-RPC replies.
async function withHarnessAcp<T>(
  ctx: RuntimeContext,
  fn: (call: AcpCall) => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  const deadlineAtMs =
    timeoutMs === undefined ? Infinity : Date.now() + timeoutMs;
  const endpoint = ctx.endpoints.ships.zod;
  const child = spawn(
    process.execPath,
    [path.join(ctx.packageDir, 'acp/harness-acp.mjs')],
    {
      env: {
        PATH: process.env.PATH ?? '',
        SHIP_URL: endpoint.hostUrl,
        SHIP_CODE: endpoint.code,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const exited = new Promise<number | null>((resolve) =>
    child.on('exit', resolve)
  );
  const pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  let failure: Error | undefined;
  const fail = (error: Error) => {
    failure ??= error;
    for (const waiter of pending.values()) {
      waiter.reject(failure);
    }
    pending.clear();
  };
  void exited.then((code) =>
    fail(new Error(`harness-acp exited (${code}): ${stderr.trim()}`))
  );
  createInterface({ input: child.stdout }).on('line', (line) => {
    const frame = JSON.parse(line) as {
      id?: number | null;
      result?: unknown;
      error?: { message?: string };
    };
    const waiter = frame.id == null ? undefined : pending.get(frame.id);
    if (!waiter) {
      return;
    }
    pending.delete(frame.id as number);
    if (frame.error) {
      waiter.reject(new Error(frame.error.message ?? JSON.stringify(frame)));
    } else {
      waiter.resolve(frame.result);
    }
  });

  let nextId = 0;
  const call: AcpCall = (method, params = {}) => {
    if (failure) {
      return Promise.reject(failure);
    }
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          pending.delete(id);
          // The bridge may be stuck mid-request; don't wait for it to exit.
          child.kill();
          reject(new Error(`Harness ACP ${method} timed out`));
        },
        Math.max(0, Math.min(ACP_CALL_TIMEOUT_MS, deadlineAtMs - Date.now()))
      );
      pending.set(id, {
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(new Error(`Harness ACP ${method}: ${error.message}`));
        },
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
      );
    });
  };

  try {
    await call('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'tlon-bot-e2e', version: '1' },
    });
    return await fn(call);
  } finally {
    child.stdin.end();
    await exited;
  }
}
