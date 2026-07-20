import path from 'node:path';

import { waitFor } from '../runtime/waiters.js';
import type {
  BotDriver,
  ComposeHandle,
  DriverRuntimeSpec,
  RuntimeContext,
  RuntimeSeed,
} from './types.js';

const HERMES_AGENT_REF = 'v2026.6.19';

const FORBIDDEN_CONTAINER_ENV = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'BRAVE_API_KEY',
  'BRAVE_SEARCH_API_KEY',
  'POSTHOG_API_KEY',
  'TLON_TELEMETRY_API_KEY',
  'FIRECRAWL_API_KEY',
  'TAVILY_API_KEY',
  'EXA_API_KEY',
  'PARALLEL_API_KEY',
  'MCP_API_KEY',
  'MCP_CONFIG',
];

export const hermesDriver: BotDriver = {
  name: 'hermes',

  packageDir(seed) {
    return path.join(seed.repoRoot, 'packages/hermes-tlon-adapter');
  },

  resolveRuntime(seed): DriverRuntimeSpec {
    const packageDir = this.packageDir(seed);
    const sharedPackageDir = path.join(seed.repoRoot, 'packages/tlon-bot-e2e');
    const homeChannel = seed.endpoints.ships.ten.ship;
    const knownBotUsers = knownBotUsersForSharedLoop(seed);
    const maxConsecutiveBotResponses = sharedLoopLimitEnv();

    return {
      packageDir,
      composeProjectName: `tlon-bot-e2e-hermes-${seed.runId}`,
      composeFiles: [
        path.join(sharedPackageDir, 'docker/docker-compose.base.yml'),
        path.join(sharedPackageDir, 'docker/docker-compose.hermes.yml'),
      ],
      services: {
        bot: 'hermes-tlon',
        ships: 'ships',
        fakeModel: 'fake-model',
        logServices: ['hermes-tlon', 'ships', 'fake-model'],
      },
      composeEnv: {
        REPO_ROOT: seed.repoRoot,
        TLON_BOT_E2E_DIR: sharedPackageDir,
        HERMES_ADAPTER_DIR: packageDir,
        HERMES_AGENT_REF,
        FAKE_MODEL_PORT: String(seed.endpoints.fakeModel.hostPort),
        ZOD_PORT: String(seed.endpoints.ships.zod.hostPort),
        TEN_PORT: String(seed.endpoints.ships.ten.hostPort),
        MUG_PORT: String(seed.endpoints.ships.mug.hostPort),
        TLON_NODE_URL: seed.endpoints.ships.zod.containerUrl,
        TLON_NODE_ID: seed.endpoints.ships.zod.ship,
        TLON_ACCESS_CODE: seed.endpoints.ships.zod.code,
        TLON_OWNER_SHIP: seed.endpoints.ships.ten.ship,
        TLON_URL: seed.endpoints.ships.zod.containerUrl,
        TLON_SHIP: seed.endpoints.ships.zod.ship,
        TLON_CODE: seed.endpoints.ships.zod.code,
        TLON_DM_ALLOWLIST: seed.endpoints.ships.ten.ship,
        TLON_ALLOWED_USERS: seed.endpoints.ships.ten.ship,
        TLON_ALLOW_ALL_USERS: 'false',
        TLON_HOME_CHANNEL: homeChannel,
        TLON_GATEWAY_STATUS: 'false',
        TLON_TELEMETRY: 'false',
        TLON_CONTEXT_MESSAGES: '4',
        // The fake-ship SSE stream does not emit idle heartbeats. Match the
        // adapter's production default instead of forcing a reconnect every
        // 15 seconds during otherwise idle scenario setup/settles.
        TLON_SSE_READ_TIMEOUT_SECONDS: '60',
        TLON_KNOWN_BOT_USERS: knownBotUsers,
        TLON_MAX_CONSECUTIVE_BOT_RESPONSES: maxConsecutiveBotResponses,
        HERMES_MODEL_PROVIDER: 'custom',
        HERMES_MODEL: 'tlon-test-scripted',
        HERMES_MODEL_BASE_URL: seed.endpoints.fakeModel.containerOpenAiBaseUrl,
        HERMES_MODEL_API_KEY: 'no-key-required',
        HERMES_MODEL_API_MODE: 'chat_completions',
        HERMES_GATEWAY_ARGS: '--replace -v',
        ...(process.env.FAKE_SHIP_CACHE_DIR
          ? { FAKE_SHIP_CACHE_DIR: process.env.FAKE_SHIP_CACHE_DIR }
          : {}),
      },
      testEnv: {
        TLON_BOT_E2E_DRIVER: 'hermes',
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

  async waitReady(ctx, compose) {
    await waitForHermesLog(ctx, compose);
    await assertHermesConfig(ctx, compose);
    await assertHermesSetup(ctx, compose);
    await assertForbiddenContainerEnv(ctx, compose);
  },

  async assertRuntimeConfig(ctx, compose) {
    await assertHermesConfig(ctx, compose);
    await assertForbiddenContainerEnv(ctx, compose);
  },

  model: {
    replyText(text) {
      return {
        steps: [{ kind: 'text', content: text }],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: ['tlon'] },
          expectedCallCount: 1,
        },
      };
    },

    replyTexts(texts) {
      return {
        steps: texts.map((content) => ({ kind: 'text' as const, content })),
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: ['tlon'] },
          expectedCallCount: texts.length,
        },
      };
    },

    sendMessage(args) {
      return {
        steps: [
          {
            kind: 'tool_call',
            name: 'tlon',
            args: {
              command: `posts send ${args.target} ${JSON.stringify(args.message)}`,
            },
          },
        ],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: ['tlon'] },
          expectedCallCount: 1,
        },
      };
    },

    readOrAdmin(command, finalText = 'Hermes completed the tlon command.') {
      return {
        steps: [
          { kind: 'tool_call', name: 'tlon', args: { command } },
          { kind: 'text', content: finalText },
        ],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: ['tlon'] },
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

async function waitForHermesLog(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  await waitFor(
    async () => {
      const logs = await compose.logs([ctx.services.bot], { tail: 260 });
      return (
        logs.includes('[tlon] connected to http://ships:8080 as ~zod') ||
        logs.includes('[tlon] connected to http://ships:8080 as zod')
      );
    },
    {
      timeoutMs: 300_000,
      intervalMs: 2_000,
      description: 'Hermes Tlon adapter connection',
    }
  );
}

async function assertHermesConfig(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const config = await readHermesConfig(compose, ctx.services.bot);
  const failures: string[] = [];
  const model = objectAt(config, 'model');
  const platformToolsets = objectAt(config, 'platform_toolsets');
  const agent = objectAt(config, 'agent');
  const tlon = objectAt(config, 'tlon');
  const expectedKnownBots = String(
    ctx.composeEnv.TLON_KNOWN_BOT_USERS ?? ''
  ).split(',');
  const expectedLoopLimit = Number(
    ctx.composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES ?? '3'
  );

  expectConfig(model.provider === 'custom', 'model.provider must be custom');
  expectConfig(
    model.default === 'tlon-test-scripted',
    'model.default must be tlon-test-scripted'
  );
  expectConfig(
    model.base_url === ctx.endpoints.fakeModel.containerOpenAiBaseUrl,
    `model.base_url must be ${ctx.endpoints.fakeModel.containerOpenAiBaseUrl}`
  );
  expectConfig(
    typeof model.api_key === 'string' && model.api_key.length > 0,
    'model.api_key must be non-empty test data'
  );
  expectConfig(
    model.api_mode === 'chat_completions',
    'model.api_mode must be chat_completions'
  );
  expectConfig(
    JSON.stringify(platformToolsets.tlon) ===
      JSON.stringify(['tlon', 'no_mcp']),
    'platform_toolsets.tlon must be exactly [tlon, no_mcp]'
  );
  expectConfig(
    isEmptyObject(config.mcp_servers),
    'mcp_servers must be empty for baseline smoke'
  );
  expectConfig(
    !('web' in config),
    'web config must be absent for baseline smoke'
  );
  expectConfig(
    !('telemetry' in config),
    'telemetry config must be absent for baseline smoke'
  );
  expectConfig(
    Array.isArray(agent.disabled_toolsets) &&
      agent.disabled_toolsets.includes('cronjob'),
    'agent.disabled_toolsets must include cronjob'
  );
  expectConfig(
    expectedKnownBots.includes(ctx.endpoints.ships.mug.ship),
    `TLON_KNOWN_BOT_USERS must include ${ctx.endpoints.ships.mug.ship}`
  );
  expectConfig(
    tlon.known_bot_users === ctx.composeEnv.TLON_KNOWN_BOT_USERS,
    'tlon.known_bot_users must match composed TLON_KNOWN_BOT_USERS'
  );
  expectConfig(
    tlon.max_consecutive_bot_responses === expectedLoopLimit,
    `tlon.max_consecutive_bot_responses must be ${expectedLoopLimit}`
  );
  expectConfig(
    tlon.reply_in_thread === undefined || tlon.reply_in_thread === false,
    'tlon.reply_in_thread must be unset or false for shared thread anchoring'
  );

  if (failures.length > 0) {
    throw new Error(
      `Hermes E2E config assertion failed:\n` +
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

async function assertHermesSetup(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const script = String.raw`
import json
import os
from pathlib import Path

home = Path(os.environ["HERMES_HOME"])
adapter = Path(os.environ["TLON_ADAPTER_DIR"]).resolve()
plugin = (home / "plugins" / "platforms" / "tlon").resolve()
tlon_cli = Path(os.environ["TLON_CLI"])
prompts = {
    "SOUL.md": home / "SOUL.md",
    ".hermes.md": home / ".hermes.md",
    "memories/USER.md": home / "memories" / "USER.md",
}
payload = {
    "plugin_path": str(plugin),
    "adapter_path": str(adapter),
    "plugin_ok": plugin == adapter,
    "plugin_yaml": (plugin / "plugin.yaml").read_text(encoding="utf-8"),
    "prompts_ok": all(path.exists() and "BEGIN tlon-managed:" in path.read_text(encoding="utf-8") for path in prompts.values()),
    "prompt_paths": {name: str(path) for name, path in prompts.items()},
    "tlon_cli": str(tlon_cli),
    "tlon_cli_executable": tlon_cli.exists() and os.access(tlon_cli, os.X_OK),
}
print(json.dumps(payload))
`;
  const result = await compose.exec(ctx.services.bot, [
    'python3',
    '-c',
    script,
  ]);
  assertExecOk(result, 'Hermes setup probe');
  const setup = JSON.parse(result.stdout.trim()) as {
    plugin_ok: boolean;
    plugin_yaml: string;
    prompts_ok: boolean;
    tlon_cli_executable: boolean;
    tlon_cli: string;
  };
  const failures: string[] = [];
  if (!setup.plugin_ok) {
    failures.push(
      'platform plugin symlink does not resolve to workspace adapter'
    );
  }
  if (!setup.plugin_yaml.includes('name: tlon-platform')) {
    failures.push('plugin.yaml does not identify tlon-platform');
  }
  if (!setup.prompts_ok) {
    failures.push('managed prompt files are missing tlon-managed markers');
  }
  if (!setup.tlon_cli_executable) {
    failures.push(`tlon CLI is not executable at ${setup.tlon_cli}`);
  }

  const version = await compose.exec(ctx.services.bot, [
    '/workspace/hermes-dev/bin/tlon',
    '--version',
  ]);
  if (version.exitCode !== 0 || !version.stdout.trim()) {
    failures.push(
      `tlon CLI version failed: ${version.stderr || version.stdout}`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Hermes setup assertion failed:\n${failures
        .map((failure) => `- ${failure}`)
        .join('\n')}`
    );
  }
}

async function assertForbiddenContainerEnv(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const script = [
    'python3',
    '-c',
    `import json, os; print(json.dumps({k: os.environ.get(k) for k in ${JSON.stringify(
      FORBIDDEN_CONTAINER_ENV
    )} if os.environ.get(k)}))`,
  ];
  const result = await compose.exec(ctx.services.bot, script);
  assertExecOk(result, 'Hermes forbidden env probe');
  const forbidden = JSON.parse(result.stdout.trim() || '{}') as Record<
    string,
    string
  >;
  if (Object.keys(forbidden).length > 0) {
    throw new Error(
      `Hermes container inherited forbidden env keys: ${Object.keys(forbidden)
        .sort()
        .join(', ')}`
    );
  }
}

async function readHermesConfig(
  compose: ComposeHandle,
  service: string
): Promise<Record<string, any>> {
  const script = String.raw`
import json
import os
from pathlib import Path

path = Path(os.environ["HERMES_HOME"]) / "config.yaml"
text = path.read_text(encoding="utf-8")
try:
    import yaml
    data = yaml.safe_load(text) or {}
except Exception:
    data = json.loads(text)
print(json.dumps(data))
`;
  const result = await compose.exec(service, ['python3', '-c', script]);
  assertExecOk(result, 'Hermes config read');
  return JSON.parse(result.stdout.trim()) as Record<string, any>;
}

function objectAt(
  config: Record<string, any>,
  key: string
): Record<string, any> {
  const value = config[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isEmptyObject(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
  );
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

function knownBotUsersForSharedLoop(seed: RuntimeSeed): string {
  const ships = new Set([
    seed.endpoints.ships.mug.ship,
    ...shipCsv(process.env.TLON_KNOWN_BOT_USERS),
  ]);
  return [...ships].join(',');
}

function shipCsv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((ship) => normalizeShip(ship.trim()))
    .filter(Boolean);
}

function normalizeShip(ship: string): string {
  return ship ? (ship.startsWith('~') ? ship : `~${ship}`) : '';
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

function maskConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskConfig);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      /key|token|secret|password|credential/i.test(key)
        ? '<redacted>'
        : maskConfig(child),
    ])
  );
}
