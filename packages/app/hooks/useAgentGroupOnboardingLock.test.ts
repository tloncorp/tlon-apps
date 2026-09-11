import * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import {
  AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
  findAgentGroupOnboardingStartupRoute,
  isAgentGroupNavigationLocked,
  isAnyAgentGroupNavigationLockedDurably,
  startAgentGroupNavigationLockFailsafe,
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
          },
          first: {
            chatChannelId: 'chat/first',
            createdAt: now,
            navigationLockExpiresAt:
              now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
          },
        },
        now
      )
    ).toEqual({ groupId: 'first', channelId: 'chat/first' });
  });

  it('does not restore acknowledged or channel-less locks', () => {
    const now = 100_000;
    const navigationLockExpiresAt =
      now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS;
    expect(
      findAgentGroupOnboardingStartupRoute(
        {
          acknowledged: {
            chatChannelId: 'chat/first',
            createdAt: now,
            navigationLockExpiresAt,
            provisionAcknowledgedAt: 2,
          },
          channelLess: { createdAt: now, navigationLockExpiresAt },
        },
        now
      )
    ).toBeNull();
  });
});

describe('isAgentGroupNavigationLocked', () => {
  const now = 100_000;

  it('locks an armed first-group marker until its deadline', () => {
    const marker = {
      navigationLockExpiresAt: now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
    };
    expect(isAgentGroupNavigationLocked(marker, now)).toBe(true);
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

  it('does not lock markers that never armed (later Tlonbot groups)', () => {
    expect(isAgentGroupNavigationLocked({}, now)).toBe(false);
    expect(isAgentGroupNavigationLocked(undefined, now)).toBe(false);
  });

  it('unlocks the first group after provisioning is acknowledged', () => {
    expect(
      isAgentGroupNavigationLocked(
        {
          navigationLockExpiresAt:
            now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
          provisionAcknowledgedAt: 1,
        },
        now
      )
    ).toBe(false);
  });
});

describe('startAgentGroupNavigationLockFailsafe', () => {
  it('re-arms a full window only for markers that armed a lock', async () => {
    const now = 100_000;
    let stored: Record<string, db.AgentGroupOnboardingLock> = {
      // Furnishing outlived the window armed at creation.
      first: { createdAt: 0, navigationLockExpiresAt: 1 },
      later: { createdAt: 0 },
    };
    const setValue = vi
      .spyOn(db.agentGroupOnboardingLocks, 'setValue')
      .mockImplementation(async (update) => {
        stored = (update as (current: typeof stored) => typeof stored)(stored);
      });

    await startAgentGroupNavigationLockFailsafe('first', now);
    await startAgentGroupNavigationLockFailsafe('later', now);
    await startAgentGroupNavigationLockFailsafe('absent', now);

    expect(stored.first.navigationLockExpiresAt).toBe(
      now + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS
    );
    expect(stored.later.navigationLockExpiresAt).toBeUndefined();
    expect(stored.absent).toBeUndefined();

    setValue.mockRestore();
  });
});

describe('isAnyAgentGroupNavigationLockedDurably', () => {
  it('waits for pending storage writes before checking every group', async () => {
    const getValue = vi
      .spyOn(db.agentGroupOnboardingLocks, 'getValue')
      .mockResolvedValue({
        locked: {
          createdAt: Date.now(),
          navigationLockExpiresAt:
            Date.now() + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
        },
      });

    await expect(isAnyAgentGroupNavigationLockedDurably()).resolves.toBe(true);
    expect(getValue).toHaveBeenCalledWith(true);

    getValue.mockRestore();
  });
});
