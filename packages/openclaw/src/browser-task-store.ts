import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const taskStateSchema = z.enum([
  'active',
  'waiting_for_user',
  'waiting_for_agent',
  'paused',
  'closed',
]);
export const taskOutcomeSchema = z.enum([
  'succeeded',
  'partial',
  'failed',
  'unknown',
]);
const timestamp = z.number().int().nonnegative();
export const serviceStatusSchema = z.object({
  version: z.literal(1),
  epoch: z.string().uuid(),
  revision: timestamp,
  fill: z
    .object({
      revision: timestamp,
      at: timestamp,
      formId: z.string().max(128),
      submitted: z.boolean(),
    })
    .optional(),
  form: z
    .object({ revision: timestamp, at: timestamp, formId: z.string().max(128) })
    .optional(),
  failure: z.object({ revision: timestamp, at: timestamp }).optional(),
});
export type BrowserServiceStatus = z.infer<typeof serviceStatusSchema>;
const handoffSchema = z.object({
  id: z.string().uuid(),
  requestedAt: timestamp,
  readyAt: timestamp.optional(),
  resolvedAt: timestamp.optional(),
  failedAt: timestamp.optional(),
  epoch: z.string().uuid().optional(),
  baselineRevision: timestamp.optional(),
  revision: timestamp.optional(),
  checkedAt: timestamp.optional(),
  checkFailedAt: timestamp.optional(),
  fillAt: timestamp.optional(),
  submitted: z.boolean().optional(),
  nextFormAt: timestamp.optional(),
  fillFailedAt: timestamp.optional(),
});
const taskSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  scope: z.string(),
  originSessionId: z.string().optional(),
  objective: z.string().min(1).max(600),
  state: taskStateSchema,
  revision: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  stateSince: timestamp,
  lastAgentActivityAt: timestamp.optional(),
  sessions: z.array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{64}$/),
      handle: z.string().regex(/^sess_[A-Za-z0-9_-]{22}$/),
      attachedAt: timestamp,
      releasedAt: timestamp.optional(),
      handoffs: z.array(handoffSchema),
    })
  ),
  outcome: z
    .object({
      status: taskOutcomeSchema,
      source: z.literal('agent'),
      evidence: z.string().min(1).max(1000),
      at: timestamp,
    })
    .optional(),
});
export type BrowserTask = z.infer<typeof taskSchema>;
export type BrowserTaskState = BrowserTask['state'];
export type BrowserTaskChange =
  | 'started'
  | 'resumed'
  | 'paused'
  | 'attached'
  | 'activity'
  | 'released'
  | 'handoff'
  | 'service_status'
  | 'outcome'
  | 'snapshot';

/** Single gateway writer. Atomic replace; failed writes never update the in-memory record. */
export class BrowserTaskStore {
  private tasks: BrowserTask[];
  constructor(
    readonly filePath: string,
    private changed: (
      task: BrowserTask,
      change: BrowserTaskChange,
      previous?: BrowserTask
    ) => void = () => {},
    private now = Date.now
  ) {
    try {
      this.tasks = z
        .array(taskSchema)
        .parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'Browser task store could not be loaded. Existing state was not overwritten.'
        );
      this.tasks = [];
    }
  }
  list(scope?: string) {
    return structuredClone(
      this.tasks.filter((t) => !scope || t.scope === scope)
    );
  }
  get(id: string, scope: string) {
    const task = this.tasks.find((t) => t.id === id && t.scope === scope);
    if (!task) throw new Error('Browser task not found in this conversation.');
    return structuredClone(task);
  }
  selected(scope: string) {
    return this.list(scope).find(
      (t) => t.state !== 'closed' && t.state !== 'paused'
    );
  }
  private save(task: BrowserTask, change: BrowserTaskChange) {
    const previous = this.tasks.find((t) => t.id === task.id);
    const now = this.now();
    const tasks = this.tasks.filter(
      (t) =>
        t.id !== task.id &&
        (t.state !== 'closed' || t.updatedAt > now - 30 * 86400_000)
    );
    while (tasks.length >= 1000) {
      const oldestClosed = tasks.findIndex((t) => t.state === 'closed');
      if (oldestClosed < 0)
        throw new Error(
          'Browser task storage limit reached; finish unused tasks before starting more.'
        );
      tasks.splice(oldestClosed, 1);
    }
    tasks.push(taskSchema.parse(task));
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(tasks) + '\n', {
        mode: 0o600,
        flag: 'wx',
      });
      fs.renameSync(tmp, this.filePath);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    this.tasks = tasks;
    try {
      this.changed(
        structuredClone(task),
        change,
        previous && structuredClone(previous)
      );
    } catch {
      /* A telemetry outage does not undo a persisted task. */
    }
    return structuredClone(task);
  }
  update(
    id: string,
    scope: string,
    change: BrowserTaskChange,
    fn: (task: BrowserTask) => void
  ) {
    const task = this.get(id, scope);
    const previous = JSON.stringify(task);
    const state = task.state;
    fn(task);
    if (JSON.stringify(task) === previous) return task;
    task.revision++;
    task.updatedAt = this.now();
    if (state !== task.state) task.stateSince = task.updatedAt;
    return this.save(task, change);
  }
  start(scope: string, objective: string, originSessionId?: string) {
    if (this.selected(scope))
      throw new Error(
        'A browser task is already selected. Resume it, or pause/finish it before starting another objective.'
      );
    const now = this.now();
    return this.save(
      {
        version: 1,
        id: randomUUID(),
        scope,
        originSessionId,
        objective: z.string().trim().min(1).max(600).parse(objective),
        state: 'active',
        revision: 1,
        createdAt: now,
        updatedAt: now,
        stateSince: now,
        sessions: [],
      },
      'started'
    );
  }
  resume(id: string, scope: string) {
    const selected = this.selected(scope);
    if (selected && selected.id !== id)
      throw new Error('Pause or finish the selected browser task first.');
    return this.update(id, scope, 'resumed', (t) => {
      if (t.state === 'closed')
        throw new Error(
          'This task is finished. Start a new task for a new request.'
        );
      t.state = 'active';
    });
  }
  pause(id: string, scope: string) {
    return this.update(id, scope, 'paused', (t) => {
      if (t.state !== 'closed') t.state = 'paused';
    });
  }
  attach(id: string, scope: string, handle: string, sessionId: string) {
    return this.update(id, scope, 'attached', (t) => {
      if (t.state === 'closed')
        throw new Error('Cannot attach a session to a finished task.');
      // A session can be reused sequentially, but cannot monitor two outstanding tasks at once.
      if (
        this.tasks.some(
          (other) =>
            other.id !== id &&
            other.state !== 'closed' &&
            other.sessions.some(
              (s) =>
                s.id === sessionId &&
                s.handoffs.some((h) => !h.resolvedAt && !h.failedAt)
            )
        )
      )
        throw new Error(
          'This session has an outstanding handoff in another task.'
        );
      if (!t.sessions.some((s) => s.id === sessionId))
        t.sessions.push({
          id: sessionId,
          handle,
          attachedAt: this.now(),
          handoffs: [],
        });
    });
  }
  report(
    id: string,
    scope: string,
    status: z.infer<typeof taskOutcomeSchema>,
    evidence: string
  ) {
    return this.update(id, scope, 'outcome', (t) => {
      if (t.outcome?.status === status && t.outcome.evidence === evidence)
        return;
      t.outcome = {
        status,
        source: 'agent',
        evidence: z.string().trim().min(1).max(1000).parse(evidence),
        at: this.now(),
      };
      t.state = 'closed';
    });
  }
  status(
    id: string,
    scope: string,
    sessionId: string,
    handoffId: string,
    status: BrowserServiceStatus | null,
    baseline = false
  ) {
    return this.update(id, scope, 'service_status', (t) => {
      const h = t.sessions
        .find((s) => s.id === sessionId)
        ?.handoffs.find((h) => h.id === handoffId);
      if (!h || h.resolvedAt || h.failedAt || t.state === 'closed') return;
      if (!status) {
        h.checkFailedAt = this.now();
        return;
      }
      if (baseline || h.epoch === undefined) {
        h.epoch = status.epoch;
        h.baselineRevision = status.revision;
      }
      // Lost service state is missing evidence, never a new fill or success.
      if (h.epoch !== status.epoch) {
        h.checkFailedAt = this.now();
        return;
      }
      if (h.revision !== undefined && status.revision < h.revision) {
        h.checkFailedAt = this.now();
        return;
      }
      h.checkedAt = this.now();
      delete h.checkFailedAt;
      h.revision = status.revision;
      const after = h.baselineRevision ?? status.revision;
      if (status.failure && status.failure.revision > after)
        h.fillFailedAt = status.failure.at;
      if (!status.fill || status.fill.revision <= after) return;
      h.fillAt = status.fill.at;
      h.submitted = status.fill.submitted;
      const next =
        status.form &&
        status.form.revision > status.fill.revision &&
        status.form.formId !== status.fill.formId;
      if (next) h.nextFormAt = status.form!.at;
      else delete h.nextFormAt;
      if (t.state !== 'paused')
        t.state = next ? 'waiting_for_user' : 'waiting_for_agent';
    });
  }
}
