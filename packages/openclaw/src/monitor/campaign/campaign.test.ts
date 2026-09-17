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
    save: vi.fn(async (value: CampaignState) => {
      rows.set(value.owner, structuredClone(value));
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
    vi.mocked(h.store.save).mockRejectedValueOnce(new Error('store offline'));
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
  it('uses no private timer and stops checking after shutdown or abort', async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const h = harness(state(), { signal: abort.signal });
    h.campaign.start();
    await h.campaign.check();
    expect(vi.getTimerCount()).toBe(0);
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

  it('asks for feedback on a regular check after verified task delivery, once', async () => {
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
    await h.campaign.check();
    expect(h.deps.send).toHaveBeenCalledWith(
      expect.stringContaining('Architecture digest'),
      'campaign-v1-task-feedback',
      '~ten'
    );
    h.advance(MINUTE);
    await h.campaign.check();
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
    await h.campaign.check();
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
});

it('keeps feedback pending through recent messages and busy runs', async () => {
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
  await h.campaign.check();
  h.advance(16 * MINUTE);
  await h.campaign.check();
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
  expect(memory.store.save).not.toHaveBeenCalled();
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

it('retries an unconfirmed send on the next check and records success', async () => {
  const h = harness();
  vi.mocked(h.deps.send).mockRejectedValueOnce(new Error('timeout'));
  await h.campaign.check();
  expect(h.read().sent).toHaveLength(0);
  h.advance(15 * MINUTE);
  await h.campaign.check();
  expect(h.deps.send).toHaveBeenCalledTimes(2);
  expect(h.read().sent).toHaveLength(1);
});
it('does no history or privacy reads before a tip is due', async () => {
  const destination = vi.fn(async () => '~ten');
  const context = vi.fn(async () => ({ topic: 'gardens' }));
  const h = harness(state(), { destination, context });
  h.setTime(enrolledAt);
  for (let i = 0; i < 96; i++) {
    await h.campaign.check();
    h.advance(15 * MINUTE);
  }
  expect(destination).not.toHaveBeenCalled();
  expect(context).not.toHaveBeenCalled();
  expect(h.deps.readMarker).not.toHaveBeenCalled();
  await h.campaign.check();
  expect(h.deps.send).toHaveBeenCalledTimes(1);
});
it('caches setup choices and task facts across replies and persists choices', async () => {
  const context = vi.fn(async () => ({ topic: 'gardens', purpose: 'learn' }));
  const task = vi.fn(async () => undefined);
  const h = harness(state(), { context, task });
  await h.campaign.check();
  task.mockClear();
  for (let i = 0; i < 3; i++)
    expect(await h.campaign.replyContext()).toContain('gardens');
  expect(context).toHaveBeenCalledTimes(1);
  expect(task).not.toHaveBeenCalled();
  await createCampaign(h.deps).replyContext();
  expect(context).toHaveBeenCalledTimes(1);
});
it('records an offer only once across both successful-send observers', async () => {
  const h = harness();
  await h.campaign.observeReply(RECURRING_OFFER, '~ten');
  h.advance(MINUTE);
  await h.campaign.observeReply(RECURRING_OFFER, '~ten');
  expect(h.store.save).toHaveBeenCalledTimes(1);
  expect(h.read().offeredAt).toBe(enrolledAt + DAY);
});
it('uses copy overrides within the single campaign direction', () => {
  expect(
    renderTip('useful-request', state({ topic: 'gardens' }), {
      copy: { 'useful-request': 'What about {topic}?' },
    })
  ).toContain('What about gardens?');
});
it('applies spacing and quiet hours to scheduled feedback', () => {
  const task = {
    id: 'task',
    name: 'Digest',
    enabled: true,
    deliveredAt: enrolledAt + DAY,
  };
  const current = state({
    status: 'feedback',
    sent: [{ step: 'useful-request', at: enrolledAt + DAY }],
  });
  expect(
    evaluateCampaign(
      current,
      { ...facts, task, hasTask: true },
      enrolledAt + DAY + MINUTE
    )
  ).toMatchObject({ kind: 'defer', reason: 'spacing' });
  expect(
    evaluateCampaign(
      current,
      { ...facts, task, hasTask: true },
      enrolledAt + 2 * DAY
    )
  ).toEqual({ kind: 'send', step: 'task-feedback' });
  expect(
    evaluateCampaign(
      current,
      { ...facts, task, hasTask: true },
      Date.parse('2026-09-20T03:00:00Z')
    )
  ).toMatchObject({ kind: 'defer', reason: 'quiet-hours' });
});

it.each([
  ['20:44', 'usual-activity-time'],
  ['20:45', undefined],
  ['20:52', undefined],
  ['20:59', undefined],
  ['21:00', 'quiet-hours'],
])('handles late activity preferences at the %s check', (time, reason) => {
  const current = state({ timezone: 'Etc/UTC', activityMinute: 20 * 60 + 59 });
  const decision = evaluateCampaign(
    current,
    facts,
    Date.parse(`2026-09-18T${time}:00Z`)
  );
  expect(decision).toEqual(
    reason
      ? { kind: 'defer', reason }
      : { kind: 'send', step: 'useful-request' }
  );
});

it('allows a late-evening enrollee to receive the first tip before its window expires', () => {
  const current = state({
    timezone: 'Etc/UTC',
    enrolledAt: Date.parse('2026-09-17T20:50:00Z'),
  });
  // The previous day's final check was still less than 24 hours after enrollment.
  expect(
    evaluateCampaign(current, facts, Date.parse('2026-09-19T20:45:00Z'))
  ).toEqual({ kind: 'send', step: 'useful-request' });
});

it('records a verified group offer before the first tip and suppresses the later prompt', async () => {
  const channel = 'chat/~zod/setup';
  const h = harness(state({ channelId: channel }), {
    destination: async () => channel,
  });
  h.setTime(enrolledAt + MINUTE);
  await h.campaign.check();
  expect(h.read().destination).toBeUndefined();
  expect(await h.campaign.replyContext(channel)).toContain(RECURRING_OFFER);
  await h.campaign.observeReply(RECURRING_OFFER, channel);
  expect(h.read().offeredAt).toBe(enrolledAt + MINUTE);
  h.setTime(enrolledAt + 2 * DAY);
  await h.campaign.check();
  expect(h.read().skipped).toContainEqual({
    step: 'recurring-help',
    reason: 'already-offered',
  });
  expect(h.deps.send).not.toHaveBeenCalled();
});

it('does not record a group offer when its route now falls back to DM', async () => {
  const channel = 'chat/~zod/setup';
  const h = harness(state({ destination: channel }), {
    destination: async () => '~ten',
  });
  await h.campaign.observeReply(RECURRING_OFFER, channel);
  expect(h.read().offeredAt).toBeUndefined();
});
