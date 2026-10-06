import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { browserLifecycleEvent } from '@tloncorp/api';
import { browserSessionTelemetryId } from './browser-telemetry.js';
import {
  BrowserTaskRuntime,
  browserTaskSnapshot,
  registerBrowserTasks,
} from './browser-task-runtime.js';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { getSessionRole } from './session-roles.js';
import { readBrowserTaskServiceStatus } from './browser-task-service.js';
import { emitDiagnosticEvent } from 'openclaw/plugin-sdk/diagnostic-runtime';

vi.mock('./browser-task-service.js', () => ({
  readBrowserTaskServiceStatus: vi.fn(),
}));
vi.mock('./session-roles.js', () => ({ getSessionRole: vi.fn() }));
vi.mock('openclaw/plugin-sdk/diagnostic-runtime', () => ({
  emitDiagnosticEvent: vi.fn(),
}));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('registers usable task tools, recovers ids and enforces conversation/owner boundaries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'browser-tools-'));
  dirs.push(dir);
  vi.stubEnv('OPENCLAW_STATE_DIR', dir);
  type Tool = {
    execute(
      id: string,
      args: unknown
    ): Promise<{ content: { text: string }[] }>;
  };
  const factories = new Map<string, (ctx: { sessionKey: string }) => Tool>();
  const hooks = new Map<string, () => Promise<void>>();
  const api = {
    config: {},
    logger: { info: vi.fn(), warn: vi.fn() },
    registerTool: (
      factory: (ctx: { sessionKey: string }) => Tool,
      options: { name: string }
    ) => factories.set(options.name, factory),
    on: (name: string, fn: () => Promise<void>) => hooks.set(name, fn),
  };
  registerBrowserTasks(api as unknown as OpenClawPluginApi);
  try {
    const taskTool = factories.get('browser_task')!({
      sessionKey: 'owner-chat',
    });
    const result = await taskTool.execute('start-call', {
      action: 'start',
      objective: 'Find a flight, not book it',
    });
    const task = JSON.parse(result.content[0].text);
    expect(task.id).toBeTruthy();
    const listed = await taskTool.execute('list-call', { action: 'list' });
    expect(listed.content[0].text).toContain(task.id);
    await expect(
      factories.get('browser_task')!({ sessionKey: 'another-chat' }).execute(
        'get-call',
        { action: 'get', task_id: task.id }
      )
    ).rejects.toThrow('not found');
    const report = factories.get('report_browser_outcome')!({
      sessionKey: 'owner-chat',
    });
    const closed = await report.execute('report-call', {
      task_id: task.id,
      outcome: 'succeeded',
      evidence: 'Compared three flights matching the requested dates.',
    });
    expect(JSON.parse(closed.content[0].text).outcome.source).toBe('agent');
    vi.mocked(getSessionRole).mockReturnValueOnce('user');
    await expect(
      taskTool.execute('user-call', { action: 'list' })
    ).rejects.toThrow('owner');
  } finally {
    await hooks.get('gateway_stop')!();
  }
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'browser-runtime-'));
  dirs.push(dir);
  const file = join(dir, 'tasks.json');
  const api = {
    config: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
  const runtime = new BrowserTaskRuntime(api, file);
  const task = runtime.store.start('conversation', 'Find my SECRET address');
  const handle = 'sess_' + 'x'.repeat(22),
    sessionId = browserSessionTelemetryId(handle)!;
  const context = { sessionKey: 'conversation', toolCallId: 'call1' };
  const observe = (phase: string, operation?: string, handoff?: string) =>
    runtime.observe(
      browserLifecycleEvent({
        source: 'agent',
        phase,
        operation,
        outcome: 'accepted',
        browserSessionId: sessionId,
        browserHandoffId: handoff,
      })!,
      context,
      handle
    );
  observe('operation_started', 'session_create');
  observe('session_created', 'session_create');
  return { runtime, task, handle, sessionId, context, observe, api, file };
}
it('recovers service-observed input after gateway restart with no client event and does not execute continuation', async () => {
  const f = fixture(),
    hid = randomUUID();
  const initial = { version: 1 as const, epoch: randomUUID(), revision: 0 };
  vi.mocked(readBrowserTaskServiceStatus).mockResolvedValue(initial);
  f.observe('handoff_requested', undefined, hid);
  await f.runtime.prepare(f.handle, f.context, hid);
  f.observe('handoff_ready', undefined, hid);
  vi.mocked(readBrowserTaskServiceStatus).mockResolvedValue({
    ...initial,
    revision: 1,
    fill: { revision: 1, at: Date.now(), formId: 'login', submitted: true },
  });
  const restored = new BrowserTaskRuntime(f.api, f.file);
  await restored.tick();
  expect(restored.store.get(f.task.id, f.task.scope).state).toBe(
    'waiting_for_agent'
  );
  expect(restored.store.get(f.task.id, f.task.scope).outcome).toBeUndefined();
  expect(readBrowserTaskServiceStatus).toHaveBeenLastCalledWith(
    f.api.config,
    f.handle,
    expect.any(AbortSignal)
  );
  expect(
    vi
      .mocked(emitDiagnosticEvent)
      .mock.calls.some(
        ([event]) =>
          event.type === 'log.record' &&
          event.attributes?.browser_task_state === 'waiting_for_agent'
      )
  ).toBe(true);
  await restored.stop();
});
it('resolves waiting only on agent browser activity, not release or monitoring', async () => {
  const f = fixture(),
    hid = randomUUID();
  f.observe('handoff_requested', undefined, hid);
  f.observe('handoff_ready', undefined, hid);
  f.observe('operation_started', 'session_release');
  expect(f.runtime.store.get(f.task.id, f.task.scope).state).toBe(
    'waiting_for_user'
  );
  f.observe('operation_started', 'snapshot');
  expect(f.runtime.store.get(f.task.id, f.task.scope).state).toBe('active');
  await f.runtime.tick();
  expect(readBrowserTaskServiceStatus).not.toHaveBeenCalled();
});
it.each(['requested', 'ready'] as const)(
  'keeps a newer %s handoff waiting when an earlier handoff fails',
  (phase) => {
    const f = fixture();
    const first = randomUUID();
    const second = randomUUID();
    f.observe('handoff_requested', undefined, first);
    f.observe('handoff_ready', undefined, first);
    f.observe('handoff_requested', undefined, second);
    if (phase === 'ready') f.observe('handoff_ready', undefined, second);

    f.observe('handoff_failed', undefined, first);
    const waiting = f.runtime.store.get(f.task.id, f.task.scope);
    expect(waiting.state).toBe('waiting_for_user');
    expect(waiting.sessions[0].handoffs[0].failedAt).toBeDefined();
    expect(waiting.sessions[0].handoffs[1].resolvedAt).toBeUndefined();

    f.observe('handoff_failed', undefined, second);
    expect(f.runtime.store.get(f.task.id, f.task.scope).state).toBe('active');
  }
);
it.each(['another session', 'stateless scrape', 'session creation'])(
  'keeps monitoring a handoff during activity in %s',
  async (activity) => {
    const f = fixture();
    const hid = randomUUID();
    const initial = { version: 1 as const, epoch: randomUUID(), revision: 0 };
    vi.mocked(readBrowserTaskServiceStatus).mockResolvedValue(initial);
    f.observe('handoff_requested', undefined, hid);
    await f.runtime.prepare(f.handle, f.context, hid);
    f.observe('handoff_ready', undefined, hid);
    const otherHandle = 'sess_' + 'z'.repeat(22);
    const otherId = browserSessionTelemetryId(otherHandle)!;
    f.runtime.store.attach(f.task.id, f.task.scope, otherHandle, otherId);

    f.runtime.observe(
      browserLifecycleEvent({
        source: 'agent',
        phase: 'operation_started',
        operation:
          activity === 'another session'
            ? 'snapshot'
            : activity === 'stateless scrape'
              ? 'scrape'
              : 'session_create',
        outcome: 'unknown',
        browserSessionId: activity === 'another session' ? otherId : undefined,
      })!,
      f.context
    );
    const waiting = f.runtime.store.get(f.task.id, f.task.scope);
    expect(waiting.state).toBe('waiting_for_user');
    expect(waiting.sessions[0].handoffs[0].resolvedAt).toBeUndefined();

    vi.mocked(readBrowserTaskServiceStatus).mockResolvedValue({
      ...initial,
      revision: 1,
      fill: { revision: 1, at: Date.now(), formId: 'login', submitted: true },
    });
    await f.runtime.tick();
    const filled = f.runtime.store.get(f.task.id, f.task.scope);
    expect(filled.state).toBe('waiting_for_agent');
    expect(filled.sessions[0].handoffs[0].fillAt).toBeDefined();
    expect(readBrowserTaskServiceStatus).toHaveBeenCalledTimes(2);

    f.observe('operation_started', 'snapshot');
    expect(f.runtime.store.get(f.task.id, f.task.scope).state).toBe('active');
    await f.runtime.tick();
    expect(readBrowserTaskServiceStatus).toHaveBeenCalledTimes(2);
  }
);
function waitingTasks(runtime: BrowserTaskRuntime, count: number) {
  const initial = { version: 1 as const, epoch: randomUUID(), revision: 0 };
  return Array.from({ length: count }, (_, index) => {
    const task = runtime.store.start(`conversation-${index}`, 'Sign in');
    const handle = 'sess_' + String(index).repeat(22);
    const sessionId = browserSessionTelemetryId(handle)!;
    const handoffId = randomUUID();
    runtime.store.attach(task.id, task.scope, handle, sessionId);
    runtime.store.update(task.id, task.scope, 'handoff', (t) => {
      t.state = 'waiting_for_user';
      t.sessions[0].handoffs.push({
        id: handoffId,
        requestedAt: Date.now(),
        readyAt: Date.now(),
      });
    });
    runtime.store.status(
      task.id,
      task.scope,
      sessionId,
      handoffId,
      initial,
      true
    );
    return { task, handle, initial };
  });
}
it('polls with four workers so a slow session does not block healthy sessions', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const tasks = waitingTasks(f.runtime, 8);
  let active = 0;
  let peak = 0;
  vi.mocked(readBrowserTaskServiceStatus).mockImplementation(
    async (_config, handle) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) =>
        setTimeout(resolve, handle === tasks[0].handle ? 1000 : 10)
      );
      active--;
      return {
        ...tasks[0].initial,
        revision: 1,
        fill: { revision: 1, at: Date.now(), formId: 'login', submitted: true },
      };
    }
  );
  const tick = f.runtime.tick();
  try {
    expect(f.runtime.tick()).toBe(tick);
    expect(readBrowserTaskServiceStatus).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(100);
    expect(readBrowserTaskServiceStatus).toHaveBeenCalledTimes(8);
    expect(peak).toBe(4);
    expect(
      f.runtime.store.get(tasks[0].task.id, tasks[0].task.scope).state
    ).toBe('waiting_for_user');
    for (const { task } of tasks.slice(1))
      expect(f.runtime.store.get(task.id, task.scope).state).toBe(
        'waiting_for_agent'
      );
  } finally {
    await vi.runAllTimersAsync();
    await tick;
    await f.runtime.stop();
  }
});
it('aborts active polls and leaves queued sessions untouched on shutdown', async () => {
  const f = fixture();
  const tasks = waitingTasks(f.runtime, 8);
  vi.mocked(readBrowserTaskServiceStatus).mockImplementation(
    (_config, _handle, signal) =>
      new Promise((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        });
      })
  );
  const tick = f.runtime.tick();
  const started = vi.mocked(readBrowserTaskServiceStatus).mock.calls.length;
  await f.runtime.stop();
  await tick;
  expect(started).toBe(4);
  expect(readBrowserTaskServiceStatus).toHaveBeenCalledTimes(4);
  for (const { task } of tasks) {
    const handoff = f.runtime.store.get(task.id, task.scope).sessions[0]
      .handoffs[0];
    expect(handoff.checkFailedAt).toBeUndefined();
    expect(handoff.fillAt).toBeUndefined();
  }
});
it('attributes a delayed creation to its original task even after the selected task changes', () => {
  const f = fixture();
  const ctx = { ...f.context, toolCallId: 'new-call' };
  f.runtime.observe(
    browserLifecycleEvent({
      source: 'agent',
      phase: 'operation_started',
      operation: 'session_create',
      outcome: 'unknown',
    })!,
    ctx
  );
  f.runtime.store.pause(f.task.id, f.task.scope);
  const next = f.runtime.store.start(f.task.scope, 'Second objective');
  const handle = 'sess_' + 'y'.repeat(22),
    id = browserSessionTelemetryId(handle)!;
  f.runtime.observe(
    browserLifecycleEvent({
      source: 'agent',
      phase: 'session_created',
      operation: 'session_create',
      outcome: 'accepted',
      browserSessionId: id,
    })!,
    ctx,
    handle
  );
  expect(f.runtime.store.get(f.task.id, f.task.scope).sessions).toHaveLength(2);
  expect(f.runtime.store.get(next.id, next.scope).sessions).toHaveLength(0);
});
it('emits bounded snapshots without objective, assessment text, raw handles or form contents', () => {
  const f = fixture();
  const finished = f.runtime.store.report(
    f.task.id,
    f.task.scope,
    'unknown',
    'SECRET evidence'
  );
  const snapshot = browserTaskSnapshot(finished, 'outcome');
  expect(snapshot.browser_task_outcome_reported).toBe(true);
  expect(snapshot.browser_task_outcome).toBe('unknown');
  expect(JSON.stringify(snapshot)).not.toContain('SECRET');
  expect(JSON.stringify(snapshot)).not.toContain(f.handle);
  expect(snapshot.browser_task_id).toBe(f.task.id);
});
