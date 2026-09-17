import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DAY,
  MINUTE,
  type CampaignState,
  eligibleEnrollment,
  evaluateCampaign,
} from './model.js';
import { type CampaignDeps, createCampaign } from './runner.js';
import type { CampaignStore } from './store.js';
import { isStopTips } from './templates.js';

const enrolledAt = Date.parse('2026-09-17T15:37:00Z');
const facts = { enabled: true, hasTask: false, busy: false };
function state(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    owner: '~ten',
    version: 1,
    enrolledAt,
    timezone: 'America/New_York',
    status: 'active',
    sent: [],
    skipped: [],
    ...overrides,
  };
}
function memoryStore(initial?: CampaignState) {
  const rows = new Map<string, CampaignState>();
  if (initial) rows.set(initial.owner, structuredClone(initial));
  const store = {
    lookup: vi.fn(async (key: string) =>
      rows.has(key) ? structuredClone(rows.get(key)) : undefined
    ),
    register: vi.fn(async (key: string, value: CampaignState) => {
      rows.set(key, structuredClone(value));
    }),
    registerIfAbsent: vi.fn(async (key: string, value: CampaignState) => {
      if (rows.has(key)) return false;
      rows.set(key, structuredClone(value));
      return true;
    }),
  } as unknown as CampaignStore;
  return { store, read: () => rows.get('~ten')! };
}
function harness(initial = state(), overrides: Partial<CampaignDeps> = {}) {
  let time = enrolledAt + DAY;
  const memory = memoryStore(initial);
  const deps: CampaignDeps = {
    owner: '~ten',
    config: () => ({ enabled: true, enrollAfter: '2026-09-17T00:00:00Z' }),
    store: () => memory.store,
    hasTask: vi.fn(async () => false),
    busy: () => false,
    readMarker: vi.fn(async () => undefined),
    send: vi.fn(async () => {}),
    report: vi.fn(),
    error: vi.fn(),
    now: () => time,
    ...overrides,
  };
  return {
    ...memory,
    deps,
    campaign: createCampaign(deps),
    advance: (ms: number) => {
      time += ms;
    },
    setTime: (ms: number) => {
      time = ms;
    },
  };
}
afterEach(() => vi.useRealTimers());

describe('campaign evaluator', () => {
  it('waits 24 hours, preserves enrollment time of day, and respects quiet hours', () => {
    expect(evaluateCampaign(state(), facts, enrolledAt + DAY - 1)).toEqual({
      kind: 'defer',
    });
    expect(evaluateCampaign(state(), facts, enrolledAt + DAY)).toEqual({
      kind: 'send',
      step: 'useful-request',
    });
    expect(
      evaluateCampaign(
        state({ enrolledAt: enrolledAt - 12 * 60 * MINUTE }),
        facts,
        Date.parse('2026-09-18T03:00:00Z')
      )
    ).toEqual({ kind: 'defer' });
  });
  it.each([undefined, 'not/a-zone'])(
    'defers unknown timezone %s',
    (timezone) => {
      expect(
        evaluateCampaign(state({ timezone }), facts, enrolledAt + DAY).kind
      ).toBe('defer');
    }
  );
  it('defers during recent conversation or active runs', () => {
    expect(
      evaluateCampaign(state(), { ...facts, busy: true }, enrolledAt + DAY).kind
    ).toBe('defer');
    expect(
      evaluateCampaign(
        state(),
        { ...facts, lastActivityAt: enrolledAt + DAY - MINUTE },
        enrolledAt + DAY
      ).kind
    ).toBe('defer');
  });
  it('skips intermediate tips after two unanswered sends but keeps the closing slot', () => {
    const current = state({
      sent: [
        { step: 'useful-request', at: enrolledAt + DAY },
        { step: 'recurring-help', at: enrolledAt + 2 * DAY },
      ],
    });
    expect(evaluateCampaign(current, facts, enrolledAt + 3 * DAY)).toEqual({
      kind: 'skip',
      step: 'archive',
      reason: 'unanswered',
    });
    current.skipped = [
      { step: 'archive', reason: 'unanswered' },
      { step: 'own-material', reason: 'unanswered' },
    ];
    expect(evaluateCampaign(current, facts, enrolledAt + 6 * DAY)).toEqual({
      kind: 'send',
      step: 'closing',
    });
    expect(evaluateCampaign(current, facts, enrolledAt + 7 * DAY)).toEqual({
      kind: 'finish',
      status: 'completed',
    });
  });
  it('a DM reply resets silence backoff', () => {
    const current = state({
      sent: [
        { step: 'useful-request', at: enrolledAt + DAY },
        { step: 'recurring-help', at: enrolledAt + 2 * DAY },
      ],
      lastReplyAt: enrolledAt + 2 * DAY + MINUTE,
    });
    expect(evaluateCampaign(current, facts, enrolledAt + 3 * DAY)).toEqual({
      kind: 'send',
      step: 'archive',
    });
  });
  it('does not cram two delayed messages together', () => {
    const current = state({
      sent: [{ step: 'useful-request', at: enrolledAt + 2 * DAY - MINUTE }],
    });
    expect(evaluateCampaign(current, facts, enrolledAt + 2 * DAY).kind).toBe(
      'defer'
    );
  });
  it('stops on any user task, expiry, opt-out, or kill switch', () => {
    expect(
      evaluateCampaign(state(), { ...facts, hasTask: true }, enrolledAt + DAY)
    ).toEqual({ kind: 'finish', status: 'converted' });
    expect(evaluateCampaign(state(), facts, enrolledAt + 7 * DAY)).toEqual({
      kind: 'finish',
      status: 'completed',
    });
    expect(
      evaluateCampaign(state({ status: 'opted-out' }), facts, enrolledAt + DAY)
        .kind
    ).toBe('defer');
    expect(
      evaluateCampaign(state(), { ...facts, enabled: false }, enrolledAt + DAY)
        .kind
    ).toBe('defer');
  });
});

describe('enrollment eligibility', () => {
  const config = { enabled: true, enrollAfter: '2026-09-17T00:00:00Z' };
  const request = {
    isFirstGroup: true,
    campaignVersion: 1,
    occurredAt: enrolledAt,
  };
  it('accepts only fresh initial events from the new protocol after the rollout boundary', () => {
    expect(eligibleEnrollment(request, config, enrolledAt)).toBe(true);
    expect(
      eligibleEnrollment(
        { ...request, isFirstGroup: false },
        config,
        enrolledAt
      )
    ).toBe(false);
    expect(
      eligibleEnrollment(
        { ...request, campaignVersion: undefined },
        config,
        enrolledAt
      )
    ).toBe(false);
    expect(eligibleEnrollment(request, config, enrolledAt + DAY)).toBe(false);
    expect(eligibleEnrollment(request, { enabled: true }, enrolledAt)).toBe(
      false
    );
    expect(
      eligibleEnrollment(request, { ...config, enabled: false }, enrolledAt)
    ).toBe(false);
    expect(
      eligibleEnrollment(
        request,
        { ...config, enrollAfter: '2026-09-18T00:00:00Z' },
        enrolledAt
      )
    ).toBe(false);
  });
});

describe('campaign runner', () => {
  it('retains a fresh enrollment until the store recovers without resetting its server time', async () => {
    const memory = memoryStore();
    let available = false;
    const h = harness(state(), {
      store: () => (available ? memory.store : null),
    });
    h.setTime(enrolledAt);
    await h.campaign.enroll({
      isFirstGroup: true,
      campaignVersion: 1,
      timezone: 'Etc/UTC',
      occurredAt: enrolledAt,
    });
    expect(memory.read()).toBeUndefined();
    available = true;
    h.advance(MINUTE);
    await h.campaign.check();
    expect(memory.read().enrolledAt).toBe(enrolledAt);
    await h.campaign.enroll({
      isFirstGroup: true,
      campaignVersion: 1,
      occurredAt: enrolledAt + MINUTE,
    });
    expect(memory.read().enrolledAt).toBe(enrolledAt);
    expect(h.deps.send).not.toHaveBeenCalled();
  });
  it('recovers an accepted send after a state write fails', async () => {
    const h = harness();
    vi.mocked(h.store.register).mockRejectedValueOnce(
      new Error('store offline')
    );
    await h.campaign.check();
    expect(h.read().sent).toHaveLength(0);
    vi.mocked(h.deps.readMarker).mockResolvedValue(enrolledAt + DAY);
    await createCampaign(h.deps).check();
    expect(h.read().sent).toHaveLength(1);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
  });
  it('deduplicates overlapping checks and restarts using the durable sent list', async () => {
    const h = harness();
    await Promise.all([h.campaign.check(), h.campaign.check()]);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(h.read().sent).toEqual([
      { step: 'useful-request', at: enrolledAt + DAY },
    ]);
    await createCampaign(h.deps).check();
    expect(h.deps.send).toHaveBeenCalledTimes(1);
  });
  it('recovers a sent marker after a crash before the sent list was written', async () => {
    const h = harness(state(), {
      readMarker: async () => enrolledAt + DAY - MINUTE,
    });
    await h.campaign.check();
    expect(h.deps.send).not.toHaveBeenCalled();
    expect(h.read().sent).toHaveLength(1);
  });
  it('rereads DM history after an uncertain send error', async () => {
    const readMarker = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(enrolledAt + DAY);
    const h = harness(state(), {
      readMarker,
      send: vi.fn(async () => {
        throw new Error('timeout');
      }),
    });
    await h.campaign.check();
    expect(h.read().sent).toHaveLength(1);
    expect(h.deps.error).not.toHaveBeenCalled();
  });
  it('recovers a late accepted send across the slot boundary before evaluating the next tip', async () => {
    const sentAt = enrolledAt + 2 * DAY - MINUTE;
    const h = harness(state(), {
      readMarker: vi.fn(async (key) =>
        key === 'campaign-v1-useful-request' ? sentAt : undefined
      ),
    });
    h.setTime(enrolledAt + 2 * DAY + MINUTE);
    await h.campaign.check();
    expect(h.read().sent).toEqual([{ step: 'useful-request', at: sentAt }]);
    expect(h.deps.send).not.toHaveBeenCalled();
    expect(h.read().skipped).toEqual([]);
  });
  it('skips missed slots and sends at most one current tip after downtime', async () => {
    const h = harness();
    h.advance(5 * DAY);
    await h.campaign.check();
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(h.read().sent[0].step).toBe('closing');
    expect(h.read().skipped).toHaveLength(4);
    h.advance(DAY);
    await h.campaign.check();
    expect(h.read().status).toBe('completed');
  });
  it('stops permanently when a task was created outside onboarding', async () => {
    const h = harness(state(), { hasTask: async () => true });
    await h.campaign.check();
    expect(h.read().status).toBe('converted');
    expect(h.deps.send).not.toHaveBeenCalled();
    await createCampaign({ ...h.deps, hasTask: async () => false }).check();
    expect(h.deps.send).not.toHaveBeenCalled();
  });
  it('fails closed when the store or scheduler is unavailable', async () => {
    const h = harness(state(), { store: () => null });
    await h.campaign.check();
    expect(h.deps.send).not.toHaveBeenCalled();
    const unavailable = harness(state(), {
      hasTask: async () => {
        throw new Error('offline');
      },
    });
    await unavailable.campaign.check();
    expect(unavailable.deps.send).not.toHaveBeenCalled();
  });
  it('persists opt-out across restarts and does not re-enroll on a new version', async () => {
    const h = harness();
    await h.campaign.check();
    expect(await h.campaign.inbound('Please stop these tips.', true)).toBe(
      true
    );
    expect(h.read().status).toBe('opted-out');
    h.advance(DAY);
    await createCampaign(h.deps).enroll({
      isFirstGroup: true,
      campaignVersion: 1,
      occurredAt: enrolledAt + 2 * DAY,
    });
    await createCampaign(h.deps).check();
    expect(h.deps.send).toHaveBeenCalledTimes(2); // One tip and the stop acknowledgement.
  });
  it('consumes opt-out even when context lookup, persistence, and acknowledgment fail', async () => {
    const h = harness();
    vi.mocked(h.store.lookup).mockRejectedValue(new Error('store unavailable'));
    vi.mocked(h.deps.send).mockRejectedValue(
      new Error('transport unavailable')
    );
    expect(await h.campaign.replyContext()).toBeUndefined();
    expect(await h.campaign.inbound('/stop-tips', true)).toBe(true);
    vi.mocked(h.store.lookup).mockResolvedValue(state());
    vi.mocked(h.deps.send).mockClear();
    await h.campaign.check();
    expect(h.read().status).toBe('opted-out');
    expect(h.deps.send).not.toHaveBeenCalled();
  });
  it('bridges an ordinary yes reply to the last out-of-band DM tip', async () => {
    const h = harness();
    await h.campaign.check();
    h.advance(MINUTE);
    expect(await h.campaign.replyContext()).toContain('What’s one thing');
    expect(await h.campaign.inbound('yes', true)).toBe(false);
    expect(h.read().lastReplyAt).toBe(enrolledAt + DAY + MINUTE);
    expect(await h.campaign.replyContext()).toBeUndefined();
  });
  it('lets a reply between slots restore later tips after two unanswered sends', async () => {
    const h = harness();
    await h.campaign.check();
    h.advance(DAY);
    await h.campaign.check();
    h.advance(MINUTE);
    await h.campaign.check();
    expect(h.read().skipped).toEqual([]);
    h.advance(MINUTE);
    await h.campaign.inbound('yes', true);
    h.advance(DAY);
    await h.campaign.check();
    expect(h.read().sent.map((post) => post.step)).toEqual([
      'useful-request',
      'recurring-help',
      'archive',
    ]);
  });
  it('a group message delays sends but does not count as a campaign reply', async () => {
    const h = harness();
    await h.campaign.inbound('hello group', false);
    await h.campaign.check();
    expect(h.deps.send).not.toHaveBeenCalled();
    expect(h.read().lastReplyAt).toBeUndefined();
  });
  it('rechecks task creation and opt-out after reading history', async () => {
    const hasTask = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const h = harness(state(), { hasTask });
    await h.campaign.check();
    expect(h.deps.send).not.toHaveBeenCalled();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reading!: () => void;
    const started = new Promise<void>((resolve) => {
      reading = resolve;
    });
    const h2 = harness(state(), {
      readMarker: async () => {
        reading();
        await gate;
        return undefined;
      },
    });
    const check = h2.campaign.check();
    await started;
    const stop = h2.campaign.inbound('/stop-tips', true);
    release();
    await Promise.all([check, stop]);
    expect(h2.deps.send).toHaveBeenCalledTimes(1);
    expect(h2.read().sent).toHaveLength(0);
  });
  it('owns a one-minute timer and cleans it up on shutdown or abort', async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const h = harness(state(), { signal: abort.signal });
    h.campaign.start();
    await h.campaign.check();
    expect(vi.getTimerCount()).toBe(1);
    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
    await h.campaign.stop();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
  });
});

it.each([
  'stop these tips',
  '/stop-tips',
  'Don’t send me more tips.',
  'please stop sending me these tips',
  'please stop tips',
])('recognizes opt-out: %s', (text) => expect(isStopTips(text)).toBe(true));
it.each([
  'stop',
  'unsubscribe',
  'stop my weekly task',
  'do not stop these tips',
  'research bus stop architecture',
])('does not reinterpret task requests: %s', (text) =>
  expect(isStopTips(text)).toBe(false)
);
