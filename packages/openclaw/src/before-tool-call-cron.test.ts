import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import entry from '../index.js';
import { publishContextLensEvent } from './context-lens-events.js';
import {
  recordContextLensToolResultForSession,
  scheduleBackgroundContextLensFinalization,
} from './context-lens.js';
import { CRON_ARGS_BLOCK_REASON } from './cron-tool-args-guard.js';
import { formatOwnerOnlyToolBlockReason } from './owner-only-tools.js';
import { _testing, setSessionRole } from './session-roles.js';

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

type BeforeToolCallResult =
  | { block?: boolean; blockReason?: string }
  | undefined;

type BeforeToolCallHandler = (
  event: { toolName: string; params: Record<string, unknown> },
  ctx: { sessionKey: string }
) => Promise<BeforeToolCallResult>;

const OWNER_SESSION = 'tlon:dm:~sampel-palnet';
const USER_SESSION = 'tlon:dm:~zod';

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
} {
  const hooks = new Map<string, unknown>();
  const logs: string[] = [];
  const describeSelf = () => '[recording-api]';
  const proxy: unknown = new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === 'registrationMode') {
        return 'full';
      }
      if (prop === 'config') {
        return config;
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
  return { api: proxy, hooks, logs };
}

function registerEntry(config?: Record<string, unknown>): {
  handler: BeforeToolCallHandler;
  logs: string[];
  hooks: Map<string, unknown>;
} {
  const { api, hooks, logs } = createRecordingApi(config);
  entry.register(api as never);
  expect(hooks.has('before_tool_call')).toBe(true);
  return {
    handler: hooks.get('before_tool_call') as BeforeToolCallHandler,
    logs,
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

const DIRTY_ADD = {
  toolName: 'cron',
  params: {
    action: 'add',
    job: { name: 'daily', payload: { fallbacks: [] } },
  },
};

const CLEAN_ADD = {
  toolName: 'cron',
  params: {
    action: 'add',
    job: { name: 'daily', payload: { prompt: 'summarize' } },
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
      'job.payload.fallbacks=empty-fallbacks'
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
    ).resolves.toBeUndefined();
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

  it('allows an owner cron add without the forbidden arguments', async () => {
    const { handler, logs } = registerEntry();
    await expect(
      handler(CLEAN_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toBeUndefined();
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

  it('allows the forbidden arguments when the guard is disabled', async () => {
    vi.stubEnv('TLON_CRON_ARGS_GUARD', '0');
    const { handler, logs } = registerEntry();
    await expect(
      handler(DIRTY_ADD, { sessionKey: OWNER_SESSION })
    ).resolves.toBeUndefined();
    expect(cronArgsBlockedLogs(logs)).toHaveLength(0);
  });
});
