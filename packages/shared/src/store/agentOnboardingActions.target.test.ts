import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  _testing,
  ensureAgentNotebookForGroup,
  getHomeGroupOnboardingTarget,
  resolveHomeGroupOnboarding,
} from './agentOnboardingActions';

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(() => '~zod'),
  getLocalGroup: vi.fn(),
  getRemoteGroup: vi.fn(),
  getChannelPosts: vi.fn(),
  getHostingBotEnabled: vi.fn(),
  createChannel: vi.fn(),
  hydrateExistingNotesChannel: vi.fn(),
  syncNotesNotebook: vi.fn(async () => undefined),
}));

vi.mock('@tloncorp/api', () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getGroup: mocks.getRemoteGroup,
  getChannelPosts: mocks.getChannelPosts,
  parseNotesChannelId: (id: string | undefined) =>
    id?.startsWith('notes/') ? id.slice('notes/'.length) : null,
}));

vi.mock('../db', () => ({
  getGroup: mocks.getLocalGroup,
  hostingBotEnabled: { getValue: mocks.getHostingBotEnabled },
}));

vi.mock('../debug', () => ({
  createDevLogger: () => ({ trackEvent: vi.fn(), trackError: vi.fn() }),
}));

vi.mock('./channelActions', () => ({
  createChannel: mocks.createChannel,
  hydrateExistingNotesChannel: mocks.hydrateExistingNotesChannel,
}));

vi.mock('./groupActions', () => ({ createDefaultGroup: vi.fn() }));
vi.mock('./notesActions', () => ({
  syncNotesNotebook: mocks.syncNotesNotebook,
}));

const homeGroup = (channelId = 'chat/~zod/home-group-chat') => ({
  id: '~zod/home-group',
  currentUserIsMember: true,
  channels: [{ id: channelId, type: 'chat' }],
});

const deterministicDescription = (
  title: string,
  state: 'awaiting-notebook' | 'complete' = 'awaiting-notebook'
) =>
  JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      templateId: 'agent-daily-digest',
      purpose: 'Watch updates',
      instructions: '',
      agents: ['~bot'],
      jobs: [{ title }],
      onboarding: {
        state,
        topics: 'Updates',
        timezone: 'UTC',
        cronJobId: 'cron-1',
      },
      updatedAt: 1,
    },
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLocalGroup.mockResolvedValue(null);
  mocks.getHostingBotEnabled.mockResolvedValue(true);
  mocks.getChannelPosts.mockResolvedValue({ posts: [] });
});

afterEach(() => {
  _testing.clearAgentNotebookRetries();
  vi.useRealTimers();
});

describe('getHomeGroupOnboardingTarget', () => {
  test('uses a ship-verified home-group channel', async () => {
    mocks.getLocalGroup.mockResolvedValue(homeGroup());
    mocks.getRemoteGroup.mockResolvedValue(homeGroup());

    await expect(getHomeGroupOnboardingTarget()).resolves.toEqual({
      groupId: '~zod/home-group',
      channelId: 'chat/~zod/home-group-chat',
    });
    expect(mocks.getRemoteGroup).toHaveBeenCalledWith('~zod/home-group');
  });

  test('accepts a ship-visible channel while local sync trails', async () => {
    mocks.getRemoteGroup.mockResolvedValue(homeGroup());

    await expect(getHomeGroupOnboardingTarget()).resolves.toEqual({
      groupId: '~zod/home-group',
      channelId: 'chat/~zod/home-group-chat',
    });
    expect(mocks.getRemoteGroup).toHaveBeenCalledWith('~zod/home-group');
  });

  test('does not invent a landing target for a missing home group', async () => {
    mocks.getRemoteGroup.mockRejectedValue(new Error('not provisioned'));

    await expect(getHomeGroupOnboardingTarget()).resolves.toBeNull();
    await expect(resolveHomeGroupOnboarding()).resolves.toEqual({
      status: 'pending',
    });
  });

  test('rejects a configured or owner-used home group', async () => {
    mocks.getRemoteGroup.mockResolvedValueOnce({
      ...homeGroup(),
      description: deterministicDescription(
        'Daily digest: Updates',
        'complete'
      ),
    });
    await expect(getHomeGroupOnboardingTarget()).resolves.toBeNull();

    mocks.getRemoteGroup.mockResolvedValueOnce({
      ...homeGroup(),
      description: deterministicDescription(
        'Daily digest: Updates',
        'complete'
      ),
    });
    await expect(resolveHomeGroupOnboarding()).resolves.toEqual({
      status: 'fallback',
    });

    mocks.getRemoteGroup.mockResolvedValueOnce(homeGroup());
    mocks.getChannelPosts.mockResolvedValueOnce({
      posts: [{ authorId: '~zod' }],
    });
    await expect(getHomeGroupOnboardingTarget()).resolves.toBeNull();
    expect(mocks.getChannelPosts).toHaveBeenCalledWith({
      channelId: 'chat/~zod/home-group-chat',
      mode: 'newest',
      count: 20,
    });
  });
});

test('schedules another notebook reconciliation after the bounded window', async () => {
  vi.useFakeTimers();
  const description = deterministicDescription('Daily digest: Updates');
  mocks.getRemoteGroup
    .mockRejectedValueOnce(new Error('outage 1'))
    .mockRejectedValueOnce(new Error('outage 2'))
    .mockRejectedValueOnce(new Error('outage 3'))
    .mockRejectedValueOnce(new Error('outage 4'))
    .mockResolvedValue({
      id: '~zod/retry-later',
      description,
      currentUserIsMember: true,
      channels: [],
    });
  mocks.createChannel.mockResolvedValue({
    id: 'notes/~zod/retry-later/notebook',
  });

  const ensuring = ensureAgentNotebookForGroup({
    id: '~zod/retry-later',
    description,
    channels: [],
  });
  await vi.advanceTimersByTimeAsync(22_000);
  await ensuring;
  expect(mocks.createChannel).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(60_000);
  await vi.runAllTicks();

  expect(mocks.getRemoteGroup).toHaveBeenCalledTimes(6);
  expect(mocks.createChannel).toHaveBeenCalledTimes(1);
});

test('retains notebook retry debt for a completed group replacement', async () => {
  vi.useFakeTimers();
  const description = deterministicDescription(
    'Daily digest: Updates',
    'complete'
  );
  mocks.getRemoteGroup
    .mockRejectedValueOnce(new Error('outage 1'))
    .mockRejectedValueOnce(new Error('outage 2'))
    .mockRejectedValueOnce(new Error('outage 3'))
    .mockRejectedValueOnce(new Error('outage 4'))
    .mockResolvedValue({
      id: '~zod/complete-retry',
      description,
      currentUserIsMember: true,
      channels: [],
    });
  mocks.createChannel.mockResolvedValue({
    id: 'notes/~zod/complete-retry/notebook',
  });

  const ensuring = ensureAgentNotebookForGroup({
    id: '~zod/complete-retry',
    description,
    channels: [],
  });
  await vi.advanceTimersByTimeAsync(22_000);
  await ensuring;
  await vi.advanceTimersByTimeAsync(60_000);
  await vi.runAllTicks();

  expect(mocks.createChannel).toHaveBeenCalledTimes(1);
});

test('drops notebook retry debt after the group disappears locally', async () => {
  vi.useFakeTimers();
  const description = deterministicDescription('Daily digest: Updates');
  mocks.getRemoteGroup.mockRejectedValue(new Error('group missing'));
  mocks.getLocalGroup.mockResolvedValue(null);

  const ensuring = ensureAgentNotebookForGroup({
    id: '~zod/deleted',
    description,
    channels: [],
  });
  await vi.advanceTimersByTimeAsync(22_000);
  await ensuring;
  await vi.advanceTimersByTimeAsync(60_000);
  await vi.advanceTimersByTimeAsync(180_000);

  expect(mocks.getRemoteGroup).toHaveBeenCalledTimes(5);
  expect(mocks.getLocalGroup).toHaveBeenCalledWith({ id: '~zod/deleted' });
});

test('retains notebook retry debt while remote verification is unreadable', async () => {
  vi.useFakeTimers();
  mocks.createChannel
    .mockRejectedValueOnce(new Error('ambiguous create'))
    .mockResolvedValueOnce({ id: 'notes/~zod/retry/notebook' });
  mocks.getRemoteGroup
    .mockRejectedValueOnce(new Error('temporary scry failure'))
    .mockResolvedValueOnce({
      id: '~zod/retry',
      currentUserIsMember: true,
      channels: [],
    })
    .mockResolvedValueOnce({
      id: '~zod/retry',
      currentUserIsMember: true,
      channels: [],
    });

  const ensuring = ensureAgentNotebookForGroup({
    id: '~zod/retry',
    description: deterministicDescription('Daily digest: Updates'),
    channels: [],
  });
  await vi.runAllTimersAsync();
  await ensuring;

  expect(mocks.getRemoteGroup).toHaveBeenCalledTimes(3);
  expect(mocks.createChannel).toHaveBeenCalledTimes(2);
});

test('adopts a remotely existing notebook before the first create', async () => {
  const remote = {
    id: '~zod/existing',
    channels: [{ id: 'notes/~zod/daily', type: 'notes' }],
  };
  mocks.getRemoteGroup.mockResolvedValue(remote);
  mocks.hydrateExistingNotesChannel.mockResolvedValue(remote.channels[0]);

  await ensureAgentNotebookForGroup({
    id: '~zod/existing',
    description: deterministicDescription('Daily digest: Updates'),
    channels: [],
  });

  expect(mocks.hydrateExistingNotesChannel).toHaveBeenCalledWith(remote);
  expect(mocks.createChannel).not.toHaveBeenCalled();
});

test('does not provision a notebook for a legacy config', async () => {
  await ensureAgentNotebookForGroup({
    id: '~zod/legacy',
    description: JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        purpose: 'Watch updates',
        instructions: '',
        agents: ['~bot'],
        jobs: [{ title: 'Daily digest: Updates' }],
        updatedAt: 1,
      },
    ]),
    channels: [],
  });

  expect(mocks.getRemoteGroup).not.toHaveBeenCalled();
  expect(mocks.createChannel).not.toHaveBeenCalled();
});
