export type PersonalityType = 'assistant' | 'creature' | 'companion' | 'custom';
export type ResponseStyle = 'concise' | 'balanced' | 'detailed';
export interface BotConfig {
  name: string;
  emoji: string;
  avatarUrl: string | null;
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
  },
  {
    value: 'creature',
    title: 'Digital creature',
    description: 'Quirky, alive, unpredictable',
  },
  {
    value: 'companion',
    title: 'Virtual companion',
    description: 'Warm, present, genuinely cares',
  },
  {
    value: 'custom',
    title: 'Something weirder',
    description: 'Define yourself',
  },
];

export const SUGGESTED_NAMES = [
  'Daneel', // R. Daneel Olivaw — Asimov, The Caves of Steel
  'Wintermute', // Gibson, Neuromancer
  'Marvin', // Adams, The Hitchhiker's Guide to the Galaxy
  'Breq', // Leckie, Ancillary Justice
  'Gully', // Gully Foyle — Bester, The Stars My Destination
  'Hari', // Hari Seldon — Asimov, Foundation
  'Shrike', // Simmons, Hyperion
  'Oankali', // Butler, Lilith's Brood
  'Mycroft', // Heinlein, The Moon Is a Harsh Mistress
  'Mantis', // Wolfe, The Book of the New Sun
  'Neuron', // Original
  'Pris', // Dick, Do Androids Dream of Electric Sheep?
  'Norby', // Asimov & Asimov, Norby the Mixed-Up Robot
  'Robbie', // Asimov, I, Robot
  'Terminus', // Asimov, Foundation
  'Nemo', // Verne, Twenty Thousand Leagues Under the Seas
  'Ozma', // Carl Sagan, Contact (Project Ozma)
  'Ged', // Le Guin, A Wizard of Earthsea
];

export const SUGGESTED_AVATARS = [
  'https://i.pravatar.cc/150?img=1',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=8',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=21',
  'https://i.pravatar.cc/150?img=32',
  'https://i.pravatar.cc/150?img=47',
  'https://i.pravatar.cc/150?img=52',
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
  avatarUrl: null,
  personalityType: 'assistant',
  model: 'minimax',
  responseStyle: 'balanced',
  activeHoursStart: 0,
  activeHoursEnd: 24,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
