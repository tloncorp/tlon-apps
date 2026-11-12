import { afterEach, expect, it, vi } from 'vitest';
import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

import { createBrowserContinuationRunner } from './browser-continuation.js';
import { createComputingPresenceTracker } from './monitor/computing-presence.js';

vi.mock('@tloncorp/api', () => ({}));
vi.mock('./urbit/api-client.js', () => ({
  captureTlonApiScope: () => undefined,
}));

type Event = Parameters<
  Parameters<PluginRuntime['events']['onAgentEvent']>[0]
>[0];
const request = {
  sessionKey: 'agent:main:tlon:dm:~ten',
  message: 'filled',
  deliver: true,
  idempotencyKey: 'receipt',
} as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
const runners: ReturnType<typeof createBrowserContinuationRunner>[] = [];
afterEach(() => {
  runners.splice(0).forEach((runner) => runner.stop());
  vi.useRealTimers();
});
function harness({
  to = 'tlon:~ten',
  channel = 'tlon',
  showCommentary = true,
} = {}) {
  vi.useFakeTimers();
  const accepted = deferred<{ runId: string }>();
  const completed = deferred<{ status: 'ok' | 'error' | 'timeout' }>();
  const listeners = new Set<(event: Event) => void>();
  const publish = vi.fn(async () => {});
  const presence = createComputingPresenceTracker({
    reporter: { publish },
    minUpdateIntervalMs: 0,
  });
  const runtime = {
    agent: {
      session: {
        getSessionEntry: () => ({
          delivery: { kind: 'external', context: { channel, to } },
        }),
      },
    },
    subagent: {
      run: vi.fn(() => accepted.promise),
      waitForRun: vi.fn(() => completed.promise),
    },
    events: {
      onAgentEvent: (listener: (event: Event) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
  const warn = vi.fn();
  const runner = createBrowserContinuationRunner({
    runtime: runtime as unknown as PluginRuntime,
    presence,
    showCommentary,
    warn,
  });
  runners.push(runner);
  const emit = (stream: string, data: Event['data'], runId = 'run') => {
    for (const listener of listeners)
      listener({
        runId,
        sessionKey: request.sessionKey,
        stream,
        data,
        seq: 1,
        ts: Date.now(),
      });
  };
  return {
    runner,
    runtime,
    presence,
    publish,
    accepted,
    completed,
    listeners,
    emit,
    warn,
  };
}

it('shows early commentary, tools and keepalives only for the accepted continuation', async () => {
  const h = harness();
  const running = h.runner.run(request);
  h.emit('item', {
    kind: 'preamble',
    progressText: 'Checking the sign-in result.',
  });
  h.accepted.resolve({ runId: 'run' });
  await running;
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({
      conversationId: '~ten',
      thinking: true,
      commentary: 'Checking the sign-in result.',
    })
  );
  h.emit(
    'item',
    { kind: 'preamble', progressText: 'Unrelated private text' },
    'foreign'
  );
  h.emit('tool', { phase: 'start', name: 'mcp__call' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({
      toolNames: ['mcp__call'],
      commentary: 'Checking the sign-in result.',
    })
  );
  const count = h.publish.mock.calls.length;
  await vi.advanceTimersByTimeAsync(40_000);
  expect(h.publish.mock.calls.length).toBeGreaterThan(count);
  h.emit('assistant', { text: 'Done' });
  h.emit('lifecycle', { phase: 'end' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: false })
  );
  expect(h.listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not clear a normal message run in the same conversation', async () => {
  const h = harness();
  h.presence.refreshRun({ conversationId: '~ten', runId: 'ordinary-message' });
  const running = h.runner.run(request);
  h.accepted.resolve({ runId: 'run' });
  await running;
  h.emit('lifecycle', { phase: 'error' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: true })
  );
  h.presence.stopRun({ conversationId: '~ten', runId: 'ordinary-message' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: false })
  );
});

it('respects commentary settings and routes group presence to the group', async () => {
  const h = harness({ to: 'tlon:chat/~zod/testing', showCommentary: false });
  const running = h.runner.run(request);
  h.accepted.resolve({ runId: 'run' });
  await running;
  h.emit('item', { kind: 'preamble', progressText: 'Hidden commentary' });
  h.emit('tool', { phase: 'start', name: 'exec' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({
      conversationId: 'chat/~zod/testing',
      commentary: null,
      toolNames: ['exec'],
    })
  );
  h.completed.resolve({ status: 'ok' });
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: false })
  );
});

it('keeps presence across wait timeouts and cleans up on monitor shutdown', async () => {
  const h = harness();
  h.runtime.subagent.waitForRun.mockResolvedValueOnce({ status: 'timeout' });
  const running = h.runner.run(request);
  h.accepted.resolve({ runId: 'run' });
  await running;
  await flush();
  expect(h.runtime.subagent.waitForRun).toHaveBeenCalledTimes(2);
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: true })
  );
  h.runner.stop();
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: false })
  );
  expect(h.listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('clears a failed dispatch and propagates it to the existing retry mechanism', async () => {
  const h = harness();
  const running = h.runner.run(request);
  h.accepted.reject(new Error('gateway unavailable'));
  await expect(running).rejects.toThrow('gateway unavailable');
  await flush();
  expect(h.publish).toHaveBeenLastCalledWith(
    expect.objectContaining({ thinking: false })
  );
  expect(h.listeners.size).toBe(0);
});

it('never publishes into another channel and does not block delivery', async () => {
  const h = harness({ channel: 'other' });
  const running = h.runner.run(request);
  h.accepted.resolve({ runId: 'run' });
  await running;
  expect(h.publish).not.toHaveBeenCalled();
  expect(h.warn).toHaveBeenCalledOnce();
  expect(h.runtime.subagent.run).toHaveBeenCalledWith(request);
});
