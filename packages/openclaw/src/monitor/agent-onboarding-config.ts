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

/**
 * What the agent says first, before the purpose picker — a plain-text post,
 * sent as its own message so the introduction and the question don't arrive
 * as one wall of text.
 *
 * Claims the agent as the owner's own, then says the part that is true here
 * and nowhere else: the conversation is stored in Tlon rather than in a
 * vendor's account, so it survives both swapping the model underneath and
 * moving the whole thing to their own server. Closes by offering the rename,
 * since the agent can set its own nickname and nothing else says so.
 */
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
 * The topic pills are suggestions, and the picker has to say so — otherwise a
 * wrapped row of chips reads as the whole menu.
 */
export const TOPICS_PICKER_FOOTER =
  'You can also just tell me here in the chat.';

/**
 * Placeholder for the picker's free-text field, which submits typed topics
 * together with the selected pills as one message — without it, "some of
 * these plus one of my own" took a pill submit chased by a chat message.
 */
export const TOPICS_FREE_TEXT_PLACEHOLDER = 'Add your own…';

export const TIMEZONE_PICKER_PROMPT =
  'One last detail: which timezone should I use for the schedule?';
export const TIMEZONE_PICKER_BUTTON_LABEL = 'Use my current timezone';
export const TIMEZONE_PICKER_FALLBACK =
  `${TIMEZONE_PICKER_PROMPT} Reply with an IANA timezone such as ` +
  '`America/New_York`.';

export const WAITING_FOR_NOTEBOOK_LINE = 'Waiting for your notebook…';

/**
 * How every setup ends: by getting someone else into the group.
 *
 * A group with one member is the worst possible demonstration of Tlon, and
 * the splash screen that used to ask for contacts is gone — the
 * conversational flow replaced it — so this is the only place left that
 * asks. It closes with the invite rather than the old what-would-you-change
 * question: tuning can wait, and they will care more about tuning once
 * somebody else is reading.
 *
 * Tlon posts the invite card itself, immediately after this turn, so the
 * agent must not try to produce a link of its own.
 */
/**
 * Shared first sentence of the card and its fallback — also what the
 * transcript recovery matches to know a card was already posted, so keep all
 * three in step.
 */
export const INVITE_CARD_LEAD = 'Tlon is better with someone else in it.';

export const INVITE_CARD_PROMPT = `${INVITE_CARD_LEAD} Send them this link:`;

/**
 * The story text, which is all a client that predates `tlon.inviteLink`
 * renders. It must stand alone: "Send them this link:" with the link living
 * in a dropped blob is an instruction pointing at nothing.
 */
export const INVITE_CARD_FALLBACK =
  `${INVITE_CARD_LEAD} Invite someone from this group's info screen — or ` +
  'update your app to send an invite link right from here.';

export const INVITE_CARD_BUTTON_LABEL = 'Invite';

/**
 * The connected-services card, posted between the invite card and the
 * follow-up — but only in the home group's *initial* onboarding, where the
 * account is new and nothing is connected yet. A user creating their third
 * agent group doesn't need the tour again.
 *
 * Shared first sentence of the card and its fallback, mirroring the invite
 * card's structure.
 */
export const SERVICES_CARD_LEAD = 'I can draw on more than the web.';

export const SERVICES_CARD_PROMPT =
  `${SERVICES_CARD_LEAD} Connect your other services — calendars, docs, ` +
  'notes — and what they know flows into these digests too:';

/**
 * The story text, which is all a client that predates screen navigation
 * renders. It must stand alone: it names the path to the same screen the
 * card's button opens.
 */
export const SERVICES_CARD_FALLBACK =
  `${SERVICES_CARD_LEAD} Connect your other services — calendars, docs, ` +
  'notes — under Settings → Tlonbot → Connected services, and what they ' +
  'know flows into these digests too.';

export const SERVICES_CARD_BUTTON_LABEL = 'Connect services';

/**
 * The last word of the setup, posted by Tlon after the invite card so it can't
 * land before it.
 *
 * The setup has been the agent doing things *to* the group; this hands the
 * conversation back, and says the part a scheduled job never shows: that the
 * thing it just built is also someone to talk to.
 */
export const INVITE_FOLLOWUP_MESSAGE =
  'I’m here to talk to or ask questions about what I find. What else would ' +
  'you like me to do?';

/**
 * Where a scheduled run's output goes, shared by every job that produces
 * something worth keeping.
 *
 * The notebook is the OWNER's channel, created by the owner's app on the
 * owner's ship the moment the group config lands with a job — the agent
 * only ever posts *into* it. The agent hosting its own notebook was the
 * original design and it was wrong twice over: the channel lived on the
 * bot's moon instead of with the owner's group, and each run's "find or
 * create" gave the model room to create the wrong notebook. Now the
 * first run waits briefly for the owner-side channel to appear, writes
 * into it, and records its nest; every later run appends to the same
 * place. Chat is the fallback when the notebook never appears, never a
 * bot-hosted channel.
 *
 * Part of the verbatim payload, so it is one string rather than three
 * paraphrases that can drift apart — which is exactly why it must stay
 * true for a run happening months from now. This string is stored in the
 * cron job and replayed at every firing, so it may not carry a word of
 * setup: a day-one deferral pinned in here told every future digest to do
 * the research, withhold the entry, and wait for a setup-only event, leaving
 * the scheduled run with nowhere to put its output.
 */
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

/**
 * The scheduled job each purpose sets up, templated so the operative cron
 * prompt is authored here deterministically. `prompt` is used verbatim as the
 * cron payload, so editing these strings edits what the job actually does on
 * every run.
 *
 * `{{topics}}` is replaced with the owner's topic reply, exactly as sent —
 * a submitted pill selection ("Peptides, Mycology") or whatever they typed.
 *
 * Every job runs **daily**, deliberately: a job the owner sees fire once a
 * week is a job they forget they have, and the whole point of the setup is
 * that something arrives tomorrow morning. Only the hour differs.
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
  {
    title: string;
    schedule: string;
    prompt: string;
    /**
     * What the day-one notebook entry should contain.
     *
     * Separate from `prompt` because the two describe different things.
     * `prompt` is the recurring run: for Tracking it reviews what the owner
     * logged "since the last check-in" and stops in chat when that is
     * nothing — which on day one is always, so using it as the entry
     * description told the model to write no entry at all while the closing
     * sat waiting for one.
     */
    entry: string;
  }
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

/**
 * Starting points for the topic step, per purpose.
 *
 * Suggestions, never a menu: the picker always carries "or just tell me", and
 * the agent reads a typed answer the same way it reads a submitted selection.
 * Kept to a word or two so they fit a pill.
 */
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
