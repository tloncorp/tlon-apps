import { describe, expect, it } from 'vitest';

import { isAgentGroupNavigationLocked } from './useAgentGroupOnboardingLock';

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
