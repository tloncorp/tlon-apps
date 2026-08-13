import { describe, expect, it } from 'vitest';

import {
  canClaimAgentOnboardingLanding,
  claimAgentOnboardingLanding,
  shouldAcknowledgeAgentOnboardingLanding,
} from './agentOnboardingLanding';

const landing = {
  groupId: '~zod/home-group',
  channelId: 'chat/~zod/home-group-chat',
};

describe('agent onboarding landing lifecycle', () => {
  it('accepts pending and legacy landing values exactly once', () => {
    expect(canClaimAgentOnboardingLanding(landing)).toBe(true);
    expect(
      canClaimAgentOnboardingLanding({ ...landing, status: 'pending' })
    ).toBe(true);
    expect(
      canClaimAgentOnboardingLanding({ ...landing, status: 'claimed' })
    ).toBe(false);
  });

  it('marks a landing claimed before navigation resets', () => {
    expect(claimAgentOnboardingLanding(landing)).toEqual({
      ...landing,
      status: 'claimed',
    });
  });

  it('only acknowledges a claimed landing from its destination channel', () => {
    const claimed = claimAgentOnboardingLanding(landing);

    expect(
      shouldAcknowledgeAgentOnboardingLanding(claimed, landing.channelId)
    ).toBe(true);
    expect(
      shouldAcknowledgeAgentOnboardingLanding(claimed, 'chat/~zod/elsewhere')
    ).toBe(false);
    expect(
      shouldAcknowledgeAgentOnboardingLanding(landing, landing.channelId)
    ).toBe(false);
  });
});
