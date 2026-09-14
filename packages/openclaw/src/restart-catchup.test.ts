import { rm } from 'node:fs/promises';
import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TlonConfigSchema } from './config-schema.js';
import {
  createRestartCatchupCoordinator,
  getRestartCatchupCoordinator,
  readBootstrapComplete,
  registerRestartCatchupHooks,
} from './restart-catchup.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}));

const config = (enabled = true): OpenClawConfig => ({
  channels: {
    tlon: {
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'test-code',
      ownerShip: '~nec',
      restartCatchup: { enabled },
    },
  },
});
const settings = (value: unknown = true) => ({
  all: { moltbot: { tlon: { bootstrapComplete: value } } },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(cfg = config()) {
  const run = vi.fn().mockResolvedValue({ meta: {} });
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const readChecklist = vi
    .fn()
    .mockResolvedValue(
      'Custom operator instruction.\nCheck unread mentions; finish with NO_REPLY.'
    );
  const runtime = {
    channel: {
      routing: {
        resolveAgentRoute: vi.fn().mockReturnValue({
          agentId: 'owner-agent',
          sessionKey: 'agent:owner-agent:tlon:dm:~nec',
        }),
      },
    },
    agent: {
      runEmbeddedAgent: run,
      resolveAgentDir: () => '/test/agent',
      resolveAgentTimeoutMs: () => 120_000,
      resolveAgentWorkspaceDir: vi
        .fn()
        .mockReturnValue('/test/owner-workspace'),
    },
    state: { resolveStateDir: () => '/test/state' },
  } as unknown as OpenClawPluginApi['runtime'];
  const ctx = { config: cfg, runtime, logger };
  const coordinator = createRestartCatchupCoordinator({
    timeoutMs: 60_000,
    readChecklist,
  });
  const readSettings = vi.fn().mockResolvedValue(settings());
  const isConnected = vi.fn().mockReturnValue(true);
  const connection = { readSettings, isConnected };
  const monitor = coordinator.attachMonitor('default', cfg);
  const ready = () => monitor.connected(connection);
  return {
    coordinator,
    ctx,
    run,
    logger,
    readChecklist,
    readSettings,
    isConnected,
    monitor,
    connection,
    ready,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  getRestartCatchupCoordinator().stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('restart catch-up', () => {
  it('waits through a slow moon startup before making any settings or model calls', async () => {
    const f = fixture();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.readSettings).not.toHaveBeenCalled();
    expect(f.run).not.toHaveBeenCalled();
    f.ready();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.readChecklist).toHaveBeenCalledWith(
      '/test/owner-workspace/BOOT.md',
      expect.any(AbortSignal)
    );
    expect(f.run.mock.calls[0][0]).toMatchObject({
      requireExplicitMessageTarget: true,
      prompt: expect.stringContaining('Custom operator instruction.'),
    });
    expect(f.run.mock.calls[0][0].sessionKey).toMatch(
      /^agent:owner-agent:tlon-restart:/
    );
    expect(f.logger.error).not.toHaveBeenCalled();
  });

  it('waits for gateway_start even when the connection is already ready', async () => {
    const f = fixture();
    f.ready();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.run).not.toHaveBeenCalled();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.run).toHaveBeenCalledTimes(1);
  });

  it.each([false, undefined, 'false', 1, 'yes'])(
    'skips first-use bots with bootstrapComplete=%s',
    async (value) => {
      const f = fixture();
      f.readSettings.mockResolvedValue({
        all: { moltbot: { tlon: { bootstrapComplete: value } } },
      });
      f.ready();
      f.coordinator.start(f.ctx);
      await vi.advanceTimersByTimeAsync(0);
      expect(f.run).not.toHaveBeenCalled();
      expect(f.readChecklist).not.toHaveBeenCalled();
      f.readSettings.mockResolvedValue(settings(true));
      f.ready();
      f.coordinator.start(f.ctx);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(f.run).not.toHaveBeenCalled();
      expect(f.logger.error).not.toHaveBeenCalled();
    }
  );

  it('retries failed read-only eligibility checks in code', async () => {
    const f = fixture();
    f.readSettings
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('503 unavailable'));
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.readSettings).toHaveBeenCalledTimes(3);
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.logger.error).not.toHaveBeenCalled();
  });

  it('reports one readiness failure after the deadline and cannot re-arm on a duplicate start', async () => {
    const f = fixture();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.logger.error).toHaveBeenCalledTimes(1);
    expect(f.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('readiness timed out')
    );
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.run).not.toHaveBeenCalled();
    expect(f.logger.error).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight scry at the readiness deadline', async () => {
    const f = fixture();
    f.readSettings.mockImplementation(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        )
    );
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.readSettings.mock.calls[0][0].aborted).toBe(true);
    expect(f.logger.error).toHaveBeenCalledTimes(1);
    expect(f.run).not.toHaveBeenCalled();
  });

  it('cancels waiting on shutdown without reporting an outage', async () => {
    const f = fixture();
    f.coordinator.start(f.ctx);
    f.coordinator.stop();
    f.ready();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(f.run).not.toHaveBeenCalled();
    expect(f.logger.error).not.toHaveBeenCalled();
  });

  it('cannot submit after shutdown during a settings read', async () => {
    const f = fixture();
    const pending = deferred<unknown>();
    f.readSettings.mockReturnValue(pending.promise);
    f.ready();
    f.coordinator.start(f.ctx);
    f.coordinator.stop();
    pending.resolve(settings());
    await vi.advanceTimersByTimeAsync(0);
    expect(f.run).not.toHaveBeenCalled();
  });

  it('uses a replacement monitor after reload and ignores late results and cleanup from the old one', async () => {
    const f = fixture();
    const pending = deferred<unknown>();
    f.readSettings.mockReturnValue(pending.promise);
    f.ready();
    f.coordinator.start(f.ctx);
    const replacement = f.coordinator.attachMonitor('default', f.ctx.config);
    const readSettings = vi.fn().mockResolvedValue(settings());
    replacement.connected({ readSettings, isConnected: () => true });
    f.monitor.stop();
    pending.resolve(settings());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readSettings).toHaveBeenCalledTimes(1);
    expect(f.run).toHaveBeenCalledTimes(1);
  });

  it('does not launch while disconnected, or repeat catch-up on reconnect', async () => {
    const f = fixture();
    f.isConnected.mockReturnValue(false);
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.readSettings).not.toHaveBeenCalled();
    f.isConnected.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(5_000);
    f.ready();
    f.coordinator.start(f.ctx);
    const replacement = f.coordinator.attachMonitor('default', f.ctx.config);
    replacement.connected(f.connection);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(f.run).toHaveBeenCalledTimes(1);
  });

  it('allows one new task after a real in-process gateway restart', async () => {
    const f = fixture();
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    f.coordinator.stop();
    f.coordinator
      .attachMonitor('default', f.ctx.config)
      .connected(f.connection);
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.run).toHaveBeenCalledTimes(2);
    expect(f.run.mock.calls[0][0].runId).not.toBe(f.run.mock.calls[1][0].runId);
  });

  it('never retries an agent submission that might already have sent messages', async () => {
    const f = fixture();
    f.run.mockRejectedValue(new Error('gateway response lost'));
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    f.coordinator.start(f.ctx);
    f.ready();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.logger.error).toHaveBeenCalledTimes(1);
  });

  it('cancels an active catch-up and removes its temporary transcript on shutdown', async () => {
    const f = fixture();
    const pending = deferred<{ meta: { aborted: boolean } }>();
    f.run.mockReturnValue(pending.promise);
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    const params = f.run.mock.calls[0][0];
    expect(params.sessionFile).toMatch(
      /^\/test\/state\/plugins\/tlon\/restart-catchup\/[^/]+\.jsonl$/
    );
    expect(params.abortSignal.aborted).toBe(false);
    f.coordinator.stop();
    expect(params.abortSignal.aborted).toBe(true);
    pending.resolve({ meta: { aborted: true } });
    await vi.advanceTimersByTimeAsync(0);
    expect(rm).toHaveBeenCalledWith(params.sessionFile, { force: true });
    expect(f.logger.error).not.toHaveBeenCalled();
  });

  it('reports returned agent failures once and cleans up without replaying the checklist', async () => {
    const f = fixture();
    f.run.mockResolvedValue({
      meta: { error: { message: 'model unavailable' } },
    });
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('model unavailable')
    );
    expect(rm).toHaveBeenCalledWith(f.run.mock.calls[0][0].sessionFile, {
      force: true,
    });
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.logger.error).toHaveBeenCalledTimes(1);
  });

  it('keeps self-hosted installs off unless explicitly enabled', async () => {
    const f = fixture(config(false));
    f.ready();
    f.coordinator.start(f.ctx);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.readSettings).not.toHaveBeenCalled();
    expect(f.run).not.toHaveBeenCalled();
    expect(TlonConfigSchema.parse({}).restartCatchup).toBeUndefined();
    expect(
      TlonConfigSchema.parse({ restartCatchup: { enabled: true } })
        .restartCatchup?.enabled
    ).toBe(true);
  });

  it.each(['', null])(
    'skips an empty or missing BOOT.md (%s)',
    async (checklist) => {
      const f = fixture();
      if (checklist === null)
        f.readChecklist.mockRejectedValue(
          Object.assign(new Error('missing'), { code: 'ENOENT' })
        );
      else f.readChecklist.mockResolvedValue(checklist);
      f.ready();
      f.coordinator.start(f.ctx);
      await vi.advanceTimersByTimeAsync(0);
      expect(f.run).not.toHaveBeenCalled();
      expect(f.logger.error).not.toHaveBeenCalled();
    }
  );

  it('shares the same lifecycle across discovery, full activation, and prewarm hook registries', () => {
    const coordinator = getRestartCatchupCoordinator();
    const start = vi.spyOn(coordinator, 'start').mockImplementation(() => {});
    const stop = vi.spyOn(coordinator, 'stop');
    const registries = Array.from({ length: 3 }, () => {
      const hooks = new Map<string, (...args: unknown[]) => void>();
      const api = {
        ...fixture().ctx,
        on: (name: string, fn: (...args: unknown[]) => void) =>
          hooks.set(name, fn),
      } as unknown as OpenClawPluginApi;
      registerRestartCatchupHooks(api);
      return hooks;
    });
    registries[1].get('gateway_start')!({}, { config: config() });
    registries[2].get('gateway_stop')!({});
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('bootstrap settings decoding', () => {
  it('accepts boolean and serialized true while rejecting malformed snapshots', () => {
    expect(readBootstrapComplete(settings(true))).toBe(true);
    expect(readBootstrapComplete(settings('true'))).toBe(true);
    expect(readBootstrapComplete({ all: {} })).toBe(false);
    expect(() => readBootstrapComplete({ error: 'unavailable' })).toThrow(
      'Invalid settings snapshot'
    );
  });
});
