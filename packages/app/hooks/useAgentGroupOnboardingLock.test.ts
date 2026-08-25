import * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import {
  isAgentGroupNavigationLocked,
  isAnyAgentGroupNavigationLockedDurably,
} from './useAgentGroupOnboardingLock';

describe('isAgentGroupNavigationLocked', () => {
  it('keeps legacy and explicit first-group markers locked', () => {
    expect(isAgentGroupNavigationLocked({})).toBe(true);
    expect(isAgentGroupNavigationLocked({ navigationLocked: true })).toBe(true);
  });

  it('does not lock later Tlonbot groups', () => {
    expect(isAgentGroupNavigationLocked({ navigationLocked: false })).toBe(
      false
    );
  });

  it('unlocks the first group after provisioning is acknowledged', () => {
    expect(
      isAgentGroupNavigationLocked({
        navigationLocked: true,
        provisionAcknowledgedAt: 1,
      })
    ).toBe(false);
  });
});

describe('isAnyAgentGroupNavigationLockedDurably', () => {
  it('waits for pending storage writes before checking every group', async () => {
    const getValue = vi
      .spyOn(db.agentGroupOnboardingLocks, 'getValue')
      .mockResolvedValue({
        locked: { createdAt: 1, navigationLocked: true },
      });

    await expect(isAnyAgentGroupNavigationLockedDurably()).resolves.toBe(true);
    expect(getValue).toHaveBeenCalledWith(true);

    getValue.mockRestore();
  });
});
