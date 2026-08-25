import * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import {
  AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
  findAgentGroupOnboardingStartupRoute,
  isAgentGroupNavigationLocked,
  isAnyAgentGroupNavigationLockedDurably,
} from './useAgentGroupOnboardingLock';

describe('findAgentGroupOnboardingStartupRoute', () => {
  it('restores only a locked first-group setup chat', () => {
    const now = 100_000;
    expect(
      findAgentGroupOnboardingStartupRoute(
        {
          later: {
            chatChannelId: 'chat/later',
            createdAt: now,
            navigationLocked: false,
          },
          first: {
            chatChannelId: 'chat/first',
            createdAt: now,
            navigationLocked: true,
          },
        },
        now
      )
    ).toEqual({ groupId: 'first', channelId: 'chat/first' });
  });

  it('does not restore acknowledged or channel-less locks', () => {
    const now = 100_000;
    expect(
      findAgentGroupOnboardingStartupRoute(
        {
          acknowledged: {
            chatChannelId: 'chat/first',
            createdAt: now,
            navigationLocked: true,
            provisionAcknowledgedAt: 2,
          },
          channelLess: { createdAt: now, navigationLocked: true },
        },
        now
      )
    ).toBeNull();
  });
});

describe('isAgentGroupNavigationLocked', () => {
  const now = 100_000;

  it('locks an active first-group marker', () => {
    expect(
      isAgentGroupNavigationLocked(
        { createdAt: now, navigationLocked: true },
        now
      )
    ).toBe(true);
  });

  it('does not lock later Tlonbot groups', () => {
    expect(
      isAgentGroupNavigationLocked(
        { createdAt: now, navigationLocked: false },
        now
      )
    ).toBe(false);
  });

  it('unlocks the first group after provisioning is acknowledged', () => {
    expect(
      isAgentGroupNavigationLocked(
        {
          createdAt: now,
          navigationLocked: true,
          provisionAcknowledgedAt: 1,
        },
        now
      )
    ).toBe(false);
  });

  it('unlocks when the 30-second failsafe expires', () => {
    const marker = { createdAt: now, navigationLocked: true };
    expect(
      isAgentGroupNavigationLocked(
        marker,
        now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS - 1
      )
    ).toBe(true);
    expect(
      isAgentGroupNavigationLocked(
        marker,
        now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS
      )
    ).toBe(false);
  });
});

describe('isAnyAgentGroupNavigationLockedDurably', () => {
  it('waits for pending storage writes before checking every group', async () => {
    const getValue = vi
      .spyOn(db.agentGroupOnboardingLocks, 'getValue')
      .mockResolvedValue({
        locked: { createdAt: Date.now(), navigationLocked: true },
      });

    await expect(isAnyAgentGroupNavigationLockedDurably()).resolves.toBe(true);
    expect(getValue).toHaveBeenCalledWith(true);

    getValue.mockRestore();
  });
});
