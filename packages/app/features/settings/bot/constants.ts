import type {
  TlawnProviderConfigInfo,
  TlawnProviderModel,
} from '@tloncorp/api';

export const BASIC_PROVIDER_LABEL = 'Basic (GPT-5.6 Luna)';
export const BASIC_PROVIDER_ID = 'basic';
export const BASIC_DEFAULT_MODEL = 'openai/gpt-5.6-luna';
export const BASIC_PROVIDER_MODEL: TlawnProviderModel = {
  id: BASIC_DEFAULT_MODEL,
  name: BASIC_PROVIDER_LABEL,
};

export const EMPTY_PROVIDER_CONFIG: TlawnProviderConfigInfo = {
  keys: {},
  models: [],
  defaultKeys: {},
};

export type ProviderOption = {
  id: string;
  label: string;
};

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: BASIC_PROVIDER_ID, label: BASIC_PROVIDER_LABEL },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'xai', label: 'xAI (Grok)' },
];

export const SUBSCRIPTION_PROVIDERS = ['openai', 'anthropic', 'xai'] as const;

export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

export const isSubscriptionProvider = (
  providerId: string
): providerId is SubscriptionProvider =>
  SUBSCRIPTION_PROVIDERS.some((provider) => provider === providerId);

export const subscriptionProviderLabel = (
  providerId: SubscriptionProvider
): string =>
  providerId === 'anthropic'
    ? 'Claude'
    : providerId === 'xai'
      ? 'Grok'
      : 'ChatGPT';

export const subscriptionLabel = (providerId: SubscriptionProvider): string =>
  `${subscriptionProviderLabel(providerId)} subscription`;

export const providerLabel = (providerId: string): string =>
  PROVIDER_OPTIONS.find((option) => option.id === providerId)?.label ||
  providerId;

export const RETRY_INTERVAL_MS = 5_000;

// Model catalogs (OpenRouter especially) can run to hundreds of entries;
// the pickers render inside a plain ScrollView, so cap what mounts at once
// and let search narrow the rest.
export const MAX_VISIBLE_MODELS = 50;
