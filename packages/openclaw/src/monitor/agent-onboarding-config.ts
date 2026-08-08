/** User-facing onboarding copy and deterministic job templates. */
export const GROUP_INTRO_MESSAGE = [
  "I'm your Tlonbot. I can go off and do things — look things up, keep " +
    'track of what changes, write it down for you — not just answer ' +
    'questions.',
  'Everything we say in here is stored in Tlon, and it stays. Swap the ' +
    'model behind me and this conversation is still here. Move your Tlon ' +
    'to your own server and it comes with you.',
  'Call me something else whenever you like — tell me the name and I’ll ' +
    'change my profile.',
].join('\n\n');

export const ONBOARDING_PLUGIN_DIAGNOSTIC_PREFIX = 'OpenClaw plugin commit:';

/** A visible build marker for diagnosing mixed app/plugin deployments. */
export function onboardingPluginDiagnostic(commit: string): string {
  return `${ONBOARDING_PLUGIN_DIAGNOSTIC_PREFIX} ${commit.trim() || 'unknown'}`;
}

export const PURPOSE_PICKER_PROMPT =
  "Let's make you a group that does something useful. What should it do?";

export const PURPOSE_PICKER_FOOTER =
  'Or just tell me — the cards are only starts.';

export const CUSTOM_PURPOSE_ID = 'agent-custom';

/** IDs and titles are persisted wire values. */
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

export const TOPICS_PICKER_FOOTER =
  'You can also just tell me here in the chat.';

export const TOPICS_FREE_TEXT_PLACEHOLDER = 'Add your own…';

export const TIMEZONE_PICKER_PROMPT =
  'One last detail: which timezone should I use for the schedule?';
export const TIMEZONE_PICKER_BUTTON_LABEL = 'Use my current timezone';
export const TIMEZONE_PICKER_FALLBACK =
  `${TIMEZONE_PICKER_PROMPT} Reply with an IANA timezone such as ` +
  '`America/New_York`.';

export const WAITING_FOR_NOTEBOOK_LINE =
  'Job scheduled. Creating a notebook channel to write into...';

export const RESEARCHING_NOTEBOOK_LINE =
  'Notebook created. Searching the web and summarizing, this might take a sec...';

export const ONBOARDING_COMPLETE_LINE =
  "Done! Today's scheduled task is in a Notebook channel in this group.";

/** Transcript recovery also matches this shared lead sentence. */
export const INVITE_CARD_LEAD = 'Tlon is better with someone else in it.';
export const INVITE_CARD_LEADS = [
  INVITE_CARD_LEAD,
  `Done! ${INVITE_CARD_LEAD}`,
] as const;

export const INVITE_CARD_PROMPT = `${INVITE_CARD_LEAD} Send them this link:`;

export const INVITE_CARD_FALLBACK =
  `${INVITE_CARD_LEAD} Invite someone from this group's info screen — or ` +
  'update your app to send an invite link right from here.';

export const INVITE_CARD_BUTTON_LABEL = 'Invite';

export const SERVICES_CARD_LEAD = 'I can draw on more than the web.';

export const SERVICES_CARD_PROMPT =
  `${SERVICES_CARD_LEAD} Connect your other services — calendars, docs, ` +
  'notes — and what they know flows into these digests too:';

export const SERVICES_CARD_FALLBACK =
  `${SERVICES_CARD_LEAD} Connect your other services — calendars, docs, ` +
  'notes — under Settings → Tlonbot → Connected services, and what they ' +
  'know flows into these digests too.';

export const SERVICES_CARD_BUTTON_LABEL = 'Connect services';

export const INVITE_FOLLOWUP_MESSAGE =
  'I’m here to talk to or ask questions about what I find. What else would ' +
  'you like me to do?';

/** Recurring runs append only to the owner's persisted notebook nest. */
const OUTPUT_CHANNEL_RULE =
  "This run's output belongs in this group's notebook — the OWNER's notes " +
  "channel, on their ship. Append to the nest recorded in this job's " +
  '"outputNest". Write it with the tlon tool, never the message tool ' +
  '(which only posts chat and cannot carry a title): put the body in a ' +
  'markdown file and pass that file — `notes note-create <nest> root ' +
  '"<Title>" --markdown <file>`. Never `--stdin`; it cannot receive input ' +
  'through this tool and the entry would never land. Never create a ' +
  'channel or a group to hold this, and never post into a notebook you ' +
  'picked yourself. If no notebook nest is recorded, post the run in chat ' +
  'instead and say that is where it went — chat is the fallback, never a ' +
  'channel of your own making.';

/** Daily templates; `{{topics}}` is replaced with the owner's exact reply. */
export const PURPOSE_JOBS: Record<
  string,
  {
    title: string;
    schedule: string;
    prompt: string;
    /** Day-one content differs from the recurring prompt. */
    entry: string;
  }
> = {
  [CUSTOM_PURPOSE_ID]: {
    title: '{{purpose}}: {{topics}}',
    schedule: '0 9 * * *',
    prompt:
      'Carry out this recurring task: {{purpose}}. Focus on: {{topics}}. ' +
      'Use web search whenever current information would improve the result. ' +
      OUTPUT_CHANNEL_RULE +
      ' No preamble.',
    entry:
      'The first result for this task: {{purpose}}. Focus on {{topics}} and ' +
      'complete the task now, with sources where they matter. No preamble.',
  },
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
    entry:
      "Today's digest on the topics in the title — the research you just " +
      'did, written up: a line of facts or 3-4 dated headline bullets per ' +
      'topic, sources where they matter. No preamble.',
  },
  'agent-tracking': {
    title: 'Tracking check-in: {{topics}}',
    schedule: '0 18 * * *',
    prompt:
      'Review everything the owner has logged in this group about: ' +
      '{{topics}} since the last check-in. Write a short running picture — ' +
      'totals, streaks, changes worth noticing — and one observation. ' +
      OUTPUT_CHANNEL_RULE +
      ' If nothing was logged, say so in one line in chat and stop, ' +
      'without posting an empty check-in.',
    entry:
      'Not a check-in — there is nothing logged yet to check. A single ' +
      'seed titled "About this notebook" whose body is exactly: "Analysis ' +
      'and summaries of your {{topics}} entries will land in this ' +
      'notebook." — you may only rephrase the topic list itself so it ' +
      'reads naturally.',
  },
  'agent-research': {
    title: 'Research update: {{topics}}',
    schedule: '0 9 * * *',
    prompt:
      'Search the web for genuinely new developments on: {{topics}} since ' +
      'the last update — releases, papers, notable writing, community ' +
      'chatter. Never answer from memory. ' +
      OUTPUT_CHANNEL_RULE +
      ' If nothing new surfaced, say so in one line and stop.',
    entry:
      'The first research update on the topics in the title — what you ' +
      'just found: releases, papers, notable writing, community chatter, ' +
      'with sources. No preamble.',
  },
};

/** Short suggestions, never an exhaustive menu. */
export const PURPOSE_TOPICS: Record<string, readonly string[]> = {
  'agent-daily-digest': [
    'Nootropics',
    'Longevity',
    'Psychedelics',
    'Open hardware',
    'Gene editing',
    'Space weather',
    'Fusion',
    'Homesteading',
  ],
  'agent-tracking': [
    'HRV',
    'Cold plunges',
    'Sauna',
    'Fasting',
    'Supplements',
    'Blood glucose',
    'VO2 max',
    'Dreams',
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
