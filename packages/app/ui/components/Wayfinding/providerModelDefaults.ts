import type {
  TlawnLLMAuthProvider,
  TlawnProviderModel,
  TlawnSubscriptionModel,
} from '@tloncorp/api';

export const OPENAI_ONBOARDING_DEFAULT_MODEL = 'gpt-5.6-luna';
export const ANTHROPIC_ONBOARDING_DEFAULT_MODEL = 'claude-sonnet-5';
export const XAI_ONBOARDING_DEFAULT_MODEL = 'grok-4.3';

const SUBSCRIPTION_ONBOARDING_DEFAULT_MODELS: Partial<Record<string, string>> =
  {
    openai: OPENAI_ONBOARDING_DEFAULT_MODEL,
    anthropic: ANTHROPIC_ONBOARDING_DEFAULT_MODEL,
    xai: XAI_ONBOARDING_DEFAULT_MODEL,
  };

export function resolveInitialProviderModel(
  provider: string,
  models: TlawnProviderModel[],
  currentModel: string
): string {
  if (models.some((model) => model.id === currentModel)) {
    return currentModel;
  }
  const defaultModel = SUBSCRIPTION_ONBOARDING_DEFAULT_MODELS[provider];
  if (defaultModel && models.some((model) => model.id === defaultModel)) {
    return defaultModel;
  }
  return '';
}

export function initializeOpenAISubscriptionModels(
  models: TlawnSubscriptionModel[],
  currentModel: string
): { providerModels: TlawnProviderModel[]; primaryModel: string } {
  return initializeSubscriptionModels('openai', models, currentModel);
}

export function initializeSubscriptionModels(
  provider: TlawnLLMAuthProvider,
  models: TlawnSubscriptionModel[],
  currentModel: string
): { providerModels: TlawnProviderModel[]; primaryModel: string } {
  const providerModels: TlawnProviderModel[] = models.map((model) => ({
    ...model,
  }));
  return {
    providerModels,
    primaryModel: resolveInitialProviderModel(
      provider,
      providerModels,
      currentModel
    ),
  };
}
