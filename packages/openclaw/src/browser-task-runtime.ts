import path from 'node:path';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { emitDiagnosticEvent } from 'openclaw/plugin-sdk/diagnostic-runtime';
import { resolveStateDir } from 'openclaw/plugin-sdk/state-paths';
import { z } from 'zod';
import type { BrowserLifecycleEvent } from '@tloncorp/api';
import {
  BrowserTaskStore,
  taskOutcomeSchema,
  type BrowserTask,
  type BrowserTaskChange,
} from './browser-task-store.js';
import { readBrowserTaskServiceStatus } from './browser-task-service.js';
import { sharedSlot } from './shared-state.js';
import {
  browserSessionTelemetryId,
  setBrowserTaskObserver,
  type BrowserAgentContext,
} from './browser-telemetry.js';
import { getSessionRole } from './session-roles.js';

const runtime = sharedSlot<BrowserTaskRuntime>('browser.tasks.runtime');
const POLL_MS = 30_000;
const POLL_CONCURRENCY = 4;
const HEARTBEAT_MS = 5 * 60_000;

function hasOutstandingHandoff(task: BrowserTask) {
  return task.sessions.some((session) =>
    session.handoffs.some((handoff) => !handoff.resolvedAt && !handoff.failedAt)
  );
}

/** Deliberately excludes objective, evidence, raw handles, form ids, URLs and secrets. */
export function browserTaskSnapshot(
  task: BrowserTask,
  change: BrowserTaskChange,
  now = Date.now(),
  previous?: BrowserTask
) {
  const handoffs = task.sessions.flatMap((s) => s.handoffs);
  const latest = handoffs.toSorted((a, b) => b.requestedAt - a.requestedAt)[0];
  return {
    browser_task_schema_version: 1,
    browser_task_id: task.id,
    browser_task_revision: task.revision,
    browser_task_change: change,
    browser_task_state: task.state,
    browser_task_state_changed: Boolean(
      previous && previous.state !== task.state
    ),
    browser_task_previous_state: previous?.state ?? '',
    browser_task_previous_state_duration_ms:
      previous && previous.state !== task.state
        ? task.stateSince - previous.stateSince
        : 0,
    browser_task_outcome: task.outcome?.status ?? 'unknown',
    browser_task_outcome_reported: Boolean(task.outcome),
    browser_task_first_outcome_report:
      change === 'outcome' && !previous?.outcome,
    browser_task_created_at: task.createdAt,
    browser_task_updated_at: task.updatedAt,
    browser_task_state_since: task.stateSince,
    browser_task_observed_at: now,
    browser_task_age_ms: now - task.createdAt,
    browser_task_state_age_ms: now - task.stateSince,
    browser_task_session_count: task.sessions.length,
    browser_task_handoff_count: handoffs.length,
    browser_task_last_agent_activity_at: task.lastAgentActivityAt ?? 0,
    browser_task_service_checked_at: latest?.checkedAt ?? 0,
    browser_task_service_check_failed: Boolean(latest?.checkFailedAt),
    browser_task_fill_observed: Boolean(latest?.fillAt),
    browser_task_next_form_observed: Boolean(latest?.nextFormAt),
    browser_task_fill_failure_observed: Boolean(latest?.fillFailedAt),
    browser_task_handoff_requested_at: latest?.requestedAt ?? 0,
    browser_task_fill_at: latest?.fillAt ?? 0,
    browser_task_next_form_at: latest?.nextFormAt ?? 0,
    browser_task_submission_attempted: latest?.submitted ?? false,
    browser_task_handoff_id: latest?.id ?? '',
  };
}

export class BrowserTaskRuntime {
  readonly store: BrowserTaskStore;
  private timer?: ReturnType<typeof setInterval>;
  private flight?: Promise<void>;
  private controller = new AbortController();
  private heartbeatAt = 0;
  private calls = new Map<string, { taskId: string; scope: string }>();
  constructor(
    private api: Pick<OpenClawPluginApi, 'config' | 'logger'>,
    filePath: string
  ) {
    this.store = new BrowserTaskStore(filePath, (t, c, previous) =>
      this.emit(t, c, previous)
    );
  }
  private emit(
    task: BrowserTask,
    change: BrowserTaskChange,
    previous?: BrowserTask
  ) {
    emitDiagnosticEvent({
      type: 'log.record',
      level: 'INFO',
      loggerName: 'tlon.browser',
      message: 'tlon.browser.task',
      attributes: browserTaskSnapshot(task, change, Date.now(), previous),
    });
  }
  observe(
    event: BrowserLifecycleEvent,
    context: BrowserAgentContext,
    handle?: string
  ): string | undefined {
    const scope = context.sessionKey;
    if (!scope) return;
    const key = context.toolCallId
      ? JSON.stringify([scope, context.toolCallId])
      : undefined;
    const bound = key ? this.calls.get(key) : undefined;
    const selected = this.store.selected(scope);
    // A completion belongs to the task selected when the operation began.
    const task = bound ? this.store.get(bound.taskId, bound.scope) : selected;
    if (!task) return;
    const stateless =
      !event.browserSessionId &&
      ['scrape', 'screenshot'].includes(event.operation ?? '');
    if (
      !stateless &&
      event.operation !== 'session_create' &&
      event.phase !== 'session_created' &&
      (!event.browserSessionId ||
        !task.sessions.some((s) => s.id === event.browserSessionId))
    )
      return;
    if (event.phase === 'operation_started' && key) {
      if (this.calls.size >= 2000)
        this.calls.delete(this.calls.keys().next().value!);
      this.calls.set(key, { taskId: task.id, scope });
    } else if (event.phase.startsWith('session_') && key)
      this.calls.delete(key);
    if (
      event.phase === 'session_created' &&
      event.outcome === 'accepted' &&
      handle &&
      event.browserSessionId &&
      task.state !== 'closed'
    ) {
      this.store.attach(task.id, scope, handle, event.browserSessionId);
    }
    this.store.update(
      task.id,
      scope,
      event.phase.startsWith('handoff_')
        ? 'handoff'
        : event.phase === 'session_released'
          ? 'released'
          : 'activity',
      (t) => {
        const session = t.sessions.find((s) => s.id === event.browserSessionId);
        if (event.phase === 'operation_started') {
          if (!session && !stateless && event.operation !== 'session_create')
            return;
          t.lastAgentActivityAt = Date.now();
          // Releasing a resource and fetching a viewer are not task resumption.
          if (
            !['session_release', 'session_live_view'].includes(
              event.operation ?? ''
            ) &&
            t.state !== 'closed' &&
            t.state !== 'paused'
          ) {
            for (const h of session?.handoffs ?? [])
              if (h.readyAt && !h.resolvedAt && !h.failedAt)
                h.resolvedAt = Date.now();
            if (!hasOutstandingHandoff(t)) t.state = 'active';
          }
        }
        if (!session) return;
        if (event.phase === 'session_released' && event.outcome === 'accepted')
          session.releasedAt = Date.now();
        if (
          event.phase === 'handoff_requested' &&
          event.browserHandoffId &&
          t.state !== 'closed'
        ) {
          for (const h of t.sessions.flatMap((s) => s.handoffs))
            if (!h.resolvedAt && !h.failedAt) h.resolvedAt = Date.now();
          session.handoffs.push({
            id: event.browserHandoffId,
            requestedAt: Date.now(),
          });
          if (t.state !== 'paused') t.state = 'waiting_for_user';
        }
        const handoff = session.handoffs.find(
          (h) => h.id === event.browserHandoffId
        );
        if (handoff && event.phase === 'handoff_ready')
          handoff.readyAt = Date.now();
        if (handoff && event.phase === 'handoff_failed') {
          const outstanding = !handoff.resolvedAt && !handoff.failedAt;
          handoff.failedAt = Date.now();
          if (
            outstanding &&
            t.state === 'waiting_for_user' &&
            !hasOutstandingHandoff(t)
          )
            t.state = 'active';
        }
      }
    );
    return task.id;
  }
  async prepare(
    handle: string,
    context: BrowserAgentContext,
    handoffId: string
  ) {
    const task = context.sessionKey
      ? this.store.selected(context.sessionKey)
      : undefined;
    const session = task?.sessions.find((s) => s.handle === handle);
    if (!task || !session) return;
    let status = null;
    try {
      status = await readBrowserTaskServiceStatus(
        this.api.config,
        handle,
        this.controller.signal
      );
    } catch {
      /* Mixed deployments remain observable as unknown. */
    }
    this.store.status(task.id, task.scope, session.id, handoffId, status, true);
  }
  tick() {
    if (this.flight) return this.flight;
    this.flight = this.poll().finally(() => {
      this.flight = undefined;
    });
    return this.flight;
  }
  private async poll() {
    if (Date.now() - this.heartbeatAt >= HEARTBEAT_MS) {
      for (const task of this.store.list())
        if (task.state !== 'closed') this.emit(task, 'snapshot');
      this.heartbeatAt = Date.now();
    }
    const checks: Array<() => Promise<void>> = [];
    for (const task of this.store.list()) {
      if (this.controller.signal.aborted) return;
      if (task.state === 'closed') continue;
      for (const session of task.sessions) {
        if (session.releasedAt) continue;
        const handoff = session.handoffs.findLast(
          (h) => h.readyAt && !h.resolvedAt && !h.failedAt
        );
        if (!handoff) continue;
        if (
          handoff.checkFailedAt &&
          Date.now() - handoff.checkFailedAt < HEARTBEAT_MS
        )
          continue;
        checks.push(async () => {
          let status = null;
          try {
            status = await readBrowserTaskServiceStatus(
              this.api.config,
              session.handle,
              this.controller.signal
            );
          } catch {
            /* Never interpret an unavailable service as completion. */
          }
          if (this.controller.signal.aborted) return;
          this.store.status(
            task.id,
            task.scope,
            session.id,
            handoff.id,
            status
          );
        });
      }
    }
    let index = 0;
    const results = await Promise.allSettled(
      Array.from(
        { length: Math.min(POLL_CONCURRENCY, checks.length) },
        async () => {
          while (!this.controller.signal.aborted) {
            const check = checks[index++];
            if (!check) return;
            await check();
          }
        }
      )
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
  start() {
    if (this.timer) return;
    const tick = () =>
      void this.tick().catch(() =>
        this.api.logger.warn(
          '[tlon] Browser task monitoring failed; last known state retained.'
        )
      );
    tick();
    this.timer = setInterval(tick, POLL_MS);
    this.timer.unref();
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.controller.abort();
    await this.flight?.catch(() => {});
  }
}

export async function prepareBrowserTaskHandoff(
  handle: string,
  context: BrowserAgentContext,
  handoffId: string
) {
  try {
    await runtime.get()?.prepare(handle, context, handoffId);
  } catch {
    /* Monitoring cannot break the existing handoff. */
  }
}

const taskArgs = z
  .object({
    action: z.enum([
      'start',
      'list',
      'get',
      'resume',
      'pause',
      'attach_session',
    ]),
    task_id: z.string().uuid().optional(),
    offset: z.number().int().min(0).max(1000).optional(),
    objective: z.string().trim().min(1).max(600).optional(),
    session_id: z
      .string()
      .regex(/^sess_[A-Za-z0-9_-]{22}$/)
      .optional(),
  })
  .strict();
const outcomeArgs = z
  .object({
    task_id: z.string().uuid(),
    outcome: taskOutcomeSchema,
    evidence: z.string().trim().min(1).max(1000),
  })
  .strict();

export function registerBrowserTasks(api: OpenClawPluginApi) {
  const getRuntime = () => {
    let current = runtime.get();
    if (!current) {
      current = new BrowserTaskRuntime(
        api,
        path.join(resolveStateDir(), 'tlon', 'browser-tasks.json')
      );
      runtime.set(current);
    }
    return current;
  };
  setBrowserTaskObserver((event, context, handle) => {
    try {
      return getRuntime().observe(event, context, handle);
    } catch {
      api.logger.warn('[tlon] Browser task observation could not be saved.');
      return undefined;
    }
  });
  api.on('gateway_start', () => {
    try {
      getRuntime().start();
    } catch {
      api.logger.warn(
        '[tlon] Browser task store unavailable; existing state preserved.'
      );
    }
  });
  api.on('gateway_stop', async () => {
    const current = runtime.get();
    runtime.set(null);
    setBrowserTaskObserver(null);
    await current?.stop();
  });
  const tools = [
    {
      name: 'browser_task',
      description:
        'Track a browser objective across sessions. Before browser work, start with a short non-sensitive objective, or list/resume the existing task for that objective. New sessions attach automatically; attach_session associates an existing session. Pause when intentionally setting work aside. This only records monitoring state; it never starts or resumes an agent or browser.',
      schema: z.toJSONSchema(taskArgs),
    },
    {
      name: 'report_browser_outcome',
      description:
        'When finishing or giving up browser work, report against the original objective: succeeded, partial, failed, or unknown, with brief non-sensitive evidence. A credential handoff is a pause, not completion. This records an agent assessment and finishes tracking the task; it does not release browser sessions.',
      schema: z.toJSONSchema(outcomeArgs),
    },
  ];
  for (const tool of tools)
    api.registerTool(
      (ctx) => ({
        name: tool.name,
        label:
          tool.name === 'browser_task'
            ? 'Browser task'
            : 'Browser task outcome',
        description: tool.description,
        parameters: tool.schema,
        async execute(_callId: string, input: unknown) {
          const scope = ctx.sessionKey;
          if (!scope || getSessionRole(scope) === 'user')
            throw new Error(
              'Browser task tools require an owner or internal conversation.'
            );
          const store = getRuntime().store;
          let result:
            | BrowserTask
            | {
                tasks: Pick<
                  BrowserTask,
                  'id' | 'objective' | 'state' | 'updatedAt'
                >[];
                next_offset: number | null;
              };
          if (tool.name === 'report_browser_outcome') {
            const args = outcomeArgs.parse(input);
            result = store.report(
              args.task_id,
              scope,
              args.outcome,
              args.evidence
            );
          } else {
            const args = taskArgs.parse(input);
            if (args.action === 'list') {
              const tasks = store
                .list(scope)
                .sort(
                  (a, b) =>
                    Number(a.state === 'closed') -
                      Number(b.state === 'closed') || b.updatedAt - a.updatedAt
                );
              const offset = args.offset ?? 0;
              result = {
                tasks: tasks
                  .slice(offset, offset + 50)
                  .map(({ id, objective, state, updatedAt }) => ({
                    id,
                    objective,
                    state,
                    updatedAt,
                  })),
                next_offset: tasks.length > offset + 50 ? offset + 50 : null,
              };
            } else if (args.action === 'start') {
              if (!args.objective) throw new Error('An objective is required.');
              result = store.start(scope, args.objective, ctx.sessionId);
            } else {
              if (!args.task_id) throw new Error('task_id is required.');
              if (args.action === 'get')
                result = store.get(args.task_id, scope);
              else if (args.action === 'resume')
                result = store.resume(args.task_id, scope);
              else if (args.action === 'pause')
                result = store.pause(args.task_id, scope);
              else {
                if (!args.session_id)
                  throw new Error('session_id is required.');
                result = store.attach(
                  args.task_id,
                  scope,
                  args.session_id,
                  browserSessionTelemetryId(args.session_id)!
                );
              }
            }
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            details: { task_id: 'id' in result ? result.id : undefined },
          };
        },
      }),
      { name: tool.name }
    );
}
