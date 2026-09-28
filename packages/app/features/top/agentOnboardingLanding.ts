import type { AgentOnboardingLanding } from '@tloncorp/shared/db';

export function canClaimAgentOnboardingLanding(
  landing: AgentOnboardingLanding | null
): landing is AgentOnboardingLanding {
  return (
    landing !== null &&
    (landing.status === undefined || landing.status === 'pending')
  );
}

export function claimAgentOnboardingLanding(
  landing: AgentOnboardingLanding
): AgentOnboardingLanding {
  return { ...landing, status: 'claimed' };
}

export function shouldAcknowledgeAgentOnboardingLanding(
  landing: AgentOnboardingLanding | null,
  channelId: string
) {
  return landing?.status === 'claimed' && landing.channelId === channelId;
}

export function shouldRestoreAgentOnboardingFallback(
  landing: AgentOnboardingLanding | null,
  channelId: string
) {
  return landing?.status === 'fallback' && landing.channelId === channelId;
}
