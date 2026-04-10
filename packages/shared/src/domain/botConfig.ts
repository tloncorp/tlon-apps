export type PersonalityType = 'assistant' | 'creature' | 'companion' | 'custom';
export type ResponseStyle = 'concise' | 'balanced' | 'detailed';
export interface BotConfig {
  name: string;
  emoji: string;
  personalityType: PersonalityType;
  customSoulPrompt?: string;
  model: string;
  apiKey?: string;
  responseStyle: ResponseStyle;
  activeHoursStart: number;
  activeHoursEnd: number;
  timezone: string;
}

export interface PersonalityOption {
  value: PersonalityType;
  title: string;
  description: string;
  emoji: string;
}

export interface ModelOption {
  value: string;
  label: string;
  description: string;
  requiresKey?: boolean;
}

export const PERSONALITY_TYPES: PersonalityOption[] = [
  {
    value: 'assistant',
    title: 'AI assistant',
    description: 'Helpful, capable, professional',
    emoji: '🤖',
  },
  {
    value: 'creature',
    title: 'Digital creature',
    description: 'Quirky, alive, unpredictable',
    emoji: '🌿',
  },
  {
    value: 'companion',
    title: 'Virtual companion',
    description: 'Warm, present, genuinely cares',
    emoji: '💜',
  },
  {
    value: 'custom',
    title: 'Something weirder',
    description: 'Define yourself',
    emoji: '✨',
  },
];

export const SUGGESTED_NAMES = [
  'Aria',
  'Echo',
  'Nova',
  'Rex',
  'Sage',
  'Iris',
  'Orion',
  'Pixel',
];

export const SUGGESTED_EMOJIS = [
  '🌱',
  '🤖',
  '🌿',
  '💜',
  '✨',
  '🔮',
  '🦊',
  '🌙',
  '🎭',
  '🧠',
  '👾',
  '🐙',
  '🌸',
  '⚡',
  '🎵',
  '🦋',
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'minimax',
    label: 'MiniMax',
    description: 'Default (free)',
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    description: 'Requires API key',
    requiresKey: true,
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Requires API key',
    requiresKey: true,
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    description: 'Requires API key',
    requiresKey: true,
  },
];

export const RESPONSE_STYLE_OPTIONS: {
  value: ResponseStyle;
  label: string;
}[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
];

export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: '',
  emoji: '🌱',
  personalityType: 'assistant',
  model: 'minimax',
  responseStyle: 'balanced',
  activeHoursStart: 0,
  activeHoursEnd: 24,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
