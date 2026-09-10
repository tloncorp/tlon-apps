import type {
  TlawnLLMAuthFlow,
  TlawnLLMAuthProvider,
  TlawnLLMAuthProviderStatus,
  TlawnLLMAuthStatus,
  TlawnProviderModel,
  TlawnSubscriptionModel,
} from '@tloncorp/api';

export type OpenAIAuthState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'active'; flow: TlawnLLMAuthFlow; error?: string }
  | { phase: 'complete'; flow: TlawnLLMAuthFlow }
  | {
      phase: 'error';
      message: string;
      restartable: boolean;
      flow?: TlawnLLMAuthFlow;
    };

export type OpenAIAuthEvent =
  | { type: 'start' }
  | { type: 'flow'; flow: TlawnLLMAuthFlow; now: number }
  | { type: 'tokenFailure'; message: string }
  | { type: 'failure'; message: string; notFound?: boolean }
  | { type: 'expired'; now: number }
  | { type: 'reset' };

export const canDismissOpenAIAuth = (
  phase: OpenAIAuthState['phase']
): boolean => phase !== 'complete';

export async function copyOpenAIUserCode(
  code: string | undefined,
  copy: () => Promise<void>,
  onCopied: () => void
): Promise<boolean> {
  if (!code) return false;
  await copy();
  onCopied();
  return true;
}

function currentFlow(state: OpenAIAuthState): TlawnLLMAuthFlow | undefined {
  return 'flow' in state ? state.flow : undefined;
}

function mergeFlowUpdate(
  state: OpenAIAuthState,
  nextFlow: TlawnLLMAuthFlow
): TlawnLLMAuthFlow {
  const previousFlow = currentFlow(state);
  if (
    !previousFlow ||
    previousFlow.id !== nextFlow.id ||
    previousFlow.provider !== nextFlow.provider
  ) {
    return nextFlow;
  }
  return {
    ...previousFlow,
    ...nextFlow,
    userCode: nextFlow.userCode ?? previousFlow.userCode,
    verificationUrl: nextFlow.verificationUrl ?? previousFlow.verificationUrl,
  };
}

export function reduceOpenAIAuthState(
  state: OpenAIAuthState,
  event: OpenAIAuthEvent
): OpenAIAuthState {
  switch (event.type) {
    case 'start':
      return { phase: 'starting' };
    case 'reset':
      return { phase: 'idle' };
    case 'failure':
      return {
        phase: 'error',
        message: event.notFound
          ? 'This connection attempt expired or the bot restarted.'
          : event.message,
        restartable: true,
        flow: currentFlow(state),
      };
    case 'tokenFailure':
      return state.phase === 'active'
        ? { ...state, error: event.message }
        : state;
    case 'expired': {
      const flow = currentFlow(state);
      if (!flow || flow.expiresAt > event.now) return state;
      return {
        phase: 'error',
        message: 'This connection attempt expired.',
        restartable: true,
        flow,
      };
    }
    case 'flow': {
      const flow = mergeFlowUpdate(state, event.flow);
      if (flow.status === 'complete') {
        return { phase: 'complete', flow };
      }
      if (flow.expiresAt <= event.now) {
        return {
          phase: 'error',
          message: 'This connection attempt expired.',
          restartable: true,
          flow,
        };
      }
      if (flow.status === 'error') {
        return {
          phase: 'error',
          message: flow.error ?? 'Connection failed.',
          restartable: true,
          flow,
        };
      }
      const preservesTokenError =
        state.phase === 'active' &&
        state.error !== undefined &&
        state.flow.id === flow.id &&
        state.flow.provider === flow.provider &&
        flow.provider === 'anthropic' &&
        flow.status === 'awaiting_token';
      return preservesTokenError
        ? { phase: 'active', flow, error: state.error }
        : { phase: 'active', flow };
    }
  }
}

export const isLLMAuthProviderConnected = (status?: string): boolean =>
  status === 'ok' || status === 'static' || status === 'expiring';

export function getLLMAuthStatusRefetchInterval(
  status?: TlawnLLMAuthStatus,
  now = Date.now()
): number {
  const defaultIntervalMs = 60_000;
  const nextExpiry = status?.providers.reduce<number | undefined>(
    (earliest, provider) => {
      const expiry = provider.expiry?.at;
      if (
        typeof expiry !== 'number' ||
        !Number.isFinite(expiry) ||
        expiry <= now
      ) {
        return earliest;
      }
      return earliest === undefined ? expiry : Math.min(earliest, expiry);
    },
    undefined
  );
  if (nextExpiry === undefined) return defaultIntervalMs;
  return Math.max(1_000, Math.min(defaultIntervalMs, nextExpiry - now));
}

export function getOpenAIAuthStatus(
  status?: TlawnLLMAuthStatus
): TlawnLLMAuthProviderStatus | undefined {
  return getLLMAuthProviderStatus(status, 'openai');
}

export function getLLMAuthProviderStatus(
  status: TlawnLLMAuthStatus | undefined,
  providerId: TlawnLLMAuthProvider
): TlawnLLMAuthProviderStatus | undefined {
  return status?.providers.find((provider) => provider.provider === providerId);
}

export function getOpenAISubscriptionModels(
  status?: TlawnLLMAuthStatus
): TlawnSubscriptionModel[] {
  return getLLMAuthSubscriptionModels(status, 'openai');
}

export function getLLMAuthSubscriptionModels(
  status: TlawnLLMAuthStatus | undefined,
  providerId: TlawnLLMAuthProvider
): TlawnSubscriptionModel[] {
  return status?.subscriptionModels?.[providerId] ?? [];
}

export function getOpenAIVerificationUrl(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export const getLLMAuthVerificationUrl = getOpenAIVerificationUrl;

export type OpenAICredentialMode = 'api-key' | 'subscription';

export function getOpenAICredentialSwitch(
  current: { hasApiKey: boolean; subscriptionConnected: boolean },
  next: OpenAICredentialMode
): { next: OpenAICredentialMode; remove: OpenAICredentialMode | null } {
  const remove =
    next === 'subscription' && current.hasApiKey
      ? 'api-key'
      : next === 'api-key' && current.subscriptionConnected
        ? 'subscription'
        : null;
  return { next, remove };
}

export function getOpenAIDisconnectQueryKeys(
  ship: string,
  hostingUserId: string
): string[][] {
  return getLLMAuthDisconnectQueryKeys(ship, hostingUserId, 'openai');
}

export function getLLMAuthDisconnectQueryKeys(
  ship: string,
  hostingUserId: string,
  providerId: TlawnLLMAuthProvider
): string[][] {
  return [
    ['tlonbot', 'llm-auth-status', ship],
    ['tlonbot', 'provider-config', hostingUserId],
    ['tlonbot', 'provider-models', hostingUserId, providerId],
  ];
}

export function mergeProviderModels(
  subscriptionModels: TlawnSubscriptionModel[],
  apiKeyModels: TlawnProviderModel[]
): TlawnProviderModel[] {
  const seen = new Set<string>();
  return [...subscriptionModels, ...apiKeyModels]
    .filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    })
    .map((model) => ({ ...model }));
}
