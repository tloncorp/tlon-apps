import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { applyDesk } from '../runtime/branch-desk.js';
import type {
  BotDriver,
  DriverRuntimeSpec,
  ModelScript,
  RuntimeContext,
} from './types.js';

const ACP_CALL_TIMEOUT_MS = 90_000;
const HARNESS_MODEL = 'tlon-test-scripted';

function harnessUnsupported(method: string): never {
  throw new Error(`${method} is not supported by the harness driver.`);
}

// Harness publishes the final assistant text to the originating chat itself,
// so a reply is a plain text step; the tlon tool takes structured actions.
// The owner's conversations get the whole live tool catalog, so only `tlon`
// is pinned.
function textScript(texts: string[]): ModelScript {
  return {
    steps: texts.map((content) => ({ kind: 'text' as const, content })),
    expectations: {
      advertisedTools: { include: ['tlon'] },
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

    createCronJob() {
      return harnessUnsupported('createCronJob');
    },
  },
};

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
  fn: (call: AcpCall) => Promise<T>
): Promise<T> {
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
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Harness ACP ${method} timed out`));
      }, ACP_CALL_TIMEOUT_MS);
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
