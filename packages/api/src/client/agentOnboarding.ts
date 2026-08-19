export const AGENT_ONBOARDING_GROUP_INTRO =
  "I'm your Tlonbot. I can keep you informed, help you learn, or follow a " +
  'question over time.';

export const AGENT_ONBOARDING_PURPOSE_PROMPT = 'What can I help you with?';

export const AGENT_ONBOARDING_ORIENTATION_PROMPT =
  'You’re all set. Is there anything else I can help you with?';

export const AGENT_ONBOARDING_ORIENTATION_OPTIONS = [
  { id: 'groups-and-channels', label: 'Groups and channels' },
  { id: 'your-tlon-computer', label: 'Your Tlon computer' },
  { id: 'other-capabilities', label: 'What else can you do?' },
  { id: 'finished', label: 'I’m good for now' },
] as const;

/** Static choices shared by the coordinator and its visual fixture. */
export const AGENT_ONBOARDING_PURPOSE_OPTIONS = [
  {
    id: 'agent-daily-digest',
    label: 'A daily digest',
    description:
      'A short summary of anything you care about, posted every morning.',
    icon: 'ChannelNotebooks',
    accent: 'blue',
    scheduleHour: 8,
    topicsPrompt:
      'A daily digest—great. What should I keep an eye on? Pick any that fit.',
    topics: [
      'Nootropics',
      'Longevity',
      'Psychedelics',
      'Open hardware',
      'Gene editing',
      'Space weather',
    ],
  },
  {
    id: 'agent-learning',
    label: 'Learn something',
    description: 'One idea each morning, taking your topics in turn.',
    icon: 'Clock',
    accent: 'green',
    scheduleHour: 9,
    topicsPrompt:
      'Great. What would you like to understand better? Pick any that fit—I’ll take them one at a time.',
    topics: [
      'Music theory',
      'Genetics',
      'Astronomy',
      'Philosophy',
      'Architecture',
      'Economics',
    ],
  },
  {
    id: 'agent-research',
    label: 'Research',
    description: 'A source-backed briefing that follows meaningful new work.',
    icon: 'Search',
    accent: 'indigo',
    scheduleHour: 9,
    topicsPrompt:
      'Got it. What question or field should I follow closely? Pick any that fit.',
    topics: [
      'Peptides',
      'Installation art',
      'Electronic music',
      'Mycology',
      'Longevity',
      'Synthesizers',
    ],
  },
] as const;
