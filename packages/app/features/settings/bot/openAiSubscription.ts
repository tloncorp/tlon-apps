import type {
  TlawnLLMAuthFlow,
  TlawnLLMAuthProviderStatus,
  TlawnLLMAuthStatus,
  TlawnProviderModel,
  TlawnSubscriptionModel,
} from '@tloncorp/api';

export type OpenAIAuthState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'active'; flow: TlawnLLMAuthFlow }
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
    case 'flow':
      if (event.flow.status === 'complete') {
        return { phase: 'complete', flow: event.flow };
      }
      if (event.flow.expiresAt <= event.now) {
        return {
          phase: 'error',
          message: 'This connection attempt expired.',
          restartable: true,
          flow: event.flow,
        };
      }
      if (event.flow.status === 'error') {
        return {
          phase: 'error',
          message: event.flow.error ?? 'Connection failed.',
          restartable: true,
          flow: event.flow,
        };
      }
      return { phase: 'active', flow: event.flow };
  }
}

export const isLLMAuthProviderConnected = (status?: string): boolean =>
  status === 'ok' || status === 'static' || status === 'expiring';

export function getOpenAIAuthStatus(
  status?: TlawnLLMAuthStatus
): TlawnLLMAuthProviderStatus | undefined {
  return status?.providers.find((provider) => provider.provider === 'openai');
}

export function getOpenAISubscriptionModels(
  status?: TlawnLLMAuthStatus
): TlawnSubscriptionModel[] {
  return status?.subscriptionModels?.openai ?? [];
}

export function getOpenAIVerificationUrl(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

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
  return [
    ['tlonbot', 'llm-auth-status', ship],
    ['tlonbot', 'provider-config', hostingUserId],
    ['tlonbot', 'provider-models', hostingUserId, 'openai'],
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
