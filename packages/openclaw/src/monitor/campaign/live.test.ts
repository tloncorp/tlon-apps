import { appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DAY, type CampaignState } from './model.js';
import {
  createLiveCampaign,
  isUserRecurringTask,
  notifyCampaignCronChanged,
} from './live.js';
import { type CampaignStore, setCampaignStore } from './store.js';

const mock = vi.hoisted(() => ({
  posts: vi.fn(),
  send: vi.fn(),
  list: vi.fn(),
  scoped: vi.fn(),
}));
vi.mock('@tloncorp/api', async (original) => ({
  ...(await original<typeof import('@tloncorp/api')>()),
  getChannelPosts: mock.posts,
}));
vi.mock('../../urbit/send.js', () => ({ sendDm: mock.send }));
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
    register: async (_key: string, value: CampaignState) => {
      row = structuredClone(value);
    },
  } as CampaignStore);
  mock.posts.mockResolvedValue({ posts: [] });
  mock.send.mockResolvedValue({ messageId: '~zod/123', sentAt: now });
  mock.list.mockResolvedValue([]);
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
  expect(mock.scoped).toHaveBeenCalledTimes(2);
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
  expect(row.sent).toEqual([{ step: 'useful-request', at: now - 1000 }]);
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
  expect(row.status).toBe('converted');
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
