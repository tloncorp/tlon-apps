import type { TlawnProviderConfigInfo } from '@tloncorp/api';
import type { OnboardingFlow } from '@tloncorp/shared/domain';

export type BotCredentialMode = 'included' | 'api-key' | 'subscription';

export type BotCredentialOption = {
  id: string;
  provider: string;
  credentialMode: BotCredentialMode;
  label: string;
  requiresKey: boolean;
  recommendationLabel?: string;
};

type TimerHandle = ReturnType<typeof setTimeout>;

export function startBotReadinessPolling({
  checkReadiness,
  onReady,
  onError,
  intervalMs = 5000,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (timer) => clearTimeout(timer),
}: {
  checkReadiness: () => Promise<boolean>;
  onReady: () => void;
  onError?: (error: unknown) => void;
  intervalMs?: number;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancel?: (timer: TimerHandle) => void;
}): () => void {
  let stopped = false;
  let timer: TimerHandle | null = null;

  const poll = async () => {
    try {
      const ready = await checkReadiness();
      if (stopped) return;
      if (ready) {
        onReady();
        return;
      }
    } catch (error) {
      if (stopped) return;
      onError?.(error);
    }

    if (!stopped) {
      timer = schedule(() => {
        timer = null;
        void poll();
      }, intervalMs);
    }
  };

  void poll();

  return () => {
    stopped = true;
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  basic: 'GPT-5.6 Luna',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  xai: 'xAI (Grok)',
};

const providerLabel = (provider: string) =>
  PROVIDER_LABELS[provider] ?? provider;

export function buildBotCredentialOptions({
  providerConfig,
  botReady,
  mode,
}: {
  providerConfig: TlawnProviderConfigInfo;
  botReady: boolean;
  mode?: OnboardingFlow;
}): BotCredentialOption[] {
  const options: BotCredentialOption[] = [];
  const add = (
    provider: string,
    credentialMode: BotCredentialMode,
    label: string,
    recommendationLabel?: string
  ) => {
    const id = `${provider}:${credentialMode}`;
    if (options.some((option) => option.id === id)) return;
    options.push({
      id,
      provider,
      credentialMode,
      label,
      requiresKey: credentialMode === 'api-key',
      recommendationLabel,
    });
  };

  if (providerConfig.defaultKeys?.basic) {
    add('basic', 'included', providerLabel('basic'));
  }

  if (mode === 'signup' && botReady) {
    add('openai', 'subscription', 'ChatGPT subscription', 'Recommended');
    add('anthropic', 'subscription', 'Claude subscription');
    add('xai', 'subscription', 'Grok subscription');
  }

  add('openai', 'api-key', 'OpenAI — API key');
  add('xai', 'api-key', 'xAI (Grok) — API key');
  add('anthropic', 'api-key', providerLabel('anthropic'));
  add('openrouter', 'api-key', providerLabel('openrouter'));

  for (const provider of Object.keys(providerConfig.defaultKeys ?? {})) {
    if (provider !== 'basic') {
      add(provider, 'included', `${providerLabel(provider)} — Included`);
    }
  }
  for (const provider of Object.keys(providerConfig.keys ?? {})) {
    add(provider, 'api-key', providerLabel(provider));
  }

  return options;
}
