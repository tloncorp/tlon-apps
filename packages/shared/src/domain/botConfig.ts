export interface ModelOption {
  value: string;
  label: string;
  description: string;
  requiresKey?: boolean;
}

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

export const DEFAULT_BOT_CONFIG = {
  name: '',
  avatarUrl: null as string | null,
  model: 'minimax',
};
