/**
 * Conversation content for agent onboarding — everything the bot says or
 * offers while setting up a group, kept apart from the mechanics in
 * `agent-onboarding.ts` so copy and option changes never touch operational
 * code.
 *
 * This plugin owns the content: the bot composes and posts the pickers, so
 * nothing on the app side needs its own copy — the client renders whatever
 * arrives as generic A2UI components.
 */

export const PURPOSE_PICKER_PROMPT =
  "Let's make you a group that does something useful. What should it do?";

export const PURPOSE_PICKER_FOOTER =
  'Or just tell me — the cards are only starts.';

/**
 * The purpose picker's cards. Option ids double as `templateId` provenance in
 * written group configs, and titles are exactly what a tap posts back as the
 * owner's reply — changing either is a wire change.
 */
export const PURPOSE_OPTIONS = [
  {
    id: 'agent-daily-digest',
    title: 'A daily digest',
    description:
      'A short summary of anything you care about, posted every morning.',
    icon: 'ChannelNotebooks',
    accent: 'blue',
  },
  {
    id: 'agent-tracking',
    title: 'Tracking',
    description:
      'You log a thing as it happens. I keep the running picture over time.',
    icon: 'Clock',
    accent: 'green',
  },
  {
    id: 'agent-research',
    title: 'Research',
    description: 'A standing deep-dive I keep updated as new work comes out.',
    icon: 'Search',
    accent: 'indigo',
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
  // Mirrors A2UI.ChoiceIcon / ChoiceAccent, spelled literally because this
  // plugin may build against a published @tloncorp/api that predates them.
  icon: 'ChannelNotebooks' | 'Clock' | 'Search';
  accent: 'blue' | 'green' | 'indigo';
}[];

export const TOPICS_PICKER_PROMPT =
  'Good. What should I keep up with for you? Pick any that fit.';

export const TOPICS_PICKER_SUBMIT_LABEL = 'That’s it';

/**
 * Starting points for the topic step, per purpose.
 *
 * Suggestions, never a menu: the picker always carries "or just tell me", and
 * the agent reads a typed answer the same way it reads a submitted selection.
 * Kept to single words so they fit a pill.
 */
export const PURPOSE_TOPICS: Record<string, readonly string[]> = {
  'agent-daily-digest': [
    'Weather',
    'News',
    'Stocks',
    'Sports',
    'Tech',
    'Local',
  ],
  'agent-tracking': [
    'Workouts',
    'Meals',
    'Sleep',
    'Mood',
    'Spending',
    'Reading',
  ],
  'agent-research': [
    'AI',
    'Markets',
    'Health',
    'Policy',
    'Science',
    'Competitors',
  ],
};
