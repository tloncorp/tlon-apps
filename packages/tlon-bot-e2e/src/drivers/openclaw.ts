import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  attemptSignal,
  waitFor,
  waitForHttpOk,
  waitForShipLogin,
} from '../runtime/waiters.js';
import type {
  BotDriver,
  ComposeHandle,
  DriverRuntimeSpec,
  RuntimeCapability,
  RuntimeContext,
  RuntimeSeed,
} from './types.js';

const OPTIONAL_COMPOSE_ENV_KEYS = ['BRAVE_API_KEY', 'TLONBOT_TOKEN'] as const;
const OPTIONAL_TEST_ENV_KEYS = [
  'BRAVE_API_KEY',
  'TLONBOT_TOKEN',
  'TEST_STORAGE_ENDPOINT',
  'TEST_STORAGE_BUCKET',
  'TEST_STORAGE_ACCESS_KEY',
  'TEST_STORAGE_SECRET_KEY',
  'TEST_STORAGE_REGION',
] as const;

const FORBIDDEN_CONTAINER_ENV = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'POSTHOG_API_KEY',
  'TLON_TELEMETRY_API_KEY',
  'MCP_API_KEY',
  'MCP_CONFIG',
];
const LEGACY_OPENCLAW_TOOLS = [
  'web_fetch',
  'web_search',
  'image_search',
  'read',
  'cron',
  'tlon',
  'message',
] as const;
const BASELINE_OPENCLAW_TOOLS = ['tlon', 'message'] as const;

export const openclawDriver: BotDriver = {
  name: 'openclaw',

  packageDir(seed) {
    return path.join(seed.repoRoot, 'packages/openclaw');
  },

  resolveRuntime(seed): DriverRuntimeSpec {
    const packageDir = this.packageDir(seed);
    const sharedPackageDir = path.join(seed.repoRoot, 'packages/tlon-bot-e2e');
    const gateway = requiredGateway(seed);
    const liveToolTrace = firstEnv(
      'TEST_LIVE_TOOL_TRACE',
      'CI_LIVE_TOOL_TRACE'
    );
    const liveToolTraceContents = firstEnv(
      'TEST_LIVE_TOOL_TRACE_CONTENTS',
      'CI_LIVE_TOOL_TRACE_CONTENTS'
    );
    const maxConsecutiveBotResponses = sharedLoopLimitEnv();
    const localTlonbot = localTlonbotMount(seed.repoRoot, packageDir);
    const composeFiles = [
      path.join(sharedPackageDir, 'docker/docker-compose.base.yml'),
      path.join(sharedPackageDir, 'docker/docker-compose.openclaw.yml'),
      ...(localTlonbot
        ? [path.join(packageDir, 'dev/docker-compose.local.yml')]
        : []),
    ];

    return {
      packageDir,
      composeProjectName: `tlon-bot-e2e-openclaw-${seed.runId}`,
      composeFiles,
      services: {
        bot: 'openclaw',
        ships: 'ships',
        fakeModel: 'fake-model',
        logServices: ['openclaw', 'fake-model', 'ships'],
      },
      composeEnv: {
        REPO_ROOT: seed.repoRoot,
        TLON_BOT_E2E_DIR: sharedPackageDir,
        OPENCLAW_DIR: packageDir,
        OPENCLAW_DEV_DIR: path.join(packageDir, 'dev'),
        FAKE_MODEL_PORT: String(seed.endpoints.fakeModel.hostPort),
        ZOD_PORT: String(seed.endpoints.ships.zod.hostPort),
        TEN_PORT: String(seed.endpoints.ships.ten.hostPort),
        MUG_PORT: String(seed.endpoints.ships.mug.hostPort),
        OPENCLAW_GATEWAY_PORT: String(gateway.hostPort),
        TLON_URL: seed.endpoints.ships.zod.containerUrl,
        TLON_SHIP: seed.endpoints.ships.zod.ship,
        TLON_CODE: seed.endpoints.ships.zod.code,
        TLON_OWNER_SHIP: seed.endpoints.ships.ten.ship,
        TLON_DM_ALLOWLIST: seed.endpoints.ships.ten.ship,
        FAKE_MODEL_BASE_URL: seed.endpoints.fakeModel.containerOpenAiBaseUrl,
        MODEL: 'custom-proxy/tlon-test-scripted',
        OPENCLAW_TEST_TOOLS_ALLOW_JSON: JSON.stringify(
          openClawToolsForPartition(seed)
        ),
        TLON_MAX_CONSECUTIVE_BOT_RESPONSES: maxConsecutiveBotResponses,
        TLON_NUDGE_TICK_INTERVAL_MS: '5000',
        TEST_LIVE_TOOL_TRACE: liveToolTrace ?? '0',
        TEST_LIVE_TOOL_TRACE_CONTENTS: liveToolTraceContents ?? '0',
        VERBOSE: process.env.VERBOSE ?? '0',
        ...(localTlonbot
          ? { TLONBOT_DIR: localTlonbot, TEST_TLONBOT_MOUNTED: '1' }
          : {}),
        ...(process.env.FAKE_SHIP_CACHE_DIR
          ? { FAKE_SHIP_CACHE_DIR: process.env.FAKE_SHIP_CACHE_DIR }
          : {}),
        ...pickOptionalEnvForPartition(seed, OPTIONAL_COMPOSE_ENV_KEYS),
      },
      testEnv: {
        TLON_BOT_E2E_DRIVER: 'openclaw',
        TLON_URL: seed.endpoints.ships.zod.hostUrl,
        TLON_SHIP: seed.endpoints.ships.zod.ship,
        TLON_CODE: seed.endpoints.ships.zod.code,
        TEST_USER_URL: seed.endpoints.ships.ten.hostUrl,
        TEST_USER_SHIP: seed.endpoints.ships.ten.ship,
        TEST_USER_CODE: seed.endpoints.ships.ten.code,
        TEST_THIRD_PARTY_URL: seed.endpoints.ships.mug.hostUrl,
        TEST_THIRD_PARTY_SHIP: seed.endpoints.ships.mug.ship,
        TEST_THIRD_PARTY_CODE: seed.endpoints.ships.mug.code,
        TEST_MODE: 'tlon',
        TEST_GATEWAY_URL: gateway.hostBaseUrl,
        FAKE_MODEL_BASE_URL: seed.endpoints.fakeModel.hostBaseUrl,
        TEST_LIVE_TOOL_TRACE: liveToolTrace ?? '0',
        TEST_LIVE_TOOL_TRACE_CONTENTS: liveToolTraceContents ?? '0',
        ...(localTlonbot ? { TEST_TLONBOT_MOUNTED: '1' } : {}),
        ...pickOptionalEnvForPartition(seed, OPTIONAL_TEST_ENV_KEYS),
      },
    };
  },

  async beforeComposeUp(ctx, compose) {
    console.log('==> Starting OpenClaw base services...');
    await compose.up([ctx.services.ships, ctx.services.fakeModel]);
    await waitForOpenClawBaseServices(ctx);
  },

  async waitReady(ctx, compose) {
    await waitForOpenClawGateway(ctx);
    await waitForOpenClawSse(ctx, compose);
  },

  async assertRuntimeConfig(ctx, compose) {
    await assertOpenClawConfig(ctx, compose);
    await assertOpenClawContainerEnv(ctx, compose);
  },

  isBenignModelCall(call) {
    // OpenClaw polls the model on its own heartbeat schedule; those unkeyed
    // calls are background noise for negative "no model call" assertions.
    return (
      call.key === null && call.userText.startsWith('[OpenClaw heartbeat poll]')
    );
  },

  model: {
    replyText(text) {
      return {
        steps: [{ kind: 'text', content: text }],
        expectations: {
          advertisedTools: { exact: ['message', 'tlon'] },
          expectedCallCount: 1,
        },
      };
    },

    replyTexts(texts) {
      return {
        steps: texts.map((content) => ({ kind: 'text' as const, content })),
        expectations: {
          advertisedTools: { exact: ['message', 'tlon'] },
          expectedCallCount: texts.length,
        },
      };
    },

    sendMessage(args) {
      return {
        steps: [
          {
            kind: 'tool_call',
            name: 'message',
            args: {
              action: 'send',
              target: args.target,
              message: args.message,
            },
          },
          { kind: 'text', content: 'Done' },
        ],
        expectations: {
          advertisedTools: { exact: ['message', 'tlon'] },
          expectedCallCount: 2,
          // Observed against openclaw@2026.5.7: the fake model receives the
          // initial tool-call request and a follow-up request, but that
          // follow-up does not contain an OpenAI role:tool/function message
          // carrying the emitted tool_call_id. Shared scenarios therefore
          // assert the visible reply plus Tlon side effect instead of claiming
          // Hermes-style tool-result transcript coverage.
          toolEffectOnly: true,
        },
      };
    },

    readOrAdmin(command, finalText = 'OpenClaw completed the tlon command.') {
      return {
        steps: [
          { kind: 'tool_call', name: 'tlon', args: { command } },
          { kind: 'text', content: finalText },
        ],
        expectations: {
          advertisedTools: { exact: ['message', 'tlon'] },
          expectedCallCount: 2,
          // See sendMessage: the current OpenClaw transcript is observable as
          // a second model request but not as an OpenAI-format tool-result
          // message with the emitted tool_call_id.
          toolEffectOnly: true,
        },
      };
    },

    imageSearch(query) {
      return {
        steps: [{ kind: 'tool_call', name: 'image_search', args: { query } }],
        expectations: {
          advertisedTools: { include: ['image_search'] },
          expectedCallCount: 1,
        },
      };
    },
  },
};

function requiredGateway(
  seed: RuntimeSeed
): NonNullable<RuntimeSeed['endpoints']['gateway']> {
  if (!seed.endpoints.gateway) {
    throw new Error('OpenClaw driver requires a gateway endpoint');
  }
  return seed.endpoints.gateway;
}

async function waitForOpenClawBaseServices(ctx: RuntimeContext): Promise<void> {
  await waitForHttpOk(`${ctx.endpoints.fakeModel.hostBaseUrl}/health`, {
    timeoutMs: 60_000,
    intervalMs: 1_000,
    description: 'OpenClaw fake-model /health',
  });
  for (const [label, endpoint] of Object.entries(ctx.endpoints.ships)) {
    await waitForShipLogin(endpoint.hostUrl, endpoint.code, {
      timeoutMs: 180_000,
      intervalMs: 3_000,
      description: `OpenClaw ${label} fake ship login`,
    });
  }
}

async function waitForOpenClawGateway(ctx: RuntimeContext): Promise<void> {
  const gateway = requiredGateway(ctx);
  const opts = {
    timeoutMs: 300_000,
    intervalMs: 2_000,
    description: 'OpenClaw gateway HTTP readiness',
  };
  await waitFor(async () => {
    const response = await fetch(`${gateway.hostBaseUrl}/`, {
      signal: attemptSignal(opts),
    });
    if (!response.ok) {
      return false;
    }
    const text = await response.text();
    return /openclaw/i.test(text);
  }, opts);
}

async function waitForOpenClawSse(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  await waitFor(
    async () => {
      const logs = await compose.logs([ctx.services.bot], { tail: 200 });
      return logs.includes('[tlon] Connected! Firehose subscriptions active');
    },
    {
      timeoutMs: 120_000,
      intervalMs: 1_000,
      description: 'OpenClaw Tlon SSE subscriptions',
    }
  );
}

async function assertOpenClawConfig(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const result = await compose.exec(ctx.services.bot, [
    'cat',
    '/root/.openclaw/openclaw.json',
  ]);
  assertExecOk(result, 'OpenClaw config read');
  const config = JSON.parse(result.stdout) as {
    models?: { providers?: Record<string, { baseUrl?: string }> };
    agents?: { defaults?: { model?: { primary?: string } } };
    channels?: {
      tlon?: {
        url?: string;
        ship?: string;
        code?: string;
        ownerShip?: string;
        dmAllowlist?: string[];
        reengagement?: { enabled?: boolean };
        maxConsecutiveBotResponses?: number;
      };
    };
    tools?: { allow?: string[] };
  };

  const failures: string[] = [];
  const provider = config.models?.providers?.['custom-proxy'];
  const model = config.agents?.defaults?.model;
  const channel = config.channels?.tlon;
  const expectedLoopLimit = Number(
    ctx.composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES ?? '3'
  );

  expectConfig(
    provider?.baseUrl === ctx.endpoints.fakeModel.containerOpenAiBaseUrl,
    `custom-proxy baseUrl must be ${ctx.endpoints.fakeModel.containerOpenAiBaseUrl}`
  );
  expectConfig(
    model?.primary === 'custom-proxy/tlon-test-scripted',
    'agent primary model must be custom-proxy/tlon-test-scripted'
  );
  expectConfig(
    channel?.url === ctx.endpoints.ships.zod.containerUrl,
    `tlon channel URL must be ${ctx.endpoints.ships.zod.containerUrl}`
  );
  expectConfig(
    channel?.ship === ctx.endpoints.ships.zod.ship,
    `tlon channel ship must be ${ctx.endpoints.ships.zod.ship}`
  );
  expectConfig(
    channel?.code === ctx.endpoints.ships.zod.code,
    'tlon channel code must be deterministic fakezod code'
  );
  expectConfig(
    channel?.ownerShip === ctx.endpoints.ships.ten.ship,
    `owner ship must be ${ctx.endpoints.ships.ten.ship}`
  );
  expectConfig(
    JSON.stringify(channel?.dmAllowlist ?? []) ===
      JSON.stringify([ctx.endpoints.ships.ten.ship]),
    `dmAllowlist must be exactly ${ctx.endpoints.ships.ten.ship}`
  );
  expectConfig(
    channel?.reengagement?.enabled === true,
    'reengagement must be enabled for heartbeat coverage'
  );
  expectConfig(
    channel?.maxConsecutiveBotResponses === expectedLoopLimit,
    `maxConsecutiveBotResponses must be ${expectedLoopLimit} for loop-protection coverage`
  );
  expectConfig(
    JSON.stringify(config.tools?.allow ?? []) ===
      ctx.composeEnv.OPENCLAW_TEST_TOOLS_ALLOW_JSON,
    `tools.allow must match ${ctx.composeEnv.OPENCLAW_TEST_TOOLS_ALLOW_JSON}`
  );

  if (failures.length > 0) {
    throw new Error(
      `OpenClaw E2E config assertion failed:\n` +
        failures.map((failure) => `- ${failure}`).join('\n') +
        `\nRendered config:\n${JSON.stringify(maskConfig(config), null, 2)}`
    );
  }

  function expectConfig(condition: boolean, message: string) {
    if (!condition) {
      failures.push(message);
    }
  }
}

async function assertOpenClawContainerEnv(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const result = await compose.exec(ctx.services.bot, [
    'node',
    '-e',
    `const keys = ${JSON.stringify(FORBIDDEN_CONTAINER_ENV)};
const found = Object.fromEntries(keys.map((key) => [key, process.env[key]]).filter(([, value]) => value));
console.log(JSON.stringify({ found, model: process.env.MODEL || null, brave: Boolean(process.env.BRAVE_API_KEY), tlonbot: Boolean(process.env.TLONBOT_TOKEN) }));`,
  ]);
  assertExecOk(result, 'OpenClaw forbidden env probe');
  const parsed = JSON.parse(result.stdout.trim()) as {
    found: Record<string, string>;
    model: string | null;
    brave: boolean;
    tlonbot: boolean;
  };
  const failures: string[] = [];
  if (Object.keys(parsed.found).length > 0) {
    failures.push(
      `container inherited forbidden env keys: ${Object.keys(parsed.found)
        .sort()
        .join(', ')}`
    );
  }
  if (parsed.model !== 'custom-proxy/tlon-test-scripted') {
    failures.push(
      `MODEL must be custom-proxy/tlon-test-scripted, got ${parsed.model}`
    );
  }
  if (parsed.brave !== Boolean(ctx.composeEnv.BRAVE_API_KEY)) {
    failures.push(
      'BRAVE_API_KEY presence did not match explicit compose input'
    );
  }
  if (parsed.tlonbot !== Boolean(ctx.composeEnv.TLONBOT_TOKEN)) {
    failures.push(
      'TLONBOT_TOKEN presence did not match explicit compose input'
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `OpenClaw container env assertion failed:\n${failures
        .map((failure) => `- ${failure}`)
        .join('\n')}`
    );
  }
}

function assertExecOk(
  result: { exitCode: number; stderr: string },
  label: string
) {
  if (result.exitCode !== 0) {
    throw new Error(
      `${label} failed with exit ${result.exitCode}: ${result.stderr}`
    );
  }
}

function maskConfig(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(maskConfig);
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      /code|key|token|secret|password/i.test(key)
        ? '<redacted>'
        : maskConfig(child),
    ])
  );
}

function localTlonbotMount(
  repoRoot: string,
  packageDir: string
): string | null {
  const configured = process.env.TLONBOT_DIR
    ? path.resolve(process.env.TLONBOT_DIR)
    : path.resolve(packageDir, '../../..', 'tlonbot');
  const composeFile = path.join(packageDir, 'dev/docker-compose.local.yml');
  if (existsSync(composeFile) && existsSync(configured)) {
    console.log(`==> Using local tlonbot volume mount (${configured})`);
    return configured;
  }

  if (process.env.TLONBOT_DIR && !existsSync(configured)) {
    console.log(
      `==> TLONBOT_DIR was set but does not exist; continuing without local mount (${configured})`
    );
  }

  const siblingDefault = path.resolve(repoRoot, '..', 'tlonbot');
  if (
    !process.env.TLONBOT_DIR &&
    configured !== siblingDefault &&
    existsSync(siblingDefault)
  ) {
    return siblingDefault;
  }

  return null;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

function sharedLoopLimitEnv(): string {
  const raw = process.env.TLON_MAX_CONSECUTIVE_BOT_RESPONSES ?? '3';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `TLON_MAX_CONSECUTIVE_BOT_RESPONSES must be a positive integer for shared loop coverage, got ${JSON.stringify(raw)}.`
    );
  }
  return String(value);
}

function pickNonEmptyEnv(keys: readonly string[]): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      picked[key] = value;
    }
  }
  return picked;
}

function pickOptionalEnvForPartition(
  seed: RuntimeSeed,
  keys: readonly string[]
): Record<string, string> {
  if (!seed.capabilityPartition) {
    return pickNonEmptyEnv(keys);
  }
  const capabilities = new Set(seed.capabilityPartition.capabilities);
  const allowedKeys = keys.filter((key) =>
    optionalEnvAllowedForCapabilities(key, capabilities)
  );
  return pickNonEmptyEnv(allowedKeys);
}

function openClawToolsForPartition(seed: RuntimeSeed): string[] {
  if (!seed.capabilityPartition) {
    return [...LEGACY_OPENCLAW_TOOLS];
  }
  const tools = new Set<string>(BASELINE_OPENCLAW_TOOLS);
  for (const capability of seed.capabilityPartition.capabilities) {
    for (const tool of openClawToolsForCapability(capability)) {
      tools.add(tool);
    }
  }
  return [...tools];
}

function openClawToolsForCapability(
  capability: RuntimeCapability
): readonly string[] {
  if (capability === 'image_search') {
    return ['image_search'];
  }
  return [];
}

function optionalEnvAllowedForCapabilities(
  key: string,
  capabilities: ReadonlySet<RuntimeCapability>
): boolean {
  if (key === 'BRAVE_API_KEY') {
    return capabilities.has('image_search');
  }
  if (key === 'TLONBOT_TOKEN') {
    return (
      capabilities.has('external_credentials') ||
      capabilities.has('media_blob') ||
      capabilities.has('upload_storage')
    );
  }
  if (key.startsWith('TEST_STORAGE_')) {
    return capabilities.has('upload_storage') || capabilities.has('media_blob');
  }
  return true;
}
