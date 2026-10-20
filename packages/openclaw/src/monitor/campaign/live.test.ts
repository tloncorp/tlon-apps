import { appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ALL_ONLY } from '../../urbit/story.js';
import { DAY, type CampaignState } from './model.js';
import {
  createLiveCampaign,
  isUserRecurringTask,
  notifyCampaignCronChanged,
  resolveCampaignConfig,
} from './live.js';
import { type CampaignStore, setCampaignStore } from './store.js';

const mock = vi.hoisted(() => ({
  posts: vi.fn(),
  send: vi.fn(),
  list: vi.fn(),
  scoped: vi.fn(),
  group: vi.fn(),
  sendChannel: vi.fn(),
  personalize: vi.fn(),
  scopeFor: vi.fn(),
}));
vi.mock('./personalize.js', () => ({ personalizeTip: mock.personalize }));
vi.mock('../../role-mention-scope.js', () => ({
  roleMentionScopeFor: mock.scopeFor,
}));
vi.mock('@tloncorp/api', async (original) => ({
  ...(await original<typeof import('@tloncorp/api')>()),
  getChannelPosts: mock.posts,
  getGroup: mock.group,
}));
vi.mock('../../urbit/send.js', () => ({
  sendDm: mock.send,
  sendChannelPost: mock.sendChannel,
}));
vi.mock('../../cron-telemetry.js', () => ({
  getTlonCronService: () => ({ list: mock.list }),
}));
vi.mock('../../urbit/api-client.js', () => ({
  captureTlonApiScope: () => (fn: () => Promise<unknown>) => {
    mock.scoped();
    return fn();
  },
}));
const now = Date.parse('2026-09-18T15:37:00Z');
let row: CampaignState;
let campaign: ReturnType<typeof createLiveCampaign>;
const cfg = {
  channels: {
    tlon: {
      ship: '~zod',
      url: 'http://localhost',
      code: 'code',
      ownerShip: '~ten',
      onboardingCampaign: {
        enabled: true,
        enrollAfter: '2026-09-17T00:00:00Z',
      },
    },
  },
} as unknown as OpenClawConfig;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  row = {
    owner: '~ten',
    enrolledAt: now - DAY,
    version: 1,
    timezone: 'America/New_York',
    status: 'active',
    sent: [],
    skipped: [],
  };
  setCampaignStore({
    lookup: async () => structuredClone(row),
    save: async (value: CampaignState) => {
      row = structuredClone(value);
    },
  } as CampaignStore);
  mock.group.mockResolvedValue({
    privacy: 'private',
    members: [{ contactId: '~ten', status: 'joined' }, { contactId: '~zod' }],
    channels: [{ id: 'chat/~zod/setup' }],
  });
  mock.posts.mockResolvedValue({ posts: [] });
  mock.send.mockResolvedValue({ messageId: '~zod/123', sentAt: now });
  mock.list.mockResolvedValue([]);
  mock.personalize.mockResolvedValue(undefined);
  mock.scopeFor.mockResolvedValue({ roleIds: new Set(['admin']) });
  campaign = createLiveCampaign({
    accountId: 'default',
    owner: '~ten',
    bot: '~zod',
    config: () => cfg,
    botProfile: () => undefined,
    busy: () => false,
    error: (e) => {
      throw e;
    },
  });
});
afterEach(async () => {
  await campaign.stop();
  setCampaignStore(null);
  vi.useRealTimers();
});

it('couples the accelerated campaign only to the onboarding QA deployment config', () => {
  const disabled = structuredClone(cfg) as OpenClawConfig;
  (
    disabled.channels!.tlon as {
      onboardingCampaign: { enabled: boolean };
    }
  ).onboardingCampaign.enabled = false;
  expect(resolveCampaignConfig(disabled, 'onboarding-qa-stack')).toMatchObject({
    enabled: true,
    enrollAfter: '2026-09-17T00:00:00Z',
    testing: {
      intervalMinutes: 60,
      ignoreLocalDeliveryWindow: true,
    },
  });
  expect(resolveCampaignConfig(disabled, 'production')).toEqual({
    enabled: false,
    enrollAfter: '2026-09-17T00:00:00Z',
  });
  const unconfigured = structuredClone(cfg) as OpenClawConfig;
  delete (
    unconfigured.channels!.tlon as {
      onboardingCampaign?: unknown;
    }
  ).onboardingCampaign;
  expect(
    resolveCampaignConfig(unconfigured, 'onboarding-qa-stack')
  ).toMatchObject({
    enabled: true,
    enrollAfter: '2026-09-25T00:00:00Z',
    testing: { intervalMinutes: 60 },
  });
});

it('is on with production timing unless a config switches it off', () => {
  const unconfigured = structuredClone(cfg) as OpenClawConfig;
  delete (
    unconfigured.channels!.tlon as {
      onboardingCampaign?: unknown;
    }
  ).onboardingCampaign;
  expect(resolveCampaignConfig(unconfigured, 'production')).toEqual({
    enabled: true,
  });
});

it('sends a marked DM to the owner through the captured account scope', async () => {
  await campaign.check();
  expect(mock.posts).toHaveBeenCalledWith({
    channelId: '~ten',
    mode: 'newest',
    count: 50,
  });
  expect(mock.send).toHaveBeenCalledWith(
    expect.objectContaining({
      fromShip: '~zod',
      toShip: '~ten',
      text: expect.stringContaining('stop these tips'),
    })
  );
  const blob = mock.send.mock.calls[0][0].blob;
  expect(parsePostBlob(blob)).toContainEqual({
    type: 'tlon-agent-post-marker',
    version: 1,
    key: 'campaign-v1-useful-request',
  });
  expect(mock.scoped).toHaveBeenCalled();
  // A tip as written never gains role mentions.
  expect(mock.send.mock.calls[0][0].roleMentions).toBeUndefined();
});
it('lets a personalized DM tip mention @all only', async () => {
  mock.personalize.mockResolvedValue('Ping @all or @admin about it.');
  await campaign.check();
  expect(mock.send).toHaveBeenCalledWith(
    expect.objectContaining({
      text: expect.stringContaining('Ping @all or @admin'),
      roleMentions: ALL_ONLY,
    })
  );
  expect(mock.scopeFor).not.toHaveBeenCalled();
});
it('resolves the channel scope for a personalized tip only', async () => {
  row.groupId = '~zod/setup';
  row.channelId = 'chat/~zod/setup';
  mock.personalize.mockResolvedValue('Ask @admin.');
  await campaign.check();
  expect(mock.scopeFor).toHaveBeenCalledWith(
    'default',
    { kind: 'channel', nest: 'chat/~zod/setup' },
    expect.stringContaining('Ask @admin.')
  );
  expect(mock.sendChannel.mock.calls[0][0].story[0]).toEqual({
    inline: ['Ask ', { sect: 'admin' }, '.'],
  });

  // The deterministic tip that follows stays literal, with no lookup.
  mock.personalize.mockResolvedValue(undefined);
  mock.scopeFor.mockClear();
  vi.setSystemTime(now + DAY);
  await campaign.check();
  expect(mock.sendChannel).toHaveBeenCalledTimes(2);
  expect(mock.scopeFor).not.toHaveBeenCalled();
  expect(JSON.stringify(mock.sendChannel.mock.calls[1][0].story)).not.toContain(
    'sect'
  );
});
it('recovers only a marker authored by the bot in the owner DM', async () => {
  const blob = appendToPostBlob(undefined, {
    type: 'tlon-agent-post-marker',
    version: 1,
    key: 'campaign-v1-useful-request',
  });
  mock.posts.mockResolvedValue({
    posts: [{ authorId: '~zod', blob, sentAt: now - 1000 }],
  });
  await campaign.check();
  expect(mock.send).not.toHaveBeenCalled();
  expect(row.sent).toEqual([
    expect.objectContaining({ step: 'useful-request', at: now - 1000 }),
  ]);
});
it('ignores markers supplied by a user', async () => {
  const blob = appendToPostBlob(undefined, {
    type: 'tlon-agent-post-marker',
    version: 1,
    key: 'campaign-v1-useful-request',
  });
  mock.posts.mockResolvedValue({
    posts: [{ authorId: '~ten', blob, sentAt: now - 1000 }],
  });
  await campaign.check();
  expect(mock.send).toHaveBeenCalledTimes(1);
});
it('stops on task events even if the task is removed before a scheduler query', async () => {
  row.enrolledAt = now;
  campaign.start();
  await campaign.check();
  notifyCampaignCronChanged({
    action: 'added',
    jobId: 'task-1',
    job: {
      id: 'task-1',
      schedule: { kind: 'every', everyMs: DAY },
      payload: { kind: 'agentTurn' },
    },
  });
  await campaign.check();
  expect(row.status).toBe('feedback');
  expect(mock.send).not.toHaveBeenCalled();
});
it('recognizes disabled user tasks but excludes one-shot and internal heartbeat jobs', () => {
  expect(
    isUserRecurringTask({
      id: 'one',
      enabled: false,
      schedule: { kind: 'every', everyMs: DAY },
    })
  ).toBe(true);
  expect(isUserRecurringTask({ id: 'once', schedule: { kind: 'at' } })).toBe(
    false
  );
  expect(
    isUserRecurringTask({
      id: 'heartbeat',
      schedule: { kind: 'every' },
      payload: { kind: 'heartbeat' },
    })
  ).toBe(false);
});
it('honors a changed kill switch before delivery', async () => {
  mock.posts.mockImplementationOnce(async () => {
    (
      cfg.channels!.tlon as { onboardingCampaign: { enabled: boolean } }
    ).onboardingCampaign.enabled = false;
    return { posts: [] };
  });
  try {
    await campaign.check();
    expect(mock.send).not.toHaveBeenCalled();
  } finally {
    (
      cfg.channels!.tlon as { onboardingCampaign: { enabled: boolean } }
    ).onboardingCampaign.enabled = true;
  }
});

it('uses the private onboarding conversation, but falls back permanently when someone else is invited', async () => {
  row.groupId = '~zod/setup';
  row.channelId = 'chat/~zod/setup';
  await campaign.check();
  expect(mock.sendChannel).toHaveBeenCalledWith(
    expect.objectContaining({ nest: 'chat/~zod/setup' })
  );
  expect(mock.send).not.toHaveBeenCalled();
  mock.group.mockResolvedValue({
    privacy: 'private',
    members: [
      { contactId: '~ten', status: 'joined' },
      { contactId: '~zod' },
      { contactId: '~mug', status: 'invited' },
    ],
  });
  vi.setSystemTime(now + DAY);
  await campaign.check();
  expect(row.destination).toBe('~ten');
  expect(mock.send).toHaveBeenCalledTimes(1);
  mock.group.mockResolvedValue({
    privacy: 'private',
    members: [{ contactId: '~ten', status: 'joined' }, { contactId: '~zod' }],
  });
  vi.setSystemTime(now + 2 * DAY);
  await campaign.check();
  expect(row.destination).toBe('~ten');
});
it('falls back permanently when the onboarding channel no longer exists', async () => {
  row.groupId = '~zod/setup';
  row.channelId = 'chat/~zod/setup';
  mock.group.mockResolvedValue({
    privacy: 'private',
    members: [{ contactId: '~ten', status: 'joined' }, { contactId: '~zod' }],
    channels: [{ id: 'chat/~zod/replacement' }],
  });
  await campaign.check();
  expect(row.destination).toBe('~ten');
  expect(mock.send).toHaveBeenCalledTimes(1);
  expect(mock.sendChannel).not.toHaveBeenCalled();
});
it('fails closed when group privacy cannot be verified', async () => {
  row.groupId = '~zod/setup';
  row.channelId = 'chat/~zod/setup';
  mock.group.mockRejectedValue(new Error('unavailable'));
  await expect(campaign.check()).rejects.toThrow('unavailable');
  expect(mock.send).not.toHaveBeenCalled();
  expect(mock.sendChannel).not.toHaveBeenCalled();
});

it('sends verified-result feedback on a regular check without presence', async () => {
  mock.list.mockResolvedValue([
    {
      id: 'task',
      name: 'Digest',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 8 * * *' },
      state: {
        lastRunStatus: 'ok',
        lastDelivered: true,
        lastRunAtMs: now - 1000,
      },
    },
  ]);
  await campaign.check();
  expect(row.sent.at(-1)?.step).toBe('task-feedback');
  expect(mock.send).toHaveBeenCalledWith(
    expect.objectContaining({ text: expect.stringContaining('Digest') })
  );
  await campaign.check();
  expect(mock.send).toHaveBeenCalledTimes(1);
});

it('does not call a run that chose to say nothing a failure', async () => {
  // How core reports a task with nothing to tell the owner this time.
  mock.list.mockResolvedValue([
    {
      id: 'task',
      name: 'Landlord watch',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 18 * * *' },
      state: {
        lastRunStatus: 'ok',
        lastDelivered: false,
        lastDeliveryStatus: 'not-delivered',
        lastRunAtMs: now - 1000,
      },
    },
  ]);

  await campaign.check();

  expect(mock.send).not.toHaveBeenCalled();
});

it.each([
  [
    'the run errored',
    { lastRunStatus: 'error', lastError: 'model unavailable' },
  ],
  [
    'its result could not be delivered',
    {
      lastRunStatus: 'ok',
      lastDelivered: false,
      lastDeliveryStatus: 'not-delivered',
      lastDeliveryError: 'channel unavailable',
    },
  ],
])('reports a problem when %s', async (_name, state) => {
  mock.list.mockResolvedValue([
    {
      id: 'task',
      name: 'Digest',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 8 * * *' },
      state: { ...state, lastRunAtMs: now - 1000 },
    },
  ]);

  await campaign.check();

  expect(row.sent.at(-1)?.step).toBe('task-feedback');
  expect(mock.send).toHaveBeenCalledWith(
    expect.objectContaining({
      text: expect.stringContaining('Something went wrong with the last run'),
    })
  );
});

it.each(['history', 'privacy', 'send', 'cron'])(
  'stops promptly when aborted during %s I/O',
  async (operation) => {
    await campaign.stop();
    const abort = new AbortController();
    const errors = vi.fn();
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: (value: any) => void;
    const hanging = () => {
      entered();
      return new Promise<any>((resolve) => {
        release = resolve;
      });
    };
    if (operation === 'history') mock.posts.mockImplementationOnce(hanging);
    if (operation === 'privacy') {
      row.groupId = '~zod/setup';
      row.channelId = 'chat/~zod/setup';
      mock.group.mockImplementationOnce(hanging);
    }
    if (operation === 'send') mock.send.mockImplementationOnce(hanging);
    if (operation === 'cron') mock.list.mockImplementationOnce(hanging);
    campaign = createLiveCampaign({
      accountId: 'default',
      owner: '~ten',
      bot: '~zod',
      config: () => cfg,
      botProfile: () => undefined,
      busy: () => false,
      error: errors,
      signal: abort.signal,
    });
    const tick = campaign.check();
    await started;
    abort.abort();
    await campaign.stop();
    await tick;
    expect(row.sent).toHaveLength(0);
    if (operation !== 'send') expect(mock.send).not.toHaveBeenCalled();
    release(operation === 'cron' ? [] : { posts: [] });
    await Promise.resolve();
  }
);
