import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import entry from '../index.js';
import { runBrowserSessionHandoff } from './browser-session-handoff.js';

import { publishContextLensEvent } from './context-lens-events.js';
import {
  recordContextLensToolResultForSession,
  scheduleBackgroundContextLensFinalization,
} from './context-lens.js';
import { CRON_ARGS_BLOCK_REASON } from './cron-tool-args-guard.js';
import { isAgentOnboardingCronJob } from './monitor/agent-onboarding.js';
import {
  _testing as boundaryTesting,
  setTlonSessionSurface,
} from './onboarding-tool-boundary.js';
import { formatOwnerOnlyToolBlockReason } from './owner-only-tools.js';
import { _testing, setSessionRole } from './session-roles.js';

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

vi.mock('./monitor/agent-onboarding.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./monitor/agent-onboarding.js')>();
  return { ...actual, isAgentOnboardingCronJob: vi.fn(async () => false) };
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
    blockReason: formatOwnerOnlyToolBlockReason('sessions_spawn'),
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
])(
  'blocks a non-owner $toolName and lets the owner and role-less internal runs use it',
  async (call) => {
    _testing.clearAll();
    setSessionRole(OWNER_SESSION, 'owner');
    setSessionRole(USER_SESSION, 'user');
    const { handler } = registerEntry();
    await expect(handler(call, { sessionKey: USER_SESSION })).resolves.toEqual({
      block: true,
      blockReason: formatOwnerOnlyToolBlockReason(call.toolName),
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
