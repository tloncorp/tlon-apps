import path from 'node:path';

import { waitFor } from '../runtime/waiters.js';
import type {
  BotDriver,
  ComposeHandle,
  DriverRuntimeSpec,
  RuntimeCapability,
  RuntimeContext,
  RuntimeSeed,
} from './types.js';

// Not HERMES_AGENT_REF: the adapter's Docker dev loop reads that name (pinned
// to a different release), and a developer with it exported would silently
// get a mismatched e2e image. Passed to compose under the build-arg name.
const HERMES_AGENT_REF =
  process.env.TLON_E2E_HERMES_AGENT_REF?.trim() || 'v0.22.6';

// Opt-in LCM lane: TLON_E2E_HERMES_LCM=1 builds the image with an LCM context
// engine plugin and enables it the way the hosted entrypoint does. The default
// is lcm-x at the Hermes plugin-catalog pin; HERMES_LCM_REPO/REF/SUBDIR plus
// TLON_E2E_HERMES_LCM_PLUGIN/ENGINE select another build (e.g. hermes-lcm).
export const HERMES_LCM_ENABLED = /^(1|true|yes|on)$/i.test(
  process.env.TLON_E2E_HERMES_LCM ?? ''
);
const HERMES_LCM_PLUGIN =
  process.env.TLON_E2E_HERMES_LCM_PLUGIN?.trim() || 'hermes-lcm-x';
const HERMES_LCM_ENGINE =
  process.env.TLON_E2E_HERMES_LCM_ENGINE?.trim() || 'lcm-x';
// Applied to every LCM stack. The subdir may be set empty (plugin at the repo
// root). Embeddings default off so the stack never downloads an embedding
// model.
const HERMES_LCM_DEFAULT_ENV = {
  HERMES_LCM_REPO:
    process.env.HERMES_LCM_REPO?.trim() ||
    'https://github.com/electricsheephq/lcm-x.git',
  HERMES_LCM_REF:
    process.env.HERMES_LCM_REF?.trim() ||
    '1a13744482a2448c38d6f9f0b98803f07aac6e81',
  HERMES_LCM_SUBDIR: process.env.HERMES_LCM_SUBDIR?.trim() ?? 'plugin',
  LCM_EMBEDDINGS_ENABLED: process.env.LCM_EMBEDDINGS_ENABLED?.trim() || 'false',
} as const;
const HERMES_LCM_PASSTHROUGH_ENV = [
  'LCM_ENTITIES_ENABLED',
  'LCM_DISABLED_TOOLS',
] as const;
// The targeted compaction scenario runs on its own stack (seed variant below)
// with a budget small enough to compact within a few turns. Every other stack
// keeps the plugin defaults so the small budget never reaches smoke or common
// scenarios. The system prompt plus tool schemas already estimate at ~16k
// tokens, so the threshold must sit above that. Same-named env vars override.
export const HERMES_LCM_COMPACTION_VARIANT = 'lcm-compaction';
const HERMES_LCM_COMPACTION_DEFAULTS = {
  HERMES_MODEL_CONTEXT_LENGTH: '64000',
  LCM_CONTEXT_THRESHOLD: '0.3',
  LCM_FRESH_TAIL_COUNT: '2',
  LCM_LEAF_CHUNK_TOKENS: '2000',
  LCM_MAX_ASSEMBLY_TOKENS: '',
} as const;
// Set by resolveTestEnv from the installed plugin's manifest.
const HERMES_LCM_TOOLS_ENV = 'TLON_E2E_HERMES_LCM_TOOLS';

export function hermesLcmTools(): string[] {
  if (!HERMES_LCM_ENABLED) {
    return [];
  }
  const raw = process.env[HERMES_LCM_TOOLS_ENV];
  if (!raw) {
    throw new Error(
      `${HERMES_LCM_TOOLS_ENV} is unset; the runner derives it from the installed LCM plugin`
    );
  }
  return JSON.parse(raw) as string[];
}

// lcm_grep returns JSON whose top level echoes the query, so recall counts only
// when the marker turns up inside the results array itself.
export function assertLcmGrepRecalls(toolText: string, marker: string): void {
  let parsed: { results?: unknown } | null;
  try {
    parsed = JSON.parse(toolText);
  } catch {
    throw new Error(`lcm_grep result is not JSON: ${toolText.slice(0, 200)}`);
  }
  const results = parsed?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`lcm_grep returned no results: ${toolText.slice(0, 200)}`);
  }
  if (!JSON.stringify(results).includes(marker)) {
    throw new Error(`lcm_grep results do not mention ${marker}`);
  }
}

// The adapter registers set_timezone under the same check as tlon.
function baseTools(): string[] {
  return ['tlon', 'set_timezone', ...hermesLcmTools()];
}

function hermesLcmComposeEnv(seed: RuntimeSeed): Record<string, string> {
  if (!HERMES_LCM_ENABLED) {
    return {};
  }
  const env: Record<string, string> = {
    TLON_E2E_HERMES_LCM: '1',
    TLON_E2E_HERMES_LCM_PLUGIN: HERMES_LCM_PLUGIN,
    TLON_E2E_HERMES_LCM_ENGINE: HERMES_LCM_ENGINE,
    ...HERMES_LCM_DEFAULT_ENV,
  };
  for (const key of HERMES_LCM_PASSTHROUGH_ENV) {
    const value = process.env[key]?.trim();
    if (value) {
      env[key] = value;
    }
  }
  if (seed.variant === HERMES_LCM_COMPACTION_VARIANT) {
    for (const [key, fallback] of Object.entries(
      HERMES_LCM_COMPACTION_DEFAULTS
    )) {
      const value = process.env[key]?.trim() || fallback;
      if (value) {
        env[key] = value;
      }
    }
  }
  return env;
}

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

  // The adapter logs "[tlon] SSE stream error: ..." on a sock_read timeout or
  // an immediate reset/EOF, and "[tlon] SSE stream stale: ..." when the
  // staleness watchdog forces a reconnect.
  streamFaultLogMarkers: ['SSE stream error', 'SSE stream stale'],

  packageDir(seed) {
    return path.join(seed.repoRoot, 'packages/hermes-tlon-adapter');
  },

  async beforeComposeBuild() {
    console.log(`[hermes] hermes-agent ref ${HERMES_AGENT_REF}`);
  },

  resolveRuntime(seed): DriverRuntimeSpec {
    const packageDir = this.packageDir(seed);
    const sharedPackageDir = path.join(seed.repoRoot, 'packages/tlon-bot-e2e');
    const homeChannel = seed.endpoints.ships.ten.ship;
    const knownBotUsers = knownBotUsersForSharedLoop(seed);
    const maxConsecutiveBotResponses = sharedLoopLimitEnv();
    const cronEnabled = hasCapability(seed, 'cron');

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
        TLON_REENGAGEMENT_ENABLED: 'true',
        TLON_NUDGE_TICK_INTERVAL_MS: '5000',
        TLON_TELEMETRY: 'false',
        TLON_CONTEXT_MESSAGES: '4',
        // Eyre emits an SSE keepalive (a ':' comment line) every ~20s, even on
        // an idle channel. The read timeout must sit above that interval or it
        // fires before each heartbeat and tears the stream down on a ~15s loop
        // through otherwise idle scenario setup/settles. 60 (the adapter's
        // production default) clears the 20s heartbeat; the old 15 undercut it.
        TLON_SSE_READ_TIMEOUT_SECONDS: '60',
        TLON_KNOWN_BOT_USERS: knownBotUsers,
        TLON_MAX_CONSECUTIVE_BOT_RESPONSES: maxConsecutiveBotResponses,
        HERMES_MODEL_PROVIDER: 'custom',
        HERMES_MODEL: 'tlon-test-scripted',
        HERMES_MODEL_BASE_URL: seed.endpoints.fakeModel.containerOpenAiBaseUrl,
        HERMES_MODEL_API_KEY: 'no-key-required',
        HERMES_MODEL_API_MODE: 'chat_completions',
        HERMES_GATEWAY_ARGS: '--replace -v',
        HERMES_E2E_ENABLE_CRONJOB: cronEnabled ? '1' : '0',
        ...hermesLcmComposeEnv(seed),
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
        // Scenario processes import this driver too; without the flag their
        // advertised-tool expectations would omit the lcm_* tools.
        ...(HERMES_LCM_ENABLED
          ? {
              TLON_E2E_HERMES_LCM: '1',
              ...(process.env.TLON_E2E_HERMES_LCM_TURNS
                ? {
                    TLON_E2E_HERMES_LCM_TURNS:
                      process.env.TLON_E2E_HERMES_LCM_TURNS,
                  }
                : {}),
            }
          : {}),
      },
    };
  },

  async waitReady(ctx, compose) {
    await waitForHermesLog(ctx, compose);
    await assertHermesConfig(ctx, compose);
    await assertHermesNudgeConfig(ctx, compose);
    await assertHermesSetup(ctx, compose);
    await assertForbiddenContainerEnv(ctx, compose);
  },

  async assertRuntimeConfig(ctx, compose) {
    await assertHermesConfig(ctx, compose);
    await assertHermesNudgeConfig(ctx, compose);
    await assertForbiddenContainerEnv(ctx, compose);
  },

  async resolveTestEnv(ctx, compose): Promise<Record<string, string>> {
    if (!HERMES_LCM_ENABLED) {
      return {};
    }
    const tools = await readHermesLcmTools(compose, ctx.services.bot);
    return { [HERMES_LCM_TOOLS_ENV]: JSON.stringify(tools) };
  },

  model: {
    replyText(text) {
      return {
        steps: [{ kind: 'text', content: text }],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: baseTools() },
          expectedCallCount: 1,
        },
      };
    },

    replyTexts(texts) {
      return {
        steps: texts.map((content) => ({ kind: 'text' as const, content })),
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: baseTools() },
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
          advertisedTools: { exact: baseTools() },
          expectedCallCount: 1,
        },
      };
    },

    botSelfPrefix: '',

    readOrAdmin(command, finalText = 'Hermes completed the tlon command.') {
      return {
        steps: [
          { kind: 'tool_call', name: 'tlon', args: { command } },
          { kind: 'text', content: finalText },
        ],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { exact: baseTools() },
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

    createCronJob({ name, firedPrompt, finalText }) {
      return {
        steps: [
          {
            kind: 'tool_call',
            name: 'cronjob_manage',
            args: {
              action: 'create',
              name,
              // Hermes >= 0.22 reads a bare duration as a recurring interval;
              // 'in <duration>' is the one-shot form.
              schedule: 'in 1m',
              prompt: firedPrompt,
              deliver: 'origin',
            },
          },
          { kind: 'text', content: finalText },
        ],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: {
          advertisedTools: { include: ['cronjob_manage', 'tlon'] },
          expectedCallCount: 2,
          expectedCallSequence: [
            { kind: 'model_request' },
            { kind: 'tool_call', toolName: 'cronjob_manage' },
            { kind: 'model_request' },
            { kind: 'final_model_text' },
          ],
          toolLoopResult: true,
          streamedToolLoop: true,
        },
      };
    },

    looseReplyText(text) {
      return {
        steps: [{ kind: 'text', content: text }],
        options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
        expectations: { expectedCallCount: 1 },
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
  const cronEnabled = hasCapability(ctx, 'cron');
  const expectedTlonToolsets = [
    ...(cronEnabled ? ['tlon', 'cronjob', 'no_mcp'] : ['tlon', 'no_mcp']),
    ...(HERMES_LCM_ENABLED ? ['context_engine'] : []),
  ];
  const expectedPlugins = HERMES_LCM_ENABLED
    ? ['platforms/tlon', HERMES_LCM_PLUGIN]
    : ['platforms/tlon'];

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
      JSON.stringify(expectedTlonToolsets),
    `platform_toolsets.tlon must be exactly [${expectedTlonToolsets.join(', ')}]`
  );
  expectConfig(
    JSON.stringify(objectAt(config, 'plugins').enabled) ===
      JSON.stringify(expectedPlugins),
    `plugins.enabled must be exactly [${expectedPlugins.join(', ')}]`
  );
  expectConfig(
    HERMES_LCM_ENABLED
      ? objectAt(config, 'context').engine === HERMES_LCM_ENGINE
      : !('context' in config),
    HERMES_LCM_ENABLED
      ? `context.engine must be ${HERMES_LCM_ENGINE} in the LCM lane`
      : 'context config must be absent without LCM'
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
      agent.disabled_toolsets.includes('cronjob') !== cronEnabled,
    cronEnabled
      ? 'agent.disabled_toolsets must not include cronjob in the cron partition'
      : 'agent.disabled_toolsets must include cronjob'
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

async function assertHermesNudgeConfig(
  ctx: RuntimeContext,
  compose: ComposeHandle
): Promise<void> {
  const script = String.raw`
import json
import os
import sys

sys.path.insert(0, os.environ["TLON_ADAPTER_DIR"])
from tlon_api import TlonConfig

config = TlonConfig.from_env()
print(json.dumps({
    "reengagement_enabled": config.reengagement_enabled,
    "nudge_tick_interval_ms": config.nudge_tick_interval_ms,
}))
`;
  const result = await compose.exec(ctx.services.bot, [
    'python3',
    '-c',
    script,
  ]);
  assertExecOk(result, 'Hermes nudge config probe');
  const config = JSON.parse(result.stdout.trim()) as {
    reengagement_enabled: boolean;
    nudge_tick_interval_ms: number;
  };
  if (
    config.reengagement_enabled !== true ||
    config.nudge_tick_interval_ms !== 5000
  ) {
    throw new Error(
      `Hermes nudge config is ineffective: ${JSON.stringify(config)}`
    );
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

// The lcm_* tools the installed plugin advertises through the context_engine
// toolset. lcm-x keeps flag-gated tools dormant (its tool_registry marks each
// with the config field that wakes it, e.g. lcm_memory needs entities), so ask
// its own registry and config; hermes-lcm has no registry and advertises every
// tool its manifest declares. LCM_DISABLED_TOOLS hides tools in both.
async function readHermesLcmTools(
  compose: ComposeHandle,
  service: string
): Promise<string[]> {
  const script = String.raw`
import importlib, importlib.util, json, os, sys, tempfile
from pathlib import Path
import yaml
plugin = os.environ.get("TLON_E2E_HERMES_LCM_PLUGIN") or "hermes-lcm-x"
plugin_dir = (Path(os.environ["HERMES_HOME"]) / "plugins" / plugin).resolve()
manifest = yaml.safe_load((plugin_dir / "plugin.yaml").read_text(encoding="utf-8")) or {}
tools = [str(t) for t in manifest.get("provides_tools") or []]
if (plugin_dir / "tool_registry.py").exists():
    os.environ["LCM_DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "probe.db")
    spec = importlib.util.spec_from_file_location("lcm_tool_probe", plugin_dir / "__init__.py", submodule_search_locations=[str(plugin_dir)])
    module = importlib.util.module_from_spec(spec)
    sys.modules["lcm_tool_probe"] = module
    spec.loader.exec_module(module)
    config = importlib.import_module("lcm_tool_probe.config").LCMConfig.from_env()
    registry = importlib.import_module("lcm_tool_probe.tool_registry").TOOL_REGISTRY
    tools = [s.name for s in registry if not (s.dormant_unless and not getattr(config, s.dormant_unless))]
disabled = {t.strip() for t in (os.environ.get("LCM_DISABLED_TOOLS") or "").split(",") if t.strip()}
print(json.dumps({"name": manifest.get("name"), "version": str(manifest.get("version")), "tools": [t for t in tools if t not in disabled]}))
`;
  const result = await compose.exec(service, [
    '/opt/hermes-venv/bin/python',
    '-c',
    script,
  ]);
  assertExecOk(result, 'LCM plugin manifest read');
  const manifest = JSON.parse(
    result.stdout.trim().split('\n').at(-1) ?? ''
  ) as {
    name: string;
    version: string;
    tools: string[];
  };
  if (manifest.name !== HERMES_LCM_PLUGIN || manifest.tools.length === 0) {
    throw new Error(
      `LCM plugin manifest mismatch: expected ${HERMES_LCM_PLUGIN} with tools, got ${result.stdout.trim()}`
    );
  }
  console.log(
    `[hermes-lcm] ${manifest.name} ${manifest.version}: expecting ${manifest.tools.length} tools ${manifest.tools.join(', ')}`
  );
  return manifest.tools;
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

function hasCapability(
  seed: Pick<RuntimeSeed, 'capabilityPartition'>,
  capability: RuntimeCapability
): boolean {
  return seed.capabilityPartition?.capabilities.includes(capability) ?? false;
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
