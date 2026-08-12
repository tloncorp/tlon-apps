import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  ensureAgentNotebookForGroup,
  getHomeGroupOnboardingTarget,
} from './agentOnboardingActions';

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(() => '~zod'),
  getLocalGroup: vi.fn(),
  getRemoteGroup: vi.fn(),
  getHostingBotEnabled: vi.fn(),
  createChannel: vi.fn(),
  hydrateExistingNotesChannel: vi.fn(),
  syncNotesNotebook: vi.fn(async () => undefined),
}));

vi.mock('@tloncorp/api', () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getGroup: mocks.getRemoteGroup,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLocalGroup.mockResolvedValue(null);
  mocks.getHostingBotEnabled.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getHomeGroupOnboardingTarget', () => {
  test('uses a synced local home-group channel', async () => {
    mocks.getLocalGroup.mockResolvedValue(homeGroup());

    await expect(getHomeGroupOnboardingTarget()).resolves.toEqual({
      groupId: '~zod/home-group',
      channelId: 'chat/~zod/home-group-chat',
    });
    expect(mocks.getRemoteGroup).not.toHaveBeenCalled();
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
  });
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

  expect(mocks.hydrateExistingNotesChannel).toHaveBeenCalledWith(remote);
  expect(mocks.createChannel).not.toHaveBeenCalled();
});
