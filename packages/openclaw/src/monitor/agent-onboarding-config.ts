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

export const INVITE_CLOSING =
  'End by getting someone else in: invite them, warmly and once, to bring a ' +
  'friend or two into the group. Ask that instead of asking what they would ' +
  "change — they can change anything later. Tlon posts the group's invite " +
  'link as a card immediately after your message, so make the ask in words ' +
  'and stop there: never paste, invent, or promise a link yourself, and ' +
  'never tell them to go looking for one.';

/**
 * Giving the group an icon, in the same breath as naming it.
 *
 * Gated on the rename for a reason: that step already decides whether the
 * group still looks untouched, so an owner who named their own group keeps
 * their own icon too. Best effort — an image model may not be configured at
 * all, and a group with the default icon is a perfectly good group, while a
 * setup that stalls on a picture is not.
 */
export const GROUP_ICON_RULE =
  'When you rename it, give it an icon to match: generate one square image ' +
  'with the image tool — a simple emblem for the subject, flat, no text, ' +
  'legible at thumbnail size — then upload the file it produces with ' +
  '`tlon upload <path>` and pass the URL that prints to ' +
  '`tlon groups update <flag> --image "<url>"`. Only alongside the rename: ' +
  'if the owner already named the group, leave their icon alone. If the ' +
  'image tool is unavailable or anything in that chain fails, skip the icon ' +
  'without comment and carry on with the rest of the setup.';

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
 * Tracking is the one exception: its first scheduled run may be a day away,
 * so its confirmation creates the notebook immediately and seeds it with a
 * one-entry explanation of what will land there — the group shows where the
 * record lives without waiting a day, and the client's back button can route
 * through the channel list as soon as the notebook exists.
 *
 * Part of the verbatim payload, so it is one string rather than three
 * paraphrases that can drift apart.
 */
const OUTPUT_CHANNEL_RULE =
  "Post it to this group's notes channel — the notebook, whose nests look " +
  'like `notes/<host>/<name>`. If the group has no notes channel yet, ' +
  'create one in this group first (never a new group), named for the ' +
  'subject: `tlon channels create <flag> "<Title>" --kind notes`. Record ' +
  'its nest as this job\'s "outputNest" in the group config, so later runs ' +
  'go straight there and append to that same channel. Verify the notebook ' +
  'actually exists after creating it (`tlon notes show <nest>` answers) — ' +
  'some hosted ships report success without materializing anything, and ' +
  'entries written to a nest that does not exist vanish silently; treat a ' +
  'silent no-op exactly like the 404 below. Announce it in chat ' +
  'with a single line — the chat gets the announcement, the notebook gets ' +
  'the writing. Write the entry with the tlon tool — `notes note-create ' +
  '<nest> root "<Title>" --stdin` — not the message tool, which only posts ' +
  'chat and cannot carry a title. If that create fails with HTTP 404, this ' +
  'ship has no ' +
  "%notes desk (`tlon notes status` confirms it) — don't reach for `--kind " +
  "diary, which is retired, and don't create a group. Post the update in " +
  'this group\'s chat channel instead, record that nest as "outputNest", ' +
  'and say once — not every run — that the notebook is unavailable here ' +
  "and you'll move the updates into one when it is.";

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
      'until there is something real to put in it. Then list the sources you ' +
      'used, one line each, so they can see where it came from and tell you ' +
      'to add, drop, or swap one whenever they like — the closing ask below ' +
      'is the only question this message should end on. If the run ' +
      'degraded, name what was missing and what you would use once it works.',
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
    confirmation:
      "There's nothing to summarize yet, so don't run the job. Do create " +
      'the notebook now — the one exception to waiting for the first run, ' +
      'so the group shows where the record will live: `tlon channels ' +
      'create <flag> "<Title>" --kind notes`, named for the subject. ' +
      'Verify it exists (`tlon notes show <nest>` answers — some hosted ' +
      'ships report success without materializing anything; treat a silent ' +
      "no-op like the 404 case), then record its nest as this job's " +
      '"outputNest" in the group config. ' +
      'Seed it with a single entry titled "About this notebook" whose body ' +
      'is exactly: "Analysis and summaries of your {{topics}} entries will ' +
      'land in this notebook." — you may only rephrase the topic list ' +
      'itself so it reads naturally. If the create fails with HTTP 404 ' +
      '(no %notes desk here), skip the notebook and the seed entirely and ' +
      'leave "outputNest" empty — the scheduled run handles where output ' +
      'goes. Then ask the owner to log their first entry right now, in ' +
      "chat, in their own words, and confirm you've recorded it — leaving " +
      'the closing ask below as the only question, rather than also ' +
      'asking what else they want to track alongside: {{topics}}.',
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
    confirmation:
      'Run the job once right now, exactly as the scheduled run would — ' +
      'the owner should see a real first update, and that run is what ' +
      'creates the notes channel. ' +
      INLINE_FIRST_RUN +
      " Never fabricate: if you can't actually " +
      'research, say so in chat in one honest line, with what will arrive ' +
      'and when, and leave the notes channel uncreated until there is ' +
      'something real to put in it. Then list the sources you used, one line ' +
      'each, so they can see where it came from and tell you to add, drop, ' +
      'or swap one whenever they like — the closing ask below is the only ' +
      'question this message should end on. If the run degraded, name what ' +
      'was missing and what you would use once it works.',
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
