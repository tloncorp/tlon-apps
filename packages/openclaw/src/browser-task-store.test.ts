import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserTaskStore,
  type BrowserServiceStatus,
} from './browser-task-store.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'browser-task-'));
  dirs.push(dir);
  const path = join(dir, 'tasks.json');
  let now = 1000;
  const changed = vi.fn();
  const store = new BrowserTaskStore(path, changed, () => now);
  const task = store.start('conversation', 'Update my delivery address');
  store.attach(task.id, task.scope, 'sess_' + 'a'.repeat(22), 'a'.repeat(64));
  const hid = randomUUID();
  store.update(task.id, task.scope, 'handoff', (t) => {
    t.state = 'waiting_for_user';
    t.sessions[0].handoffs.push({ id: hid, requestedAt: now, readyAt: now });
  });
  const status: BrowserServiceStatus = {
    version: 1,
    epoch: randomUUID(),
    revision: 3,
  };
  const apply = (value: BrowserServiceStatus | null, baseline = false) =>
    store.status(task.id, task.scope, 'a'.repeat(64), hid, value, baseline);
  apply(status, true);
  return {
    store,
    task,
    hid,
    status,
    apply,
    path,
    changed,
    advance: () => {
      now += 1000;
    },
    read: () => store.get(task.id, task.scope),
  };
}
describe('BrowserTask durable state', () => {
  it('survives restarts and spans multiple sessions without session release claiming success', () => {
    const f = fixture();
    f.store.update(f.task.id, f.task.scope, 'released', (t) => {
      t.sessions[0].releasedAt = 2000;
    });
    f.store.attach(
      f.task.id,
      f.task.scope,
      'sess_' + 'b'.repeat(22),
      'b'.repeat(64)
    );
    const restored = new BrowserTaskStore(f.path).get(f.task.id, f.task.scope);
    expect(restored.sessions).toHaveLength(2);
    expect(restored.outcome).toBeUndefined();
    expect(restored.state).toBe('waiting_for_user');
    expect(() => f.store.get(f.task.id, 'someone-else')).toThrow('not found');
  });
  it('uses service evidence after a handoff baseline, independent of any client continuation', () => {
    const f = fixture();
    f.advance();
    expect(
      f.apply({
        ...f.status,
        fill: { revision: 2, at: 500, formId: 'old', submitted: true },
      }).state
    ).toBe('waiting_for_user');
    const filled = {
      ...f.status,
      revision: 4,
      fill: { revision: 4, at: 2000, formId: 'login', submitted: true },
    };
    expect(f.apply(filled).state).toBe('waiting_for_agent');
    const otp = {
      ...filled,
      revision: 5,
      form: { revision: 5, at: 2100, formId: 'otp' },
    };
    expect(f.apply(otp).state).toBe('waiting_for_user');
    expect(f.apply({ ...filled, revision: 4 }).state).toBe('waiting_for_user');
    expect(f.read().outcome).toBeUndefined();
  });
  it('retains state on unavailable/reset service and does not manufacture completion', () => {
    const f = fixture();
    f.apply(null);
    expect(f.read().sessions[0].handoffs[0].checkFailedAt).toBeDefined();
    f.apply({
      ...f.status,
      epoch: randomUUID(),
      revision: 20,
      fill: { revision: 20, at: 2000, formId: 'new', submitted: true },
    });
    expect(f.read().state).toBe('waiting_for_user');
    expect(f.read().sessions[0].handoffs[0].fillAt).toBeUndefined();
  });
  it.each([true, false])(
    'keeps a redisplayed form waiting for the user only after submission (submitted=%s)',
    (submitted) => {
      const f = fixture();
      const filled = {
        ...f.status,
        revision: 4,
        fill: { revision: 4, at: 2000, formId: 'login', submitted },
      };
      expect(f.apply(filled).state).toBe('waiting_for_agent');
      const redisplayed = f.apply({
        ...filled,
        revision: 5,
        form: { revision: 5, at: 2100, formId: 'login' },
      });
      expect(redisplayed.state).toBe(
        submitted ? 'waiting_for_user' : 'waiting_for_agent'
      );
      expect(redisplayed.sessions[0].handoffs[0].nextFormAt).toBeUndefined();
      expect(redisplayed.outcome).toBeUndefined();
    }
  );
  it('keeps intentional pauses, records receipts while paused, and reports an attributed outcome', () => {
    const f = fixture();
    f.store.pause(f.task.id, f.task.scope);
    expect(
      f.apply({
        ...f.status,
        revision: 4,
        fill: { revision: 4, at: 2000, formId: 'login', submitted: false },
      }).state
    ).toBe('paused');
    f.store.resume(f.task.id, f.task.scope);
    const done = f.store.report(
      f.task.id,
      f.task.scope,
      'partial',
      'Address filled; saving was not verified.'
    );
    expect(done.state).toBe('closed');
    expect(done.outcome?.source).toBe('agent');
    expect(
      f.store.report(
        f.task.id,
        f.task.scope,
        'partial',
        'Address filled; saving was not verified.'
      ).revision
    ).toBe(done.revision);
    expect(f.apply(null).revision).toBe(done.revision);
  });
  it('requires explicit switching and refuses sharing a session with an outstanding handoff', () => {
    const f = fixture();
    expect(() => f.store.start(f.task.scope, 'Another task')).toThrow(
      'already selected'
    );
    f.store.pause(f.task.id, f.task.scope);
    const other = f.store.start(f.task.scope, 'Another task');
    expect(() => f.store.resume(f.task.id, f.task.scope)).toThrow('Pause');
    expect(() =>
      f.store.attach(
        other.id,
        other.scope,
        'sess_' + 'a'.repeat(22),
        'a'.repeat(64)
      )
    ).toThrow('outstanding handoff');
  });
  it('fails closed on corrupt persisted data and telemetry failures do not undo saves', () => {
    const f = fixture();
    const existing = readFileSync(f.path, 'utf8');
    f.changed.mockImplementation(() => {
      throw new Error('telemetry unavailable');
    });
    expect(() => f.store.pause(f.task.id, f.task.scope)).not.toThrow();
    writeFileSync(f.path, '{bad');
    expect(() => new BrowserTaskStore(f.path)).toThrow('not overwritten');
    expect(readFileSync(f.path, 'utf8')).toBe('{bad');
    writeFileSync(f.path, existing);
    expect(new BrowserTaskStore(f.path).list()).toHaveLength(1);
  });
});
