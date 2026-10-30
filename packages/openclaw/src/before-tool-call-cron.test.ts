import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import entry from '../index.js';
import { runBrowserSessionHandoff } from './browser-session-handoff.js';

import { publishContextLensEvent } from './context-lens-events.js';
import {
  recordContextLensToolResultForSession,
  scheduleBackgroundContextLensFinalization,
} from './context-lens.js';
import { coreMessageMedia } from './core-message-media.js';
import { CRON_ARGS_BLOCK_REASON } from './cron-tool-args-guard.js';
import {
  clearCronJobForSession,
  rememberCronJobForSession,
} from './mcp-readonly-policy.js';
import { isAgentOnboardingCronJob } from './monitor/agent-onboarding.js';
import {
  _testing as boundaryTesting,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';
import {
  LOCAL_FILE_BLOCK_REASON,
  MESSAGE_MEDIA_BLOCK_REASON,
  SESSION_ACCESS_BLOCK_REASON,
  formatOwnerOnlyDelegationBlockReason,
  formatOwnerOnlyToolBlockReason,
} from './owner-only-tools.js';
import { _testing, setSessionRole } from './session-roles.js';
import { TLON_APP_BROWSER_BLOCK_REASON } from './tlon-app-browser-gate.js';

vi.mock('./browser-session-handoff.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./browser-session-handoff.js')>()),
  runBrowserSessionHandoff: vi.fn().mockResolvedValue('Card sent'),
}));

vi.mock('./context-lens.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./context-lens.js')>();
  const blockedLens = actual
    .createContextLensRegistry({ ttlMs: 60_000 })
    .create({ messageId: 'blocked-cron', chatType: 'dm', trigger: 'dm' });
  return {
    ...actual,
    recordContextLensToolResultForSession: vi.fn(() => blockedLens),
    scheduleBackgroundContextLensFinalization: vi.fn(),
  };
});

vi.mock('./context-lens-events.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./context-lens-events.js')>();
  return {
    ...actual,
    publishContextLensEvent: vi.fn(),
  };
});

vi.mock('./core-message-media.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./core-message-media.js')>();
  return {
    ...actual,
    coreMessageMedia: vi.fn(actual.coreMessageMedia),
  };
});

vi.mock('./monitor/agent-onboarding.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./monitor/agent-onboarding.js')>();
  return {
    ...actual,
    isAgentOnboardingCronJob: vi.fn(async () => false),
    agentOnboardingCronProviderIds: vi.fn(async () => ['linear']),
    agentOnboardingCronChannelNest: vi.fn(async () => undefined),
  };
});

type BeforeToolCallResult =
  | { block?: boolean; blockReason?: string }
  | undefined;

type BeforeToolCallHandler = (
  event: { toolName: string; params: Record<string, unknown> },
  ctx: { sessionKey: string }
) => Promise<BeforeToolCallResult>;

const OWNER_SESSION = 'tlon:dm:~sampel-palnet';
const USER_SESSION = 'tlon:dm:~zod';
const handoffRecords = new Map<string, unknown>();
beforeEach(() => handoffRecords.clear());

/**
 * Config that turns Context Lens recording on: the routes reader goes live once
 * the lens is enabled and an auth token is set, and the disk store stays off so
 * the test writes nothing.
 */
const CONTEXT_LENS_CONFIG = {
  channels: {
    tlon: {
      contextLens: {
        enabled: true,
        authToken: 'lens-token',
        store: { enabled: false },
      },
    },
  },
};

/**
 * Recording stand-in for the plugin api. `registrationMode` is the literal
 * 'full' so the entry contract runs the real registerFull pass; every other
 * member is a no-op whose nested property access returns the same proxy.
 * `config` is a plain object — bare by default, so account resolution takes its
 * unconfigured path instead of walking the proxy.
 */
function createRecordingApi(config: Record<string, unknown> = {}): {
  api: unknown;
  hooks: Map<string, unknown>;
  logs: string[];
  leveledLogs: string[];
} {
  const hooks = new Map<string, unknown>();
  const logs: string[] = [];
  const leveledLogs: string[] = [];
  const describeSelf = () => '[recording-api]';
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') {
        return 'full';
      }
      if (prop === 'config') {
        return config;
      }
      if (prop === 'runtime') {
        return new Proxy(() => undefined, {
          get(_runtime, key) {
            if (key === 'config') return { current: () => config };
            return Reflect.get(proxy as object, key);
          },
        });
      }

      if (prop === 'openKeyedStore') {
        return () => ({
          lookup: async (key: string) => handoffRecords.get(key),
        });
      }
      if (prop === 'enqueueSystemEvent') {
        return (message: string, options: { sessionKey: string }) => {
          logs.push(`system:${options.sessionKey}:${message}`);
        };
      }
      if (prop === 'on') {
        return (name: string, handler: unknown) => {
          hooks.set(name, handler);
        };
      }
      if (
        prop === 'info' ||
        prop === 'warn' ||
        prop === 'error' ||
        prop === 'debug' ||
        prop === 'log'
      ) {
        return (message: unknown) => {
          logs.push(String(message));
          leveledLogs.push(`${prop}:${String(message)}`);
        };
      }
      if (prop === 'toString' || prop === 'valueOf') {
        return describeSelf;
      }
      // `then` must stay undefined so an awaited proxy resolves to itself.
      if (prop === 'then' || typeof prop === 'symbol') {
        return undefined;
      }
      return proxy;
    },
    apply: () => proxy,
  });
  return { api: proxy, hooks, logs, leveledLogs };
}

function registerEntry(config?: Record<string, unknown>): {
  handler: BeforeToolCallHandler;
  logs: string[];
  leveledLogs: string[];
  hooks: Map<string, unknown>;
} {
  const { api, hooks, logs, leveledLogs } = createRecordingApi(config);
  entry.register(api as never);
  expect(hooks.has('before_tool_call')).toBe(true);
  return {
    handler: hooks.get('before_tool_call') as BeforeToolCallHandler,
    logs,
    leveledLogs,
    hooks,
  };
}

function cronArgsBlockedLogs(logs: string[]): string[] {
  return logs.filter((line) => /^\[tlon\] cron args blocked/.test(line));
}

function allowedLogs(logs: string[]): string[] {
  return logs.filter((line) => /^\[tlon\] Allowed /.test(line));
}

const TOOL_TRACE_BEFORE_PREFIX = 'tooltrace before: ';

function beforeToolTracePayloads(logs: string[]): Record<string, unknown>[] {
  return logs
    .filter((line) => line.startsWith(TOOL_TRACE_BEFORE_PREFIX))
    .map((line) => {
      const body = JSON.parse(line.slice(TOOL_TRACE_BEFORE_PREFIX.length)) as {
        payload: Record<string, unknown>;
      };
      return body.payload;
    });
}

// The flat spelling core also accepts. Cleaning leaves it as sent, so the
// guard still has to catch it.
const DIRTY_ADD = {
  toolName: 'cron',
  params: {
    action: 'add',
    name: 'daily',
    payload: { fallbacks: [] },
  },
};

const DIRTY_AUTOMATIONS_ADD = {
  toolName: 'automations',
  params: {
    action: 'add',
    name: 'daily',
    payload: { fallbacks: [] },
  },
};

// The shape the model sends: the tool's nested job, with the placeholders.
const DIRTY_NESTED_ADD = {
  toolName: 'cron',
  params: {
    action: 'add',
    job: {
      name: 'daily',
      payload: { kind: 'agentTurn', message: 'summarize', fallbacks: [] },
      delivery: {
        mode: 'announce',
        channel: 'tlon',
        to: '~zod',
        bestEffort: true,
      },
    },
  },
};

const CLEAN_ADD = {
  toolName: 'cron',
  params: {
    action: 'add',
    job: {
      name: 'daily',
      payload: { kind: 'agentTurn', message: 'summarize' },
    },
  },
};

describe('before_tool_call cron args guard', () => {
  beforeEach(() => {
    _testing.clearAll();
    setSessionRole(OWNER_SESSION, 'owner');
    setSessionRole(USER_SESSION, 'user');
    vi.mocked(recordContextLensToolResultForSession).mockClear();
    vi.mocked(scheduleBackgroundContextLensFinalization).mockClear();
    vi.mocked(publishContextLensEvent).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _testing.clearAll();
  });

  it('blocks an owner cron add that carries an empty fallbacks list', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(1);
    expect(cronArgsBlockedLogs(logs)[0]).toContain(
      'payload.fallbacks=empty-fallbacks'
    );
  });

  it('blocks an owner automations add that carries an empty fallbacks list', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_AUTOMATIONS_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(1);
    expect(cronArgsBlockedLogs(logs)[0]).toContain(
      'payload.fallbacks=empty-fallbacks'
    );
  });

  it('never logs a vetoed cron add as allowed', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(1);
    expect(allowedLogs(logs)).toHaveLength(0);
  });

  it('traces a vetoed cron add as blocked with the guard reason', async () => {
    vi.stubEnv('TEST_LIVE_TOOL_TRACE_CONTENTS', '1');
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
    const payloads = beforeToolTracePayloads(logs);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      blocked: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
  });

  it('traces an allowed owner cron add as not blocked', async () => {
    vi.stubEnv('TEST_LIVE_TOOL_TRACE_CONTENTS', '1');
    const { handler, logs } = registerEntry();
    await expect(
      handler(CLEAN_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({ params: CLEAN_ADD.params });
    const payloads = beforeToolTracePayloads(logs);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.blocked).toBe(false);
    expect(payloads[0]).not.toHaveProperty('blockReason');
    expect(allowedLogs(logs)).toHaveLength(1);
  });

  it('records the guard block as a blocked Context Lens tool result', async () => {
    const { handler } = registerEntry(CONTEXT_LENS_CONFIG);
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: CRON_ARGS_BLOCK_REASON,
    });
    expect(recordContextLensToolResultForSession).toHaveBeenCalledTimes(1);
    expect(recordContextLensToolResultForSession).toHaveBeenCalledWith(
      OWNER_SESSION,
      'cron',
      expect.objectContaining({
        error: CRON_ARGS_BLOCK_REASON,
        status: 'blocked',
      })
    );
  });

  it('publishes the blocked lens and schedules its finalization', async () => {
    const { handler } = registerEntry(CONTEXT_LENS_CONFIG);
    await handler(DIRTY_ADD, { sessionKey: OWNER_SESSION });
    const blockedLens = vi.mocked(recordContextLensToolResultForSession).mock
      .results[0]?.value;
    expect(blockedLens).toBeTruthy();
    expect(publishContextLensEvent).toHaveBeenCalledWith(
      'tool_result',
      blockedLens,
      expect.objectContaining({ toolName: 'cron', toolPhase: 'blocked' })
    );
    expect(scheduleBackgroundContextLensFinalization).toHaveBeenCalledWith(
      OWNER_SESSION,
      expect.any(Function)
    );
  });

  it('cleans an allowed add under the automations name too', async () => {
    const { handler } = registerEntry();
    await expect(
      handler(
        {
          toolName: 'automations',
          params: {
            action: 'add',
            agentId: '',
            job: { ...CLEAN_ADD.params.job, sessionTarget: '' },
          },
        },
        { sessionKey: OWNER_SESSION }
      )
    ).resolves.toEqual({ params: CLEAN_ADD.params });
  });

  it('allows an owner cron add without the forbidden arguments', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(CLEAN_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({ params: CLEAN_ADD.params });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
  });

  it('still blocks a non-owner cron call with the owner-only reason', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: USER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('cron'),
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
  });

  it.each([
    ['a dirty', DIRTY_AUTOMATIONS_ADD],
    ['a clean', { ...CLEAN_ADD, toolName: 'automations' }],
  ])(
    'blocks %s non-owner call under the automations name',
    async (_name, call) => {
      const { handler, logs } = registerEntry();
      await expect(
        handler(call, { sessionKey: USER_SESSION })
      ).resolves.toEqual({
        block: true,
        blockReason: formatOwnerOnlyToolBlockReason('automations'),
      });
      expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
      expect(allowedLogs(logs)).toHaveLength(0);
    }
  );

  it('traces a non-owner cron call with the owner-only reason, not the guard reason', async () => {
    vi.stubEnv('TEST_LIVE_TOOL_TRACE_CONTENTS', '1');
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: USER_SESSION })
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('cron'),
    });
    const payloads = beforeToolTracePayloads(logs);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      blocked: true,
      blockReason: formatOwnerOnlyToolBlockReason('cron'),
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
    expect(allowedLogs(logs)).toHaveLength(0);
  });

  it("cleans the model's usual add instead of blocking it", async () => {
    const { handler, logs } = registerEntry();
    // Blocked, the model retried with the same fields dozens of times on a
    // real gateway; cleaned, the job is made on the first call.
    await expect(
      handler(DIRTY_NESTED_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toEqual({
      params: {
        action: 'add',
        job: {
          name: 'daily',
          payload: { kind: 'agentTurn', message: 'summarize' },
          delivery: { mode: 'announce', channel: 'tlon', to: '~zod' },
        },
      },
    });
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
  });

  it('does not block the forbidden arguments when the guard is disabled', async () => {
    vi.stubEnv('TLON_CRON_ARGS_GUARD', '0');
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toBeUndefined();
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
  });
});

describe('saved login approval hook', () => {
  it('delivers again on a new turn and clears delivery state at agent end', async () => {
    vi.mocked(runBrowserSessionHandoff).mockClear();
    const { hooks } = registerEntry();
    type Context = { sessionKey: string; runId?: string };
    const after = hooks.get('after_tool_call') as (
      event: unknown,
      ctx: Context
    ) => Promise<void>;
    const end = hooks.get('agent_end') as (
      event: unknown,
      ctx: Context
    ) => void;
    const event = {
      toolName: 'mcp__call',
      params: {
        name: 'browser_browser_login',
        arguments: {
          session_id: 'same-browser',
          action: 'use',
          fields: ['@e12'],
        },
      },
      result: {
        details: {
          structuredContent: {
            session_id: 'same-browser',
            login: { status: 'approval_required' },
          },
        },
      },
    };
    const first = { sessionKey: OWNER_SESSION, runId: 'first' };
    const second = { sessionKey: OWNER_SESSION, runId: 'second' };
    await after(event, first);
    await after(event, first);
    expect(runBrowserSessionHandoff).toHaveBeenCalledTimes(1);
    await after(event, second);
    expect(runBrowserSessionHandoff).toHaveBeenCalledTimes(2);
    end({ messages: [], success: true, durationMs: 1 }, second);
    await after(event, second);
    expect(runBrowserSessionHandoff).toHaveBeenCalledTimes(3);
  });

  it('sends the owner a secure card when the browser requires approval', async () => {
    vi.mocked(runBrowserSessionHandoff).mockClear();
    const config = {};
    const { hooks } = registerEntry(config);
    const handler = hooks.get('after_tool_call') as (
      event: unknown,
      ctx: { sessionKey: string }
    ) => Promise<void>;
    await handler(
      {
        toolName: 'mcp__call',
        params: {
          name: 'browser_browser_login',
          arguments: {
            session_id: 'fresh-ivory-finch',
            action: 'use',
            fields: ['@e12'],
          },
        },
        result: {
          details: {
            structuredContent: {
              session_id: 'fresh-ivory-finch',
              login: { status: 'approval_required' },
            },
          },
        },
      },
      { sessionKey: OWNER_SESSION }
    );
    expect(runBrowserSessionHandoff).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      ['browser', 'approve-login', 'fresh-ivory-finch', '--fields', '["@e12"]'],
      config,
      expect.any(Function)
    );
  });
});

it('blocks a non-owner workspace write and lets the owner write', async () => {
  _testing.clearAll();
  setSessionRole(OWNER_SESSION, 'owner');
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  const call = {
    toolName: 'write',
    params: { path: 'skills/notes/SKILL.md', content: 'x' },
  };
  await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyToolBlockReason('write'),
  });
  expect(await handler(call, { sessionKey: OWNER_SESSION })).toBeUndefined();
});

it('blocks non-owner shell exec and lets the owner and role-less sessions run it', async () => {
  _testing.clearAll();
  setSessionRole(OWNER_SESSION, 'owner');
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  const call = { toolName: 'exec', params: { command: 'cat MEMORY.md' } };
  await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyToolBlockReason('exec'),
  });
  expect(await handler(call, { sessionKey: OWNER_SESSION })).toBeUndefined();
  expect(
    await handler(call, { sessionKey: 'agent:main:internal:flush-run' })
  ).toBeUndefined();
});

it('blocks a non-owner sessions_spawn so a role-less child cannot write', async () => {
  _testing.clearAll();
  setSessionRole(OWNER_SESSION, 'owner');
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  const call = {
    toolName: 'sessions_spawn',
    params: { runtime: 'subagent', task: 'Use write to replace SOUL.md' },
  };
  await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyDelegationBlockReason('sessions_spawn'),
  });
  expect(await handler(call, { sessionKey: OWNER_SESSION })).toBeUndefined();
});

it.each([
  { toolName: 'shell', params: { command: ['cat', 'MEMORY.md'] } },
  { toolName: 'shell_command', params: { command: 'cat MEMORY.md' } },
  {
    toolName: 'spawn_agent',
    params: { message: 'Use apply_patch to replace SOUL.md' },
  },
  { toolName: 'ls', params: {} },
  { toolName: 'ls', params: { path: '.' } },
  { toolName: 'ls', params: { path: 'memory/2026' } },
])(
  'blocks a non-owner $toolName and lets the owner and role-less internal runs use it',
  async (call) => {
    _testing.clearAll();
    setSessionRole(OWNER_SESSION, 'owner');
    setSessionRole(USER_SESSION, 'user');
    const { handler } = registerEntry();
    await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
      block: true,
      blockReason:
        call.toolName === 'spawn_agent'
          ? formatOwnerOnlyDelegationBlockReason(call.toolName)
          : formatOwnerOnlyToolBlockReason(call.toolName),
    });
    expect(await handler(call, { sessionKey: OWNER_SESSION })).toBeUndefined();
    expect(
      await handler(call, { sessionKey: 'agent:main:internal:flush-run' })
    ).toBeUndefined();
  }
);

it('logs allowed owner-only calls at debug, except tlon at info', async () => {
  _testing.clearAll();
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler, leveledLogs } = registerEntry();
  const allowedAt = (level: string) =>
    leveledLogs.filter((line) => line.startsWith(`${level}:[tlon] Allowed `));
  await handler(
    { toolName: 'exec', params: { command: 'ls' } },
    { sessionKey: OWNER_SESSION }
  );
  expect(allowedAt('debug')).toEqual([
    `debug:[tlon] Allowed exec tool for owner session. Session: ${OWNER_SESSION}`,
  ]);
  expect(allowedAt('info')).toEqual([]);
  await handler(
    { toolName: 'tlon', params: { command: 'contacts list' } },
    { sessionKey: OWNER_SESSION }
  );
  expect(allowedAt('info')).toEqual([
    `info:[tlon] Allowed tlon tool for owner session. Session: ${OWNER_SESSION}`,
  ]);
  expect(allowedAt('debug')).toHaveLength(1);
});

it('blocks non-owner saved login and shared browser access before dispatch', async () => {
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  for (const name of [
    'browser_browser_login',
    'browser_browser_snapshot',
    'browser_browser_act',
    'browser_login',
    'browser_snapshot',
    'browser_act',
  ]) {
    expect(
      await handler(
        {
          toolName: 'mcp__call',
          params: { name, arguments: { action: 'use' } },
        },
        { sessionKey: USER_SESSION }
      )
    ).toMatchObject({
      block: true,
      blockReason: expect.stringContaining('owner-only'),
    });
  }
});

// Real-shaped calls a group participant asks a hosted bot to make through its
// configured Linear and GitHub connections on the ship's %mcp-proxy.
const NON_OWNER_MCP_CALLS = [
  { toolName: 'mcp__list_upstreams', params: {} },
  {
    toolName: 'mcp__search',
    params: { query: 'server:linear issue', limit: 25 },
  },
  { toolName: 'mcp__describe', params: { name: 'linear_create_issue' } },
  {
    toolName: 'mcp__call',
    params: {
      name: 'linear_create_issue',
      arguments: {
        team: 'Tlon',
        title: 'Test issue',
        description:
          'See README.md and packages/openclaw/src/owner-only-tools.ts in tloncorp/tlon-apps',
      },
    },
  },
  {
    toolName: 'mcp__call',
    params: {
      name: 'github_get_file',
      arguments: { repo: 'tloncorp/tlon-apps', path: 'README.md' },
    },
  },
];

it('lets a non-owner session use the four MCP catalog tools', async () => {
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  for (const call of NON_OWNER_MCP_CALLS) {
    await expect(
      handler(call, { sessionKey: USER_SESSION })
    ).resolves.toBeUndefined();
  }
});

it('blocks the MCP resource and prompt tools for a non-owner session with the owner-only reason', async () => {
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  for (const toolName of [
    'mcp__resources_list',
    'mcp__resources_read',
    'mcp__prompts_list',
    'mcp__prompts_get',
  ]) {
    await expect(
      handler(
        { toolName, params: { uri: 'linear://issue/TLON-6944' } },
        { sessionKey: USER_SESSION }
      )
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason(toolName),
    });
  }
});

it('decides the Codex native MCP spelling like the core one', async () => {
  setSessionRole(USER_SESSION, 'user');
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler } = registerEntry();
  await expect(
    handler(
      {
        toolName: 'mcp__mcp__call',
        params: {
          name: 'linear_get_issue',
          arguments: { id: 'TLON-6944' },
        },
      },
      { sessionKey: USER_SESSION }
    )
  ).resolves.toBeUndefined();
  await expect(
    handler(
      {
        toolName: 'mcp__mcp__call',
        params: { name: 'browser_browser_snapshot', arguments: {} },
      },
      { sessionKey: USER_SESSION }
    )
  ).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyToolBlockReason('browser'),
  });
  await expect(
    handler(
      { toolName: 'mcp__mcp__resources_read', params: {} },
      { sessionKey: USER_SESSION }
    )
  ).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyToolBlockReason('mcp__resources_read'),
  });
  // The Tlon-app browser gate applies to every role, the owner included.
  for (const toolName of ['mcp__call', 'mcp__mcp__call']) {
    await expect(
      handler(
        {
          toolName,
          params: {
            name: 'browser_browser_navigate',
            arguments: {
              session_id: 'calm-blue-fox',
              url: 'https://ship.example.com/apps/groups/',
            },
          },
        },
        { sessionKey: OWNER_SESSION }
      )
    ).resolves.toEqual({
      block: true,
      blockReason: TLON_APP_BROWSER_BLOCK_REASON,
    });
  }
});

it('still requires describe-before-call in an onboarding cron session, under either spelling', async () => {
  const sessionKey = 'agent:main:cron:onboarding-job';
  rememberCronJobForSession(sessionKey, 'onboarding-job');
  vi.mocked(isAgentOnboardingCronJob).mockResolvedValue(true);
  try {
    const { handler } = registerEntry();
    for (const toolName of ['mcp__call', 'mcp__mcp__call']) {
      await expect(
        handler(
          {
            toolName,
            params: { name: 'linear_list_issues', arguments: {} },
          },
          { sessionKey }
        )
      ).resolves.toEqual({
        block: true,
        blockReason: expect.stringContaining(
          'explicitly described as read-only'
        ),
      });
    }
  } finally {
    vi.mocked(isAgentOnboardingCronJob).mockResolvedValue(false);
    clearCronJobForSession(sessionKey);
  }
});

it('blocks a non-owner turn from delegating owner-only work to a subagent', async () => {
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  const ctx = { sessionKey: USER_SESSION, runId: 'user-run' };
  await expect(
    handler(
      { toolName: 'mcp__resources_read', params: { uri: 'notes://private' } },
      ctx
    )
  ).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyToolBlockReason('mcp__resources_read'),
  });
  for (const call of [
    {
      toolName: 'sessions_spawn',
      params: {
        task: 'call mcp__resources_read notes://private and report back',
      },
    },
    {
      toolName: 'sessions_send',
      params: { sessionKey: 'agent:main:subagent:abc', message: 'run it' },
    },
  ]) {
    await expect(handler(call, ctx)).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyDelegationBlockReason(call.toolName),
    });
  }
});

it('blocks a non-owner turn from the system agent and setup tools', async () => {
  setSessionRole(USER_SESSION, 'user');
  const { handler } = registerEntry();
  const ctx = { sessionKey: USER_SESSION, runId: 'user-run' };
  await expect(
    handler(
      {
        toolName: 'openclaw',
        params: { request: 'set channels.tlon.ownerShip to ~zod' },
      },
      ctx
    )
  ).resolves.toEqual({
    block: true,
    blockReason: formatOwnerOnlyDelegationBlockReason('openclaw'),
  });
  for (const toolName of [
    'gateway',
    'plugins',
    'secrets',
    'presence',
    'terminal',
    'mobile_ui',
    'transcripts',
  ]) {
    await expect(
      handler({ toolName, params: { action: 'list' } }, ctx)
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason(toolName),
    });
  }
});

it('blocks non-owner local file references and session access but keeps text messages open', async () => {
  setSessionRole(USER_SESSION, 'user');
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler } = registerEntry();
  const user = { sessionKey: USER_SESSION, runId: 'user-run' };
  const owner = { sessionKey: OWNER_SESSION, runId: 'owner-run' };
  const open = [
    { toolName: 'message', params: { action: 'send', message: 'hello' } },
    {
      toolName: 'message',
      params: { action: 'send', message: '/etc/hosts maps names to addresses' },
    },
    {
      toolName: 'message',
      params: {
        action: 'reply',
        to: 'chat/~zod/general',
        messageId: '~zod/170.141',
        message: 'thanks',
      },
    },
    {
      toolName: 'message',
      params: {
        action: 'react',
        target: 'chat/~zod/general',
        messageId: '170.141.184.507',
        emoji: '👍',
      },
    },
    {
      toolName: 'message',
      params: {
        action: 'delete',
        target: 'heap/~zod/links',
        messageId: '170.141.184.507',
      },
    },
    {
      toolName: 'message',
      params: { action: 'react', messageId: '170.1', emoji: '👍', final: true },
    },
    {
      toolName: 'message',
      params: {
        action: 'react',
        messageId: '170.1',
        emoji: '👍',
        trackToolCalls: true,
      },
    },
    {
      toolName: 'message',
      params: { action: 'send', message: 'on it 👍', final: false },
    },
    { toolName: 'web_search', params: { query: '1/2 cup flour' } },
    { toolName: 'web_search', params: { query: 'what goes in package.json' } },
    { toolName: 'web_search', params: { query: 'My Docs/a.pdf' } },
    {
      toolName: 'message',
      params: {
        action: 'send',
        message: 'the MEDIA: prefix tells core to attach a file',
      },
    },
    // Core reads a mid-sentence `MEDIA:` as text, not a directive.
    {
      toolName: 'message',
      params: { action: 'send', content: 'see this MEDIA: "report.bin"' },
    },
    { toolName: 'session_status', params: {} },
    { toolName: 'session_status', params: { changesSince: 2 } },
  ];
  for (const call of open) {
    await expect(handler(call, user)).resolves.toBeUndefined();
  }
  const media = [
    { action: 'send', message: 'here', attachments: [{ media: 'a' }] },
    {
      action: 'send',
      attachments: [{ media: 'https://example.com/a.png' }],
    },
    { action: 'send', SendMessage: 'hi\nMEDIA: /x' },
    { action: 'send', message: 'hello\\nMEDIA:/x' },
    { action: 'send', message: 'hi', filename: 'a.txt' },
    {
      action: 'send',
      message: 'ME\uE200cite\uE201DIA: /workspace/private.txt',
    },
    { action: 'send', message: 'ME\u200DDIA: /workspace/private.txt' },
    { action: 'send', message: 'ME<think>x</thinking>DIA: /x' },
    {
      action: 'send',
      target: '~zod',
      text: 'ME<fi<final>na</final>l>D</final>IA: /workspace/private.txt',
    },
    {
      action: 'send',
      content: 'ME<fi<final>na</final>l>D</final>IA: /workspace/private.txt',
    },
    {
      action: 'send',
      SendMessage:
        'ME<fi<final>na</final>l>D</final>IA: /workspace/private.txt',
    },
    {
      action: 'send',
      message:
        'ME<fi<fi<final>na</final>l>na</final>l>D</final>IA: /workspace/private.txt',
    },
    { action: 'send', message: 'MEDIA: /x.png' },
    { action: 'send', message: '', caption: 'MEDIA: private.png' },
    { action: 'send', message: 'ME<final>D</final>IA: /x' },
    { action: 'send', message: 'ME<think>s</THINK>DIA: /x' },
    { action: 'send', message: 'ME\uE200ci<think>x</think>te\uE201DIA: /x' },
  ];
  for (const params of media) {
    const call = { toolName: 'message', params };
    await expect(handler(call, user)).resolves.toEqual({
      block: true,
      blockReason: MESSAGE_MEDIA_BLOCK_REASON,
    });
    await expect(handler(call, owner)).resolves.toBeUndefined();
  }
  const localFiles = [
    { toolName: 'web_fetch', params: { query: 'My Docs/a.pdf' } },
    { toolName: 'web_search', params: { query: 'x', path: '~/notes/a.pdf' } },
    { toolName: 'web_fetch', params: { url: '/workspace/a.wav' } },
  ];
  for (const call of localFiles) {
    await expect(handler(call, user)).resolves.toEqual({
      block: true,
      blockReason: LOCAL_FILE_BLOCK_REASON,
    });
    await expect(handler(call, owner)).resolves.toBeUndefined();
  }
  // Tool Search dispatch: the control passes, and core gates the
  // target again under its own name.
  for (const [control, target, targetBlocked] of [
    [
      {
        toolName: 'tool_call',
        params: { id: 'web_fetch', args: { url: 'https://example.com' } },
      },
      { toolName: 'web_fetch', params: { url: 'https://example.com' } },
      false,
    ],
    [
      {
        toolName: 'tool_call',
        params: { id: 'read', args: { path: '/workspace/SOUL.md' } },
      },
      { toolName: 'read', params: { path: '/workspace/SOUL.md' } },
      true,
    ],
    [
      { toolName: 'tool_describe', params: { id: 'web_fetch' } },
      { toolName: 'openclawweb_fetch', params: { url: 'https://example.com' } },
      false,
    ],
    [
      { toolName: 'tool_search', params: { query: 'read a file' } },
      {
        toolName: 'openclaw_directread',
        params: { path: '/workspace/SOUL.md' },
      },
      true,
    ],
  ] as const) {
    await expect(handler(control, user)).resolves.toBeUndefined();
    await expect(handler(target, user)).resolves.toEqual(
      targetBlocked
        ? { block: true, blockReason: formatOwnerOnlyToolBlockReason('read') }
        : undefined
    );
    await expect(handler(target, owner)).resolves.toBeUndefined();
  }
  for (const call of [
    { toolName: 'exec', params: { command: 'cat /workspace/SOUL.md' } },
    { toolName: 'exec', params: { code: 'return 1' } },
    {
      toolName: 'exec',
      toolKind: 'code_mode_exec',
      params: { title: 'skills', code: 'return await skills.list()' },
    },
  ]) {
    await expect(handler(call, user)).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason('exec'),
    });
    await expect(handler(call, owner)).resolves.toBeUndefined();
  }
  for (const toolName of ['exec', 'wait', 'memory_get', 'some_new_core_tool']) {
    const call = { toolName, params: {} };
    await expect(handler(call, user)).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason(toolName),
    });
    await expect(handler(call, owner)).resolves.toBeUndefined();
  }
  for (const toolName of [
    'pdf',
    'view_image',
    'image_generate',
    'video_generate',
    'music_generate',
  ]) {
    await expect(
      handler({ toolName, params: { path: '/workspace/a' } }, user)
    ).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason(toolName),
    });
  }
  for (const call of [
    { toolName: 'sessions_list', params: {} },
    { toolName: 'sessions_history', params: { sessionKey: 'agent:main:main' } },
    { toolName: 'sessions_search', params: { query: 'password' } },
    { toolName: 'session_status', params: { sessionKey: 'agent:main:main' } },
    { toolName: 'session_status', params: { model: 'x/y' } },
  ]) {
    await expect(handler(call, user)).resolves.toEqual({
      block: true,
      blockReason: SESSION_ACCESS_BLOCK_REASON,
    });
    await expect(handler(call, owner)).resolves.toBeUndefined();
  }
});

it('logs an owner-only argument call apart from an owner-only tool call', async () => {
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler, logs } = registerEntry();
  const owner = { sessionKey: OWNER_SESSION, runId: 'owner-log-run' };
  await expect(
    handler(
      { toolName: 'message', params: { action: 'send', media: '/x.png' } },
      owner
    )
  ).resolves.toBeUndefined();
  await expect(
    handler({ toolName: 'web_fetch', params: { url: '/etc/hosts' } }, owner)
  ).resolves.toBeUndefined();
  await expect(
    handler({ toolName: 'set_timezone', params: { tz: 'UTC' } }, owner)
  ).resolves.toBeUndefined();
  expect(allowedLogs(logs)).toEqual([
    `[tlon] Allowed message call with owner-only arguments for owner session. Session: ${OWNER_SESSION}`,
    `[tlon] Allowed web_fetch call with owner-only arguments for owner session. Session: ${OWNER_SESSION}`,
    `[tlon] Allowed set_timezone tool for owner session. Session: ${OWNER_SESSION}`,
  ]);
});

describe('non-owner remote media', () => {
  const SHIP_HOST = 'zod.tlon.network';
  // Core strips tool-call blocks without code protection on reply/edit, so
  // an image inside an inline code span covering the block surfaces there.
  const fencedReplyBody = (ref: string) =>
    ['x `', '[x]', '{"a":"` ``"}', '[/x]', `![i](${ref}) \`\``].join('\n');

  async function decide(
    params: Record<string, unknown>,
    session: string,
    toolName = 'message'
  ) {
    const { handler } = registerEntry({
      channels: { tlon: { url: `https://${SHIP_HOST.toUpperCase()}.` } },
    });
    return await handler(
      { toolName, params },
      { sessionKey: session, runId: `${session}-run` }
    );
  }

  beforeEach(() => {
    setSessionRole(USER_SESSION, 'user');
    setSessionRole(OWNER_SESSION, 'owner');
  });

  it.each([
    { action: 'send', media: 'https://example.com/x.png' },
    { action: 'send', mediaUrl: 'https://example.com/x.png', message: 'look' },
    {
      action: 'send',
      mediaUrls: ['https://example.com/x.png', 'https://cdn.example.org/y'],
    },
    { action: 'send', message: 'MEDIA: https://example.com/x.png' },
    { action: 'send', message: '![x](https://example.com/x.png)' },
    {
      action: 'reply',
      messageId: '~zod/1',
      message: fencedReplyBody('https://example.com/a.png'),
    },
    {
      action: 'edit',
      messageId: '~zod/1',
      message: fencedReplyBody('https://example.com/a.png'),
    },
  ])('allows public https media for a non-owner: %j', async (params) => {
    await expect(decide(params, USER_SESSION)).resolves.toBeUndefined();
  });

  it.each([
    'http://example.com/x.png',
    'data:image/png;base64,iVBORw0KGgo=',
    '/workspace/x.png',
    '~/x.png',
    `https://${SHIP_HOST}/~/scry/x.png`,
    'https://127.0.0.1/x.png',
    'https://[::1]/x.png',
    'https://u:p@example.com/x.png',
    'https://foo.svc/x.png',
    'MEDIA: https://example.com/x.png',
  ])('blocks non-owner media %s and leaves the owner alone', async (ref) => {
    for (const params of [
      { action: 'send', media: ref },
      { action: 'send', mediaUrls: ['https://example.com/ok.png', ref] },
    ]) {
      await expect(decide(params, USER_SESSION)).resolves.toEqual({
        block: true,
        blockReason: MESSAGE_MEDIA_BLOCK_REASON,
      });
      await expect(decide(params, OWNER_SESSION)).resolves.toBeUndefined();
      await expect(
        decide(params, 'agent:main:cron:x')
      ).resolves.toBeUndefined();
    }
  });

  const url = (i: number | string) => `https://example.com/${i}.png`;
  const directives = (n: number) =>
    Array.from({ length: n }, (_, i) => `MEDIA: ${url(i)}`).join('\n');
  const images = (n: number) =>
    Array(n)
      .fill(`![i](${url('img')})`)
      .join('\n');
  const blocked = { block: true, blockReason: MESSAGE_MEDIA_BLOCK_REASON };

  it('caps the attachments core would fetch for a non-owner call', async () => {
    for (const params of [
      // Core merges and dedupes keys and body: four downloads.
      {
        action: 'send',
        mediaUrls: [0, 1, 2, 3].map(url),
        message: `MEDIA: ${url(0)}`,
      },
      { action: 'send', message: directives(4) },
      { action: 'send', mediaUrls: Array(6).fill(url(0)) },
      {
        action: 'send',
        message: `${directives(4)}\nsee \\![e](${url('e')})`,
      },
    ]) {
      await expect(decide(params, USER_SESSION)).resolves.toBeUndefined();
    }
    for (const params of [
      { action: 'send', message: directives(5) },
      { action: 'send', mediaUrls: [0, 1, 2, 3, 4].map(url) },
      {
        action: 'send',
        mediaUrls: [0, 1, 2].map(url),
        message: `MEDIA: ${url(7)}\nMEDIA: ${url(8)}`,
      },
    ]) {
      await expect(decide(params, USER_SESSION)).resolves.toEqual(blocked);
      await expect(decide(params, OWNER_SESSION)).resolves.toBeUndefined();
    }
  });

  it('caps the image blocks a non-owner message renders', async () => {
    const reply = (message: string) => ({
      action: 'reply',
      messageId: '~zod/1',
      message,
    });
    await expect(
      decide(reply(`${images(4)}\nlike \`![c](${url('c')})\``), USER_SESSION)
    ).resolves.toBeUndefined();
    await expect(
      decide(reply(images(8)), USER_SESSION)
    ).resolves.toBeUndefined();
    for (const message of [images(9), images(12)]) {
      await expect(decide(reply(message), USER_SESSION)).resolves.toEqual(
        blocked
      );
      await expect(
        decide(reply(message), OWNER_SESSION)
      ).resolves.toBeUndefined();
    }
  });

  it.each(['openclawmessage', 'openclaw_directmessage'])(
    'checks a Codex-namespaced %s like message',
    async (toolName) => {
      await expect(
        decide(
          { action: 'send', media: url(0), message: 'x' },
          USER_SESSION,
          toolName
        )
      ).resolves.toBeUndefined();
      await expect(
        decide(
          { action: 'send', message: directives(5) },
          USER_SESSION,
          toolName
        )
      ).resolves.toEqual(blocked);
      await expect(
        decide(
          { action: 'send', media: 'http://example.com/a.png' },
          USER_SESSION,
          toolName
        )
      ).resolves.toEqual(blocked);
    }
  );

  it.each([
    { action: 'send', message: 'MEDIA: /workspace/x.png' },
    { action: 'send', message: `MEDIA: https://${SHIP_HOST}/x.png` },
    {
      action: 'reply',
      messageId: '~zod/1',
      media: 'https://example.com/x.png',
    },
    { action: 'send', path: 'https://example.com/x.png' },
    { action: 'send', filePath: 'https://example.com/x.png' },
    { action: 'send', image: 'https://example.com/x.png' },
    { action: 'send', media_urls: ['https://example.com/x.png'] },
    {
      action: 'reply',
      messageId: '~zod/1',
      message: fencedReplyBody(`https://${SHIP_HOST}/x.png`),
    },
    {
      action: 'edit',
      messageId: '~zod/1',
      message: fencedReplyBody('https://media.svc/x.png'),
    },
  ])(
    'blocks a non-owner call whose media fails the rule: %j',
    async (params) => {
      await expect(decide(params, USER_SESSION)).resolves.toEqual({
        block: true,
        blockReason: MESSAGE_MEDIA_BLOCK_REASON,
      });
      await expect(decide(params, OWNER_SESSION)).resolves.toBeUndefined();
    }
  );
});

it('fails closed and warns once for a non-owner message when core cannot be consulted', async () => {
  setSessionRole(USER_SESSION, 'user');
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler, logs } = registerEntry();
  const call = {
    toolName: 'message',
    params: { action: 'send', message: 'hello' },
  };
  const loaderError = new Error(
    'openclaw core function stripInboundMetadata not found in /dist'
  );
  const coreWarnings = () =>
    logs.filter((line) => line.includes('stripInboundMetadata'));
  vi.mocked(coreMessageMedia).mockRejectedValueOnce(loaderError);
  await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
    block: true,
    blockReason: MESSAGE_MEDIA_BLOCK_REASON,
  });
  expect(coreWarnings()).toEqual([
    '[tlon] openclaw core function stripInboundMetadata not found in /dist; non-owner message bodies are blocked until the plugin is updated for this core version',
  ]);
  vi.mocked(coreMessageMedia).mockRejectedValueOnce(loaderError);
  await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
    block: true,
    blockReason: MESSAGE_MEDIA_BLOCK_REASON,
  });
  expect(coreWarnings()).toHaveLength(1);
  vi.mocked(coreMessageMedia).mockClear();
  await expect(
    handler(call, { sessionKey: OWNER_SESSION })
  ).resolves.toBeUndefined();
  expect(coreMessageMedia).not.toHaveBeenCalled();
});

it('lets owner and role-less sessions use the system agent', async () => {
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler } = registerEntry();
  const call = { toolName: 'openclaw', params: { request: 'check status' } };
  await expect(
    handler(call, { sessionKey: OWNER_SESSION })
  ).resolves.toBeUndefined();
  await expect(
    handler(call, { sessionKey: 'agent:main:cron:notebook-job' })
  ).resolves.toBeUndefined();
});

it('lets owner and role-less sessions spawn subagents', async () => {
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler } = registerEntry();
  const call = { toolName: 'sessions_spawn', params: { task: 'summarize' } };
  await expect(
    handler(call, { sessionKey: OWNER_SESSION })
  ).resolves.toBeUndefined();
  await expect(
    handler(call, { sessionKey: 'agent:main:cron:notebook-job' })
  ).resolves.toBeUndefined();
});

it('lets owner and role-less sessions call MCP tools', async () => {
  setSessionRole(OWNER_SESSION, 'owner');
  const { handler } = registerEntry();
  const call = {
    toolName: 'mcp__call',
    params: { name: 'weather_forecast', arguments: {} },
  };
  await expect(
    handler(call, { sessionKey: OWNER_SESSION })
  ).resolves.toBeUndefined();
  await expect(
    handler(call, { sessionKey: 'agent:main:cron:notebook-job' })
  ).resolves.toBeUndefined();
});

it('blocks browser use and fresh approval cards until a stored result is delivered', async () => {
  setSessionRole(OWNER_SESSION, 'owner');
  vi.mocked(runBrowserSessionHandoff).mockClear();
  const { handler, hooks } = registerEntry();
  const after = hooks.get('after_tool_call') as (
    event: unknown,
    ctx: { sessionKey: string }
  ) => Promise<void>;
  const ctx = { sessionKey: OWNER_SESSION };
  const event = {
    toolName: 'mcp__call',
    params: {
      name: 'browser_browser_login',
      arguments: {
        session_id: 'blocked-browser',
        action: 'use',
        fields: ['@e12'],
      },
    },
    result: {
      details: {
        structuredContent: {
          session_id: 'blocked-browser',
          login: { status: 'approval_required' },
        },
      },
    },
  };
  handoffRecords.set('blocked-browser', {
    result: { status: 'filled', submitted: true },
  });
  await expect(handler(event, ctx)).resolves.toMatchObject({
    block: true,
    blockReason: expect.stringContaining('waiting for secure entry'),
  });
  await after(event, ctx);
  expect(runBrowserSessionHandoff).not.toHaveBeenCalled();
  handoffRecords.delete('blocked-browser');
  await expect(handler(event, ctx)).resolves.toBeUndefined();
  await after(event, ctx);
  expect(runBrowserSessionHandoff).toHaveBeenCalledOnce();
});

it('puts approval delivery failure into the originating conversation without leaking upstream errors', async () => {
  vi.mocked(runBrowserSessionHandoff).mockRejectedValueOnce(
    new Error('private-token')
  );
  const { hooks, logs } = registerEntry();
  const handler = hooks.get('after_tool_call') as (
    event: unknown,
    ctx: { sessionKey: string }
  ) => Promise<void>;
  await handler(
    {
      toolName: 'mcp__call',
      params: {
        name: 'browser_browser_login',
        arguments: {
          session_id: 'delivery-failure',
          action: 'use',
          fields: ['@e12'],
        },
      },
      result: {
        details: {
          structuredContent: {
            session_id: 'delivery-failure',
            login: { status: 'approval_required' },
          },
        },
      },
    },
    { sessionKey: OWNER_SESSION }
  );
  expect(
    logs.some((line) =>
      line.startsWith(
        `system:${OWNER_SESSION}:The saved login approval card could not be sent.`
      )
    )
  ).toBe(true);
  expect(logs.join('\n')).not.toContain('private-token');
});

describe('before_tool_call cron during first-run setup', () => {
  const ctx = { sessionKey: OWNER_SESSION };
  const reschedule = {
    action: 'update',
    jobId: 'reminder-1',
    patch: { schedule: { kind: 'cron', expr: '0 8 * * *' } },
  };

  beforeEach(() => {
    _testing.clearAll();
    boundaryTesting.clearAll();
    setSessionRole(OWNER_SESSION, 'owner');
    setTlonSessionSurface(OWNER_SESSION, {
      kind: 'direct',
      channelNest: '~sampel-palnet',
      requestedOnboardingGroupId: '~sampel-palnet/home',
      bootstrapComplete: false,
    });
    vi.mocked(isAgentOnboardingCronJob).mockClear();
  });

  afterEach(() => {
    _testing.clearAll();
    boundaryTesting.clearAll();
  });

  it('lets the owner change or remove a reminder they just made', async () => {
    const { handler } = registerEntry();
    await expect(
      handler({ toolName: 'cron', params: reschedule }, ctx)
    ).resolves.toEqual({
      params: { ...reschedule, job: reschedule.patch },
    });
    await expect(
      handler(
        { toolName: 'cron', params: { action: 'remove', jobId: 'reminder-1' } },
        ctx
      )
    ).resolves.toBeUndefined();
    expect(isAgentOnboardingCronJob).toHaveBeenCalledWith('reminder-1');
  });

  it('still keeps the onboarding task closed', async () => {
    vi.mocked(isAgentOnboardingCronJob).mockResolvedValue(true);
    const { handler } = registerEntry();
    await expect(
      handler(
        {
          toolName: 'cron',
          params: { action: 'remove', jobId: 'onboarding-1' },
        },
        ctx
      )
    ).resolves.toMatchObject({
      block: true,
      blockReason: expect.stringContaining('typed task-plan coordinator'),
    });
    vi.mocked(isAgentOnboardingCronJob).mockResolvedValue(false);
  });

  it('stays closed when the job cannot be looked up', async () => {
    vi.mocked(isAgentOnboardingCronJob).mockRejectedValueOnce(
      new Error('cron unavailable')
    );
    const { handler } = registerEntry();
    await expect(
      handler({ toolName: 'cron', params: reschedule }, ctx)
    ).resolves.toMatchObject({ block: true });
  });
});
