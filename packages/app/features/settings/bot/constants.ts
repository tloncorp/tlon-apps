import type {
  TlawnProviderConfigInfo,
  TlawnProviderModel,
} from '@tloncorp/api';

export const BASIC_PROVIDER_LABEL = 'Basic (MiniMax M3)';
export const BASIC_PROVIDER_ID = 'basic';
export const BASIC_DEFAULT_MODEL = 'minimax/minimax-m3';
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
];

export const providerLabel = (providerId: string): string =>
  PROVIDER_OPTIONS.find((option) => option.id === providerId)?.label ||
  providerId;

export const RETRY_INTERVAL_MS = 5_000;

// Model catalogs (OpenRouter especially) can run to hundreds of entries;
// the pickers render inside a plain ScrollView, so cap what mounts at once
// and let search narrow the rest.
export const MAX_VISIBLE_MODELS = 50;
