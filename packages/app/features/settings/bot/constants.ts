import type {
  TlawnProviderConfigInfo,
  TlawnProviderModel,
} from '@tloncorp/api';

// Hosting picks the model behind Basic (`tlonDefaultModels` in ylem) and
// changes it without an app release. It stores the option as "default"
// whatever id is sent and reports the model it runs, so the name shown comes
// from that report. BASIC_DEFAULT_MODEL is only assumed until it arrives.
export const BASIC_PROVIDER_LABEL = 'Basic';
export const BASIC_PROVIDER_ID = 'basic';
export const BASIC_DEFAULT_MODEL = 'openai/gpt-6-luna';

/** The model hosting runs behind Basic, as it last reported it. */
export const getIncludedModelId = (config?: TlawnProviderConfigInfo): string =>
  config?.defaultModels?.primaryModel ||
  config?.models?.find((entry) => entry.provider === BASIC_PROVIDER_ID)
    ?.model ||
  BASIC_DEFAULT_MODEL;

/**
 * A model id as people know the model: "openai/gpt-6-luna" is "GPT-6 Luna",
 * as OpenRouter names it. An id of any other shape is shown as sent, which can
 * look plain but never names the wrong model.
 */
export const getModelName = (modelId: string): string => {
  const name = modelId.slice(modelId.indexOf('/') + 1).replace(/:.*$/, '');
  const gpt = /^gpt-(\d+(?:\.\d+)*)((?:-[a-z]+)*)$/.exec(name);
  if (!gpt) return name;
  const words = gpt[2]
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1));
  return [`GPT-${gpt[1]}`, ...words].join(' ');
};

export const getBasicModelLabel = (config?: TlawnProviderConfigInfo): string =>
  `${BASIC_PROVIDER_LABEL} (${getModelName(getIncludedModelId(config))})`;

export const getBasicProviderModel = (
  config?: TlawnProviderConfigInfo
): TlawnProviderModel => ({
  id: getIncludedModelId(config),
  name: getBasicModelLabel(config),
});

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
