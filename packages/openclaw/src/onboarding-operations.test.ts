import { afterEach, describe, expect, test } from 'vitest';

import {
  armOnboardingResearchSession,
  clearOnboardingOperations,
  disarmOnboardingResearchForNest,
  disarmOnboardingResearchSession,
  isOnboardingResearchSession,
  registerOnboardingDraftHandler,
  submitOnboardingDraft,
} from './onboarding-operations.js';

afterEach(() => clearOnboardingOperations());

describe('onboarding research boundary', () => {
  test('stays armed through draft submission until the agent turn ends', async () => {
    armOnboardingResearchSession('chat/~zod/home', 'agent:main:tlon');
    const unregister = registerOnboardingDraftHandler(
      'chat/~zod/home',
      async () => ({ ok: true, message: 'accepted' })
    );

    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(true);
    await expect(
      submitOnboardingDraft({
        nest: 'chat/~zod/home',
        title: 'Today',
        markdown: 'Draft',
      })
    ).resolves.toEqual({ ok: true, message: 'accepted' });
    unregister();
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(true);

    disarmOnboardingResearchSession('agent:main:tlon');
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(false);
  });

  test('can release a timed-out turn by nest', () => {
    armOnboardingResearchSession('chat/~zod/home', 'agent:main:tlon');
    disarmOnboardingResearchForNest('chat/~zod/home');
    expect(isOnboardingResearchSession('agent:main:tlon')).toBe(false);
  });
});
