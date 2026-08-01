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
 * How the confirmation run is performed, shared by the jobs that produce
 * output on day one.
 *
 * Do the work in the conversation, with your own tools — don't trigger the
 * scheduled job and wait. A triggered run executes in an isolated session
 * that has neither web search nor the Tlon tools, so it can't research and
 * can't create the notes channel; it just reports being blocked, which is
 * the opposite of the reassurance this step exists to give.
 */
const INLINE_FIRST_RUN =
  'Do this run yourself, here in this conversation, using your own tools — ' +
  'do not trigger the scheduled job and wait for it.';

/**
 * Where a scheduled run's output goes, shared by every job that produces
 * something worth keeping.
 *
 * The output channel is created by the **first run**, not during setup: at
 * setup time there is nothing to put in it, and a group that opens with an
 * empty notebook reads as broken. So the first run makes it and records it,
 * and every run after that appends to the same place — the job's output
 * accumulates in one notebook instead of scrolling away in chat.
 *
 * Part of the verbatim payload, so it is one string rather than three
 * paraphrases that can drift apart.
 */
const OUTPUT_CHANNEL_RULE =
  "Post it to this group's notes channel — the notebook kind, whose nests " +
  'look like `notes/<host>/<name>`. If the group has no notes channel yet, ' +
  'create one in this group first (never a new group), name it for the ' +
  'subject, and record its nest as this job\'s "outputNest" in the group ' +
  'config so later runs go straight there. Every later run appends to that ' +
  'same channel. Announce it in chat with a single line — the chat gets the ' +
  'announcement, the notebook gets the writing.';

/**
 * The scheduled job each purpose sets up, templated so the operative cron
 * prompt is authored here — deterministically — rather than composed by the
 * model during the build turn. `prompt` is used **verbatim** as the cron
 * payload (the agent is directed not to rewrite it), so editing these strings
 * edits what the job actually does on every run.
 *
 * `confirmation` is what the agent does immediately after the build, so the
 * owner sees the value before the first scheduled run — and it always ends
 * by inviting a correction while the setup is still warm.
 *
 * `{{topics}}` is replaced with the owner's topic reply, exactly as sent —
 * a submitted pill selection ("Peptides, Mycology") or whatever they typed.
 *
 * `schedule` is the job's default cadence as a standard 5-field cron
 * expression (minute hour day-of-month month day-of-week), deliberately
 * without a timezone: the expression says when in the owner's day, and the
 * timezone is per-owner, learned in conversation — the agent passes it to
 * the cron tool as `schedule.tz` (an IANA name) and is forbidden from
 * silently defaulting to UTC. A default, not a mandate: only the payload
 * message is pinned verbatim, so the owner can move the schedule by asking.
 */
export const PURPOSE_JOBS: Record<
  string,
  { title: string; schedule: string; prompt: string; confirmation: string }
> = {
  'agent-daily-digest': {
    title: 'Daily digest: {{topics}}',
    schedule: '0 8 * * *',
    prompt:
      "Put together today's digest on: {{topics}}. Search the web for each " +
      "topic — never answer from memory, since a digest's whole value is " +
      'that the facts are current. Keep it tight — a line ' +
      'of facts or 3-4 dated headline bullets per topic, sources when they ' +
      'matter. For anything location-bound (weather, local), use the ' +
      "owner's saved location if you know one; otherwise infer a rough one " +
      'from their timezone and name it so they can correct you. ' +
      OUTPUT_CHANNEL_RULE +
      ' No preamble.',
    confirmation:
      'Run the job once right now, exactly as the scheduled run would — ' +
      'the owner should see a real digest, not a promise of one, and that ' +
      'run is what creates the notes channel. ' +
      INLINE_FIRST_RUN +
      ' Never fabricate: if you ' +
      "can't actually research, say so in chat in one honest line, with " +
      'what will arrive and when, and leave the notes channel uncreated ' +
      'until there is something real to put in it. Then ask if they want ' +
      'anything changed, enumerating the sources you used (one line each) ' +
      'so they can add, drop, or swap sources. If the run degraded, still ' +
      'ask — name what was missing and what you would use once it works.',
  },
  'agent-tracking': {
    title: 'Tracking check-in: {{topics}}',
    schedule: '0 18 * * 0',
    prompt:
      'Review everything the owner has logged in this group about: ' +
      '{{topics}} since the last check-in. Write a short running picture — ' +
      'totals, streaks, changes worth noticing — and one observation. ' +
      OUTPUT_CHANNEL_RULE +
      ' If nothing was logged, say so in one line in chat and stop, ' +
      'without posting an empty check-in.',
    confirmation:
      "There's nothing to summarize yet, so don't run the job — instead " +
      'ask the owner to log their first entry right now, in their own ' +
      "words, and confirm you've recorded it. Then ask whether there's " +
      'anything else they want to track alongside: {{topics}}.',
  },
  'agent-research': {
    title: 'Research update: {{topics}}',
    schedule: '0 9 * * 1',
    prompt:
      'Search the web for genuinely new developments on: {{topics}} since ' +
      'the last update — releases, papers, notable writing, community ' +
      'chatter. Never answer from memory. ' +
      OUTPUT_CHANNEL_RULE +
      ' If nothing new surfaced, say so in one line and stop.',
    confirmation:
      'Run the job once right now, exactly as the scheduled run would — ' +
      'the owner should see a real first update, and that run is what ' +
      'creates the notes channel. ' +
      INLINE_FIRST_RUN +
      " Never fabricate: if you can't actually " +
      'research, say so in chat in one honest line, with what will arrive ' +
      'and when, and leave the notes channel uncreated until there is ' +
      'something real to put in it. Then ask if they want anything ' +
      'changed, enumerating the sources you used (one line each) so they ' +
      'can add, drop, or swap sources. If the run degraded, still ask — ' +
      'name what was missing and what you would use once it works.',
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
