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

const PROVIDER_LABELS: Record<string, string> = {
  basic: 'GPT-5.6 Luna',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
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
    add(
      'openai',
      'subscription',
      'OpenAI — ChatGPT subscription',
      'Recommended'
    );
  }

  add('openai', 'api-key', 'OpenAI — API key');
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
