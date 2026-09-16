import { sharedMap } from './shared-state.js';

export type TlonSessionSurface = {
  kind: 'direct' | 'group';
  channelNest?: string;
  bootstrapComplete: boolean;
  timestamp: number;
};

const sessionSurfaces = sharedMap<string, TlonSessionSurface>(
  'onboarding-session-surfaces'
);
const SURFACE_TTL_MS = 60 * 60 * 1000;

export function setTlonSessionSurface(
  sessionKey: string,
  surface: Omit<TlonSessionSurface, 'timestamp'>
): void {
  const now = Date.now();
  for (const [key, entry] of sessionSurfaces) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      sessionSurfaces.delete(key);
    }
  }
  sessionSurfaces.set(sessionKey, { ...surface, timestamp: now });
}

export function getTlonSessionSurface(
  sessionKey: string | null | undefined
): TlonSessionSurface | undefined {
  const key = sessionKey?.trim();
  if (!key) return undefined;

  const lookup = (candidate: string) => {
    const entry = sessionSurfaces.get(candidate);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > SURFACE_TTL_MS) {
      sessionSurfaces.delete(candidate);
      return undefined;
    }
    return entry;
  };

  const direct = lookup(key);
  if (direct) return direct;
  const threadIndex = key.indexOf(':thread:');
  return threadIndex > 0 ? lookup(key.slice(0, threadIndex)) : undefined;
}

export function onboardingToolBlockReason(
  toolName: string,
  params: unknown,
  surface: TlonSessionSurface | undefined
): string | undefined {
  const isTypedOnboardingTool =
    toolName === 'tlon_agent_choice' || toolName === 'tlon_agent_task_plan';

  if (isTypedOnboardingTool) {
    if (surface?.kind !== 'group' || !surface.channelNest) {
      return (
        'Recurring-task onboarding is available only in the active Tlonbot ' +
        'group. Direct the owner to New Tlonbot group and stop.'
      );
    }
    const target =
      params && typeof params === 'object' && 'target' in params
        ? String((params as { target?: unknown }).target ?? '')
        : '';
    if (target !== surface.channelNest) {
      return 'The onboarding tool target must match the active group channel.';
    }
  }

  if (
    toolName === 'cron' &&
    surface?.kind === 'direct' &&
    !surface.bootstrapComplete
  ) {
    return (
      'First-run recurring-task provisioning is owned by the group ' +
      'coordinator. Direct the owner to New Tlonbot group and stop.'
    );
  }

  return undefined;
}

export const _testing = {
  clearAll: () => sessionSurfaces.clear(),
};
