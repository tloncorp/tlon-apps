import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DAY,
  MINUTE,
  type CampaignState,
  eligibleEnrollment,
  evaluateCampaign,
  nextCampaignWake,
} from './model.js';
import { type CampaignDeps, createCampaign } from './runner.js';
import type { CampaignStore } from './store.js';
import { RECURRING_OFFER, renderTip, isStopTips } from './templates.js';

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
    ).toMatchObject({ kind: 'defer' });
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
    ).toEqual({ kind: 'defer' });
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
    const h = harness(state({ destination: '~ten' }));
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
      expect.objectContaining({ step: 'useful-request', at: enrolledAt + DAY }),
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
    expect(h.read().status).toBe('feedback');
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
  it('consumes opt-out for a known enrollee even when context lookup, persistence, and acknowledgment fail', async () => {
    const h = harness();
    await h.campaign.check();
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
    expect(await h.campaign.replyContext()).not.toContain(
      'Your most recent onboarding tip'
    );
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
    expect(h.read().lastReplyAt ?? 0).toBe(0);
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
  it('owns one scheduled wake and cleans it up on shutdown or abort', async () => {
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

describe('ticket conversation flow', () => {
  it('reuses onboarding topics and stops using them when the owner changes context', async () => {
    const context = vi.fn(async () => ({ topic: 'architecture' }));
    const h = harness(state(), { context });
    await h.campaign.check();
    expect(h.deps.send).toHaveBeenCalledWith(
      expect.stringContaining('architecture'),
      'campaign-v1-useful-request',
      '~ten'
    );
    await h.campaign.inbound('Actually help with my garden', true);
    expect(await h.campaign.replyContext()).toContain('my garden');
    expect(await h.campaign.replyContext()).toContain('architecture');
    expect(await h.campaign.replyContext()).toContain(
      'latest owner request takes precedence'
    );
    expect(renderTip('useful-request', h.read(), {})).not.toContain(
      'architecture'
    );
  });
  it('offers recurring work in the useful reply and suppresses the later duplicate prompt', async () => {
    const h = harness();
    expect(await h.campaign.replyContext()).toContain(RECURRING_OFFER);
    await h.campaign.check();
    await h.campaign.observeReply(
      `Here is the answer. ${RECURRING_OFFER}`,
      '~ten'
    );
    h.advance(DAY);
    await h.campaign.check();
    expect(h.read().skipped).toContainEqual({
      step: 'recurring-help',
      reason: 'already-offered',
    });
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(await h.campaign.replyContext()).toContain('Do not repeat');
  });
  it('does not treat an offer posted to another conversation as this campaign offer', async () => {
    const h = harness();
    await h.campaign.observeReply(RECURRING_OFFER, 'chat/~other/shared');
    expect(h.read().offeredAt).toBeUndefined();
  });
  it('defers while visible, learns timezone from activity, and expires stale visibility', async () => {
    const h = harness(state({ timezone: undefined }));
    await h.campaign.opened('entry', 'America/New_York');
    expect(h.read().timezone).toBe('America/New_York');
    expect(h.deps.send).not.toHaveBeenCalled();
    h.advance(2 * MINUTE);
    await h.campaign.check();
    expect(h.deps.send).toHaveBeenCalledTimes(1);
  });
  it('asks for feedback on the next open after a verified task delivery, once', async () => {
    let task = {
      id: 'task',
      name: 'Architecture digest',
      enabled: true,
      deliveredAt: undefined as number | undefined,
    };
    const h = harness(state(), { task: async () => task });
    await h.campaign.check();
    expect(h.read().status).toBe('feedback');
    expect(h.deps.send).not.toHaveBeenCalled();
    task.deliveredAt = enrolledAt + DAY;
    h.advance(MINUTE);
    await h.campaign.opened('entry', 'America/New_York');
    expect(h.deps.send).toHaveBeenCalledWith(
      expect.stringContaining('Architecture digest'),
      'campaign-v1-task-feedback',
      '~ten'
    );
    h.advance(MINUTE);
    await h.campaign.opened('entry-two', 'America/New_York');
    expect(h.deps.send).toHaveBeenCalledTimes(1);
  });
  it('prioritizes a failed task, and does not claim undelivered work succeeded', async () => {
    const h = harness(state(), {
      task: async () => ({
        id: 'task',
        name: 'Digest',
        enabled: true,
        failedAt: enrolledAt + DAY - MINUTE,
      }),
    });
    await h.campaign.opened('entry', 'America/New_York');
    expect(h.deps.send).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      'campaign-v1-task-feedback',
      '~ten'
    );
  });
  it('preserves the five-message limit even when feedback replaces a scheduled tip', () => {
    const sent = [
      'useful-request',
      'recurring-help',
      'archive',
      'own-material',
      'task-feedback',
    ].map((step) => ({ step, at: enrolledAt + DAY })) as CampaignState['sent'];
    expect(
      evaluateCampaign(state({ sent }), facts, enrolledAt + 6 * DAY)
    ).toEqual({ kind: 'finish', status: 'completed' });
  });
  it('supports all three directions and configurable copy without resetting enrollment', () => {
    expect(
      renderTip('useful-request', state({ direction: 'archive' }), {})
    ).toContain('link');
    expect(
      renderTip('useful-request', state({ direction: 'routine' }), {})
    ).toContain('working on');
    expect(
      renderTip('useful-request', state({ topic: 'gardens' }), {
        copy: { 'useful-request': 'What about {topic}?' },
      })
    ).toContain('What about gardens?');
  });
  it('does not retry an uncertain unconfirmed delivery across restarts', async () => {
    const h = harness(state(), {
      send: vi.fn(async () => {
        throw new Error('timeout');
      }),
    });
    await h.campaign.check();
    await createCampaign(h.deps).check();
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(h.read().skipped).toContainEqual({
      step: 'useful-request',
      reason: 'attempt-already-claimed',
    });
  });
});

it('keeps feedback pending through a busy conversation while presence is refreshed', async () => {
  let busy = true;
  const h = harness(state(), {
    busy: () => busy,
    task: async () => ({
      id: 'task',
      name: 'Digest',
      enabled: true,
      deliveredAt: enrolledAt + DAY - MINUTE,
    }),
  });
  await h.campaign.inbound('thanks', true);
  await h.campaign.opened('entry', 'America/New_York');
  h.advance(16 * MINUTE);
  await h.campaign.opened('entry', 'America/New_York');
  busy = false;
  await h.campaign.check();
  expect(h.read().sent.at(-1)?.step).toBe('task-feedback');
});
it('prioritizes a newly failed task at closing even after earlier feedback', () => {
  const current = state({
    status: 'feedback',
    sent: [{ step: 'task-feedback', at: enrolledAt + DAY }],
  });
  expect(
    renderTip(
      'closing',
      current,
      {},
      {
        id: 'task',
        name: 'Digest',
        enabled: true,
        failedAt: enrolledAt + 5 * DAY,
      }
    )
  ).toContain('failed');
});

it('keeps spacing after an ambiguous late send whose marker is unavailable', async () => {
  const h = harness(state(), {
    send: vi.fn(async () => {
      throw new Error('timeout');
    }),
  });
  h.setTime(enrolledAt + 2 * DAY - MINUTE);
  await h.campaign.check();
  await createCampaign(h.deps).check();
  h.advance(2 * MINUTE);
  await createCampaign(h.deps).check();
  expect(h.deps.send).toHaveBeenCalledTimes(1);
});

it('accepts bounded clock skew but rejects stale or far-future intros', () => {
  const config = { enabled: true, enrollAfter: '2026-09-17T00:00:00Z' };
  for (const delta of [-5 * MINUTE, 5 * MINUTE]) {
    expect(
      eligibleEnrollment(
        {
          isFirstGroup: true,
          campaignVersion: 1,
          occurredAt: enrolledAt + delta,
        },
        config,
        enrolledAt
      )
    ).toBe(true);
  }
  for (const delta of [-5 * MINUTE - 1, 5 * MINUTE + 1]) {
    expect(
      eligibleEnrollment(
        {
          isFirstGroup: true,
          campaignVersion: 1,
          occurredAt: enrolledAt + delta,
        },
        config,
        enrolledAt
      )
    ).toBe(false);
  }
});
it('does not intercept opt-out text when disabled or never enrolled', async () => {
  const disabled = harness(state(), { config: () => ({ enabled: false }) });
  const memory = memoryStore();
  const absent = harness(state(), { store: () => memory.store });
  for (const h of [disabled, absent]) {
    expect(await h.campaign.inbound('/stop-tips', true)).toBe(false);
    expect(h.deps.send).not.toHaveBeenCalled();
  }
  expect(disabled.read().status).toBe('active');
  expect(memory.store.register).not.toHaveBeenCalled();
});
it('records a verified group reply even when optional context cannot load', async () => {
  const h = harness(state(), {
    destination: async () => 'chat/~zod/setup',
    context: async () => {
      throw new Error('history unavailable');
    },
  });
  expect(await h.campaign.replyContext('chat/~zod/setup')).toBeUndefined();
  await h.campaign.inboundInConversation('yes', 'chat/~zod/setup');
  expect(h.read().lastReplyAt).toBe(enrolledAt + DAY);
  h.advance(MINUTE);
  await h.campaign.inboundInConversation('unrelated', 'chat/~mug/public');
  expect(h.read().lastReplyAt).toBe(enrolledAt + DAY);
});

it('applies closing copy after successful task feedback', () => {
  const current = state({
    sent: [{ step: 'task-feedback', at: enrolledAt + DAY }],
  });
  const task = {
    id: 'task',
    name: 'Digest',
    enabled: true,
    deliveredAt: enrolledAt + DAY,
  };
  expect(
    renderTip(
      'closing',
      current,
      { copy: { closing: 'Adjust {task} anytime.' } },
      task
    )
  ).toBe('Adjust Digest anytime.');
  expect(renderTip('closing', current, {}, task)).toContain(
    'adjust your existing tasks'
  );
});

describe('one-shot scheduling', () => {
  function clockHarness(
    initial = state(),
    overrides: Partial<CampaignDeps> = {}
  ) {
    vi.useFakeTimers();
    vi.setSystemTime(initial.enrolledAt);
    return harness(initial, {
      now: () => Date.now(),
      context: vi.fn(async () => ({})),
      destination: vi.fn(async () => '~ten'),
      ...overrides,
    });
  }
  it('sleeps through the first day without history or privacy reads, then sends once', async () => {
    const h = clockHarness();
    h.campaign.start();
    await h.campaign.check();
    expect(vi.getTimerCount()).toBe(1);
    expect(h.deps.context).not.toHaveBeenCalled();
    expect(h.deps.destination).not.toHaveBeenCalled();
    const initialChecks = vi.mocked(h.deps.hasTask).mock.calls.length;
    await vi.advanceTimersByTimeAsync(DAY - 1);
    expect(h.deps.hasTask).toHaveBeenCalledTimes(initialChecks);
    expect(h.deps.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(h.deps.context).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await h.campaign.stop();
  });
  it('restores the next send time from persisted progress on restart', async () => {
    const h = clockHarness(
      state({ sent: [{ step: 'useful-request', at: enrolledAt + DAY }] })
    );
    vi.setSystemTime(enrolledAt + DAY + 12 * 60 * MINUTE);
    h.campaign.start();
    await h.campaign.check();
    expect(h.deps.context).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(12 * 60 * MINUTE - 1);
    expect(h.deps.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    expect(h.read().sent.at(-1)?.step).toBe('recurring-help');
    await h.campaign.stop();
  });
  it('retries a busy due send after fifteen minutes without polling in between', async () => {
    let busy = true;
    const h = clockHarness(state(), { busy: () => busy });
    vi.setSystemTime(enrolledAt + DAY);
    h.campaign.start();
    await h.campaign.check();
    expect(h.deps.context).not.toHaveBeenCalled();
    const checks = vi.mocked(h.deps.hasTask).mock.calls.length;
    await vi.advanceTimersByTimeAsync(15 * MINUTE - 1);
    expect(h.deps.hasTask).toHaveBeenCalledTimes(checks);
    busy = false;
    await vi.advanceTimersByTimeAsync(1);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    await h.campaign.stop();
  });
  it('backs off after a due history lookup fails, then recovers without a hot loop', async () => {
    const context = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({});
    const h = clockHarness(state(), { context });
    vi.setSystemTime(enrolledAt + DAY);
    h.campaign.start();
    await h.campaign.check();
    expect(context).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15 * MINUTE - 1);
    expect(context).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.deps.send).toHaveBeenCalledTimes(1);
    await h.campaign.stop();
  });
  it('reschedules after a personal reply and skips the generic first prompt', async () => {
    const h = clockHarness();
    h.campaign.start();
    await h.campaign.check();
    await vi.advanceTimersByTimeAsync(DAY - 10 * MINUTE);
    await h.campaign.inbound('Help me research architecture', true);
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(h.deps.send).not.toHaveBeenCalled();
    expect(h.read().skipped).toContainEqual({
      step: 'useful-request',
      reason: 'context-changed',
    });
    await vi.advanceTimersByTimeAsync(DAY);
    expect(h.read().sent.at(-1)?.step).toBe('recurring-help');
    await h.campaign.stop();
  });
  it('uses a task/open event for feedback instead of waiting for the scheduled closing', async () => {
    let task:
      | { id: string; name: string; enabled: boolean; deliveredAt?: number }
      | undefined;
    const h = clockHarness(state(), { task: async () => task });
    h.campaign.start();
    await h.campaign.check();
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    task = {
      id: 'digest',
      name: 'Digest',
      enabled: true,
      deliveredAt: Date.now() - 1,
    };
    await h.campaign.taskCreated();
    expect(h.read().status).toBe('feedback');
    expect(h.deps.context).not.toHaveBeenCalled();
    await h.campaign.opened('returned', 'America/New_York');
    expect(h.read().sent.at(-1)?.step).toBe('task-feedback');
    await h.campaign.stop();
  });
  it('does not lose an open event while an older task lookup is in flight', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let task: {
      id: string;
      name: string;
      enabled: boolean;
      deliveredAt?: number;
    } = { id: 'digest', name: 'Digest', enabled: true };
    let first = true;
    const h = clockHarness(state({ status: 'feedback' }), {
      task: async () => {
        const snapshot = task;
        if (first) {
          first = false;
          entered();
          await gate;
        }
        return snapshot;
      },
    });
    vi.setSystemTime(enrolledAt + DAY);
    h.campaign.start();
    await waiting;
    task = { ...task, deliveredAt: Date.now() - 1 };
    const opened = h.campaign.opened('after-delivery', 'America/New_York');
    release();
    await opened;
    expect(h.read().sent.at(-1)?.step).toBe('task-feedback');
    await h.campaign.stop();
  });
  it('cancels scheduled wakes on opt-out, and schedules nothing for disabled or finished campaigns', async () => {
    const h = clockHarness();
    h.campaign.start();
    await h.campaign.check();
    await h.campaign.inbound('/stop-tips', true);
    expect(vi.getTimerCount()).toBe(0);
    await h.campaign.stop();
    for (const status of ['completed', 'opted-out'] as const) {
      const done = clockHarness(state({ status }));
      done.campaign.start();
      await done.campaign.check();
      expect(vi.getTimerCount()).toBe(0);
      await done.campaign.stop();
    }
    const disabled = clockHarness(state(), {
      config: () => ({ enabled: false }),
    });
    disabled.campaign.start();
    await disabled.campaign.check();
    expect(vi.getTimerCount()).toBe(0);
    await disabled.campaign.stop();
  });
  it('waits until the next local window when spacing ends at night', () => {
    const current = state({
      enrolledAt: Date.parse('2026-09-17T00:00:00Z'),
      activityMinute: 9 * 60,
      sent: [
        { step: 'useful-request', at: Date.parse('2026-09-18T02:00:00Z') },
      ],
    });
    const at = Date.parse('2026-09-19T01:00:00Z');
    expect(nextCampaignWake(current, facts, at)).toBe(
      Date.parse('2026-09-19T13:00:00Z')
    );
  });
  it.each([
    ['2026-03-08T03:00:00Z', '2026-03-08T13:00:00Z'],
    ['2026-11-01T02:00:00Z', '2026-11-01T14:00:00Z'],
  ])(
    'keeps the local wake time across an offset change at %s',
    (at, expected) => {
      const now = Date.parse(at);
      expect(
        nextCampaignWake(
          state({
            enrolledAt: now - DAY - 60 * MINUTE,
            activityMinute: 9 * 60,
          }),
          facts,
          now
        )
      ).toBe(Date.parse(expected));
    }
  );
});
