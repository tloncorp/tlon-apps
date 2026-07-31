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
 * The scheduled job each purpose sets up, templated so the operative cron
 * prompt is authored here — deterministically — rather than composed by the
 * model during the build turn. `prompt` is used **verbatim** as the cron
 * payload (the agent is directed not to rewrite it), so editing these strings
 * edits what the job actually does on every run.
 *
 * `{{topics}}` is replaced with the owner's topic reply, exactly as sent —
 * a submitted pill selection ("Peptides, Mycology") or whatever they typed.
 * `schedule` is a cron expression evaluated in the owner's timezone.
 */
export const PURPOSE_JOBS: Record<
  string,
  { title: string; schedule: string; prompt: string }
> = {
  'agent-daily-digest': {
    title: 'Daily digest: {{topics}}',
    schedule: '0 8 * * *',
    prompt:
      "Put together today's digest on: {{topics}}. Keep it tight — a line " +
      'of facts or 3-4 dated headline bullets per topic, sources when they ' +
      "matter. Post it to this group's digest channel if one exists, " +
      'otherwise right here, and announce it in chat with a single line. ' +
      'No preamble.',
  },
  'agent-tracking': {
    title: 'Tracking check-in: {{topics}}',
    schedule: '0 18 * * 0',
    prompt:
      'Review everything the owner has logged in this group about: ' +
      '{{topics}} since the last check-in. Post a short running picture — ' +
      'totals, streaks, changes worth noticing — and one observation. If ' +
      'nothing was logged, say so in one line and stop.',
  },
  'agent-research': {
    title: 'Research update: {{topics}}',
    schedule: '0 9 * * 1',
    prompt:
      'Look for genuinely new developments on: {{topics}} since the last ' +
      'update — releases, papers, notable writing, community chatter. Post ' +
      "a short update to this group's research channel if one exists, " +
      'otherwise right here, and announce it in chat with a single line. ' +
      'If nothing new surfaced, say so in one line and stop.',
  },
};

/**
 * Starting points for the topic step, per purpose.
 *
 * Suggestions, never a menu: the picker always carries "or just tell me", and
 * the agent reads a typed answer the same way it reads a submitted selection.
 * Kept to a word or two so they fit a pill.
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
    'Peptides',
    'Installation art',
    'Electronic music',
    'Mycology',
    'Longevity',
    'Synthesizers',
    'Fermentation',
    'Homelabs',
  ],
};
