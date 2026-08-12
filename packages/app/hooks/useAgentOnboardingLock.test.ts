import { describe, expect, test } from 'vitest';

import { shouldLockAgentOnboarding } from './useAgentOnboardingLock';

describe('agent onboarding lock marker failures', () => {
  test('keeps a known guided group locked', () => {
    expect(
      shouldLockAgentOnboarding({
        groupId: '~zod/home-group',
        markerLoading: false,
        markerError: true,
        isKnownGuidedGroup: true,
        isOnboardingGroup: false,
        setupComplete: false,
      })
    ).toBe(true);
  });

  test('does not lock an unrelated group', () => {
    expect(
      shouldLockAgentOnboarding({
        groupId: '~zod/ordinary',
        markerLoading: false,
        markerError: true,
        isKnownGuidedGroup: false,
        isOnboardingGroup: false,
        setupComplete: false,
      })
    ).toBe(false);
  });
});
