import { sharedMap } from './shared-state.js';

export type TlonSessionSurface = {
  kind: 'direct' | 'group';
  channelNest?: string;
  bootstrapComplete: boolean;
  messageId?: string;
  timestamp: number;
};

export type TlonSessionRunSurface = TlonSessionSurface & {
  sessionKey: string;
};

const sessionSurfaces = sharedMap<string, TlonSessionSurface>(
  'onboarding-session-surfaces'
);
const sessionRunSurfaces = sharedMap<string, TlonSessionRunSurface>(
  'onboarding-session-run-surfaces'
);
const SURFACE_TTL_MS = 60 * 60 * 1000;

function pruneExpiredSurfaces(now = Date.now()): void {
  for (const [key, entry] of sessionSurfaces) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      sessionSurfaces.delete(key);
    }
  }
  for (const [key, entry] of sessionRunSurfaces) {
    if (now - entry.timestamp > SURFACE_TTL_MS) {
      sessionRunSurfaces.delete(key);
    }
  }
}

export function setTlonSessionSurface(
  sessionKey: string,
  surface: Omit<TlonSessionSurface, 'timestamp'>
): void {
  const now = Date.now();
  pruneExpiredSurfaces(now);
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

export function rememberTlonSessionRunSurface(
  runId: string,
  sessionKey: string
): void {
  const surface = getTlonSessionSurface(sessionKey);
  if (!surface) return;
  pruneExpiredSurfaces();
  sessionRunSurfaces.set(runId, { ...surface, sessionKey });
}

export function getTlonSessionRunSurface(
  runId: string | null | undefined
): TlonSessionRunSurface | undefined {
  const key = runId?.trim();
  if (!key) return undefined;
  const surface = sessionRunSurfaces.get(key);
  if (!surface) return undefined;
  if (Date.now() - surface.timestamp > SURFACE_TTL_MS) {
    sessionRunSurfaces.delete(key);
    return undefined;
  }
  return surface;
}

export function clearTlonSessionRunSurface(
  runId: string | null | undefined
): void {
  const key = runId?.trim();
  if (key) sessionRunSurfaces.delete(key);
}

export function onboardingToolBlockReason(
  toolName: string,
  params: unknown,
  surface: TlonSessionSurface | undefined,
  runSurface?: TlonSessionRunSurface
): string | undefined {
  const isTypedOnboardingTool =
    toolName === 'tlon_agent_choice' || toolName === 'tlon_agent_task_plan';

  if (isTypedOnboardingTool) {
    if (surface?.kind !== 'group' || !surface.channelNest) {
      return (
        'Recurring-task onboarding is available only in the active Tlonbot ' +
        'group. Tell the owner to choose +, then New Tlonbot group, and stop.'
      );
    }
    const target =
      params && typeof params === 'object' && 'target' in params
        ? String((params as { target?: unknown }).target ?? '')
        : '';
    if (target !== surface.channelNest) {
      return 'The onboarding tool target must match the active group channel.';
    }
    if (
      surface.messageId &&
      runSurface?.messageId &&
      surface.messageId !== runSurface.messageId
    ) {
      return (
        'A newer owner message arrived during this response. Do not post this ' +
        'choice or plan; stop and let the newer owner turn handle the latest intent.'
      );
    }
  }

  if (
    toolName === 'cron' &&
    surface?.kind === 'direct' &&
    !surface.bootstrapComplete
  ) {
    return (
      'First-run recurring-task provisioning is owned by the group ' +
      'coordinator. Tell the owner to choose +, then New Tlonbot group, and stop.'
    );
  }

  return undefined;
}

export const _testing = {
  clearAll: () => {
    sessionSurfaces.clear();
    sessionRunSurfaces.clear();
  },
};
