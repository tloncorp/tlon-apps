// Explicit extension: consumers with node16/nodenext module resolution (the
// openclaw plugin) type-check this file directly and require it.
import type { GroupJobSchedule } from './groupAgentConfig.js';

export type TemplateChannelType = 'chat' | 'notebook' | 'gallery';

export interface TemplateChannel {
  type: TemplateChannelType;
  title: string;
  description: string;
}

/**
 * A recurring job declared by an agent template. `{subject}` placeholders are
 * substituted at group creation; channel indexes resolve to the created
 * channels' nests.
 */
export interface TemplateJob {
  id: string;
  titleTemplate: string;
  scheduleDefault: GroupJobSchedule;
  /** shown in the flow, e.g. "every morning at 7:00" */
  humanSchedule: string;
  promptTemplate: string;
  outputChannelIndex: number;
  announceChannelIndex?: number;
  checkIn?: { everyRuns: number };
}

/**
 * Agent configuration for a template. Templates with this set drive the
 * conversational onboarding flow; the group creation sheet ignores them.
 */
export interface GroupTemplateAgent {
  /** onboarding choice card: title line */
  cardTitle: string;
  /** onboarding choice card: description line */
  cardDescription: string;
  /** icon name from the shared icon set, rendered on the choice card */
  cardIcon: string;
  /** accent color key for the choice card icon: blue | green | indigo */
  cardColor: 'blue' | 'green' | 'indigo';
  /** the one question the agent asks after this template is picked */
  subjectPrompt: string;
  /** quieter follow-on line under the subject prompt */
  subjectPromptDetail: string;
  /** e.g. "{subject} Daily" — {subject} is the shortened, title-cased subject */
  groupTitleTemplate: string;
  purposeTemplate: string;
  instructionsTemplate: string;
  /** the agent's closing "here's the deal" message after the group is built */
  confirmationTemplate: string;
  jobs: TemplateJob[];
}

export interface GroupTemplate {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  channels: TemplateChannel[];
  agent?: GroupTemplateAgent;
}

export const groupTemplates = [
  {
    id: 'book-club',
    title: 'Book Club',
    subtitle: 'Discuss your latest reads',
    description: 'A group for discussing books and literature',
    icon: '📚',
    channels: [
      {
        type: 'chat',
        title: 'Book chat',
        description: 'Discuss books and literature',
      },
      {
        type: 'gallery',
        title: 'Now reading',
        description: "Share what you're currently reading",
      },
      {
        type: 'notebook',
        title: 'Reviews',
        description: 'Write and share book reviews',
      },
    ],
  },
  {
    id: 'cooking-club',
    title: 'Cooking Club',
    subtitle: 'Share recipes and cooking tips',
    description: 'A group for food lovers and home cooks',
    icon: '🍳',
    channels: [
      {
        type: 'chat',
        title: 'Food talk',
        description: 'Chat about cooking and food',
      },
      {
        type: 'gallery',
        title: 'Meal pics',
        description: 'Share photos of your culinary creations',
      },
      {
        type: 'notebook',
        title: 'Recipes',
        description: 'Collect and share your favorite recipes',
      },
    ],
  },
  {
    id: 'music',
    title: 'Music',
    subtitle: 'Share and discover new tunes',
    description: 'A group for music lovers and audiophiles',
    icon: '🎵',
    channels: [
      {
        type: 'chat',
        title: 'Tune talk',
        description: 'Discuss music and artists',
      },
      {
        type: 'gallery',
        title: 'Now listening',
        description: "Share what you're listening to",
      },
      {
        type: 'notebook',
        title: 'Playlists',
        description: 'Curate and share playlists',
      },
    ],
  },
  {
    id: 'running-club',
    title: 'Running Club',
    subtitle: 'Track your runs and stay motivated',
    description: 'A group for runners of all levels',
    icon: '🏃',
    channels: [
      {
        type: 'chat',
        title: 'Run chat',
        description: 'Chat about running and training',
      },
      {
        type: 'gallery',
        title: 'Run pics',
        description: 'Share photos from your runs',
      },
      {
        type: 'notebook',
        title: 'Goals',
        description: 'Track your running goals and progress',
      },
    ],
  },
  {
    id: 'cinema-club',
    title: 'Cinema Club',
    subtitle: 'Discuss and review films',
    description: 'A group for movie enthusiasts and film buffs',
    icon: '🎬',
    channels: [
      {
        type: 'chat',
        title: 'Film chat',
        description: 'Discuss movies and cinema',
      },
      {
        type: 'gallery',
        title: 'Now watching',
        description: "Share what you're currently watching",
      },
      {
        type: 'notebook',
        title: 'Reviews',
        description: 'Write and share film reviews',
      },
    ],
  },
  {
    id: 'garden-club',
    title: 'Garden Club',
    subtitle: 'Grow together',
    description: 'A group for gardeners and plant enthusiasts',
    icon: '🌱',
    channels: [
      {
        type: 'chat',
        title: 'Garden talk',
        description: 'Chat about gardening and plants',
      },
      {
        type: 'gallery',
        title: 'Plant pics',
        description: 'Share photos of your garden and plants',
      },
      {
        type: 'notebook',
        title: 'Tips, plans and schedules',
        description: 'Share gardening tips and track your plans',
      },
    ],
  },
] as const satisfies GroupTemplate[];

// Basic group template used for custom group creation
export const basicGroupTemplate = {
  id: 'basic-group',
  title: 'Basic Group',
  subtitle: 'A basic group with essential channels',
  description: 'A basic group with essential channels',
  icon: '✨',
  channels: [
    {
      type: 'chat',
      title: 'Chat',
      description: 'General chat',
    },
    {
      type: 'gallery',
      title: 'Gallery',
      description: 'Share images',
    },
    {
      type: 'notebook',
      title: 'Notebook',
      description: 'Share notes',
    },
  ],
} as const satisfies GroupTemplate;

/**
 * Templates that ship with an agent block. These drive the conversational
 * onboarding flow ("onboarding as group creation") and are intentionally kept
 * out of `groupTemplates` so the group creation sheet doesn't show them.
 */
export const agentGroupTemplates = [
  {
    id: 'agent-daily-digest',
    title: 'Daily Digest',
    subtitle: 'A short summary, every morning',
    description:
      'A short summary of anything you care about, posted every morning',
    icon: '📰',
    channels: [
      {
        type: 'chat',
        title: 'Chat',
        description: 'For talking',
      },
      {
        type: 'notebook',
        title: 'Daily digest',
        description: 'Where summaries land',
      },
    ],
    agent: {
      cardTitle: 'A daily digest',
      cardDescription:
        'A short summary of anything you care about, posted every morning.',
      cardIcon: 'ChannelNotebooks',
      cardColor: 'blue',
      subjectPrompt: 'Good. One question: what should I keep up with for you?',
      subjectPromptDetail:
        "A topic, a team, a place — anything. Say it however you'd say it to a person.",
      groupTitleTemplate: '{subject} Daily',
      purposeTemplate:
        'Keeps up with {subject} and posts a short digest every morning.',
      instructionsTemplate:
        'You are the resident agent of this group. Its purpose: keep up with {subject}. Post a short digest every morning in the Daily digest notebook. In chat, answer questions about {subject} briefly, grounded in what you actually found.',
      confirmationTemplate:
        "Here's the deal: every morning at 7 I'll post a digest about {subject} in the notebook. After a week I'll ask if you want it different. You can change any of this in the group's settings, anytime.",
      jobs: [
        {
          id: 'daily-digest',
          titleTemplate: 'Daily digest: {subject}',
          scheduleDefault: { kind: 'cron', expr: '0 7 * * *', tz: 'local' },
          humanSchedule: 'every morning at 7:00',
          promptTemplate:
            "Compile a short morning digest about {subject}: three to five bullets covering the most interesting developments since yesterday, each with a one-line takeaway. Post it to the Daily digest notebook, titled with today's date. Announce it in chat with a single line.",
          outputChannelIndex: 1,
          announceChannelIndex: 0,
          checkIn: { everyRuns: 7 },
        },
      ],
    },
  },
  {
    id: 'agent-tracking',
    title: 'Tracking',
    subtitle: 'Log things, see the picture over time',
    description:
      'You log a thing as it happens; the agent keeps the running picture over time',
    icon: '⏱️',
    channels: [
      {
        type: 'chat',
        title: 'Log',
        description: 'Log entries as they happen',
      },
    ],
    agent: {
      cardTitle: 'Tracking',
      cardDescription:
        'You log a thing as it happens. I keep the running picture over time.',
      cardIcon: 'Clock',
      cardColor: 'green',
      subjectPrompt: 'Good. One question: what should we keep track of?',
      subjectPromptDetail:
        "Workouts, expenses, moods, bakes — anything you'd jot down as it happens.",
      groupTitleTemplate: '{subject} Tracker',
      purposeTemplate:
        'Tracks {subject} as you log it and keeps the running picture over time.',
      instructionsTemplate:
        'You are the resident agent of this group. Its purpose: track {subject}. When the user logs an entry in chat, acknowledge it briefly and keep a consistent running record. Never invent entries.',
      confirmationTemplate:
        "Here's the deal: log {subject} in chat whenever it happens. I'll nudge you in the evening if the day's empty, and Monday mornings I'll post the week's picture. You can change any of this in the group's settings, anytime.",
      jobs: [
        {
          id: 'daily-checkin',
          titleTemplate: 'Daily check-in: {subject}',
          scheduleDefault: { kind: 'cron', expr: '0 18 * * *', tz: 'local' },
          humanSchedule: 'every evening at 6:00',
          promptTemplate:
            "If the user hasn't logged anything about {subject} today, ask one short, friendly question prompting an entry. If they have, stay quiet.",
          outputChannelIndex: 0,
        },
        {
          id: 'weekly-summary',
          titleTemplate: 'Weekly summary: {subject}',
          scheduleDefault: { kind: 'cron', expr: '0 9 * * 1', tz: 'local' },
          humanSchedule: 'Monday mornings at 9:00',
          promptTemplate:
            "Summarize the week's {subject} entries: totals, trends, and one observation worth acting on. Post it in chat.",
          outputChannelIndex: 0,
          checkIn: { everyRuns: 4 },
        },
      ],
    },
  },
  {
    id: 'agent-research',
    title: 'Research',
    subtitle: 'A standing deep-dive, kept current',
    description:
      'A standing deep-dive the agent keeps updated as new work comes out',
    icon: '🔎',
    channels: [
      {
        type: 'chat',
        title: 'Chat',
        description: 'For talking',
      },
      {
        type: 'notebook',
        title: 'Findings',
        description: 'Where research lands',
      },
    ],
    agent: {
      cardTitle: 'Research',
      cardDescription:
        'A standing deep-dive I keep updated as new work comes out.',
      cardIcon: 'Search',
      cardColor: 'indigo',
      subjectPrompt:
        "Good. One question: what's the standing question I should dig into?",
      subjectPromptDetail:
        "Phrase it however you'd ask a sharp research assistant.",
      groupTitleTemplate: '{subject} Research',
      purposeTemplate:
        'Maintains a standing deep-dive on {subject}, updated as new work comes out.',
      instructionsTemplate:
        'You are the resident agent of this group. Its purpose: research {subject}. Maintain a living deep-dive in the Findings notebook; update it when meaningfully new work appears rather than on a fixed clock. In chat, answer questions with citations to what you found.',
      confirmationTemplate:
        "Here's the deal: I'll keep a living deep-dive on {subject} in the Findings notebook and post when something meaningfully changes. You can change any of this in the group's settings, anytime.",
      jobs: [
        {
          id: 'weekly-deep-dive',
          titleTemplate: 'Research update: {subject}',
          scheduleDefault: { kind: 'cron', expr: '0 9 * * 1', tz: 'local' },
          humanSchedule: 'Monday mornings at 9:00',
          promptTemplate:
            'Review what came out about {subject} this week. If anything meaningfully changes the picture, post an update to the Findings notebook and announce it in chat with one line. If nothing did, stay quiet.',
          outputChannelIndex: 1,
          announceChannelIndex: 0,
          checkIn: { everyRuns: 4 },
        },
      ],
    },
  },
] as const satisfies GroupTemplate[];

/** An agent template, with its `agent` block and literal id preserved. */
export type AgentGroupTemplate = (typeof agentGroupTemplates)[number];

export type AgentGroupTemplateId = AgentGroupTemplate['id'];

export type GroupTemplateId =
  | (typeof groupTemplates)[number]['id']
  | AgentGroupTemplateId
  | typeof basicGroupTemplate.id;

const allTemplates = [
  ...groupTemplates,
  ...agentGroupTemplates,
  basicGroupTemplate,
];

export const defaultTemplateChannelTitles: ReadonlySet<string> = new Set(
  allTemplates.flatMap((t) => t.channels.map((c) => c.title))
);

export const groupTemplatesById = allTemplates.reduce(
  (acc, template) => {
    acc[template.id as GroupTemplateId] = template;
    return acc;
  },
  {} as Record<GroupTemplateId, GroupTemplate>
);

/**
 * Shorten a free-form subject ("sourdough baking — recipes, technique, good
 * writing") to a name-worthy fragment ("Sourdough Baking"): first clause,
 * capped at three words, title-cased.
 */
export function shortenAgentSubject(subject: string): string {
  const firstClause = subject
    .split(/[—–:;,.\n(]/)[0]
    .trim()
    .replace(/\s+/g, ' ');
  const words = firstClause.split(' ').slice(0, 3);
  const titled = words
    .filter((w) => w.length > 0)
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
  return titled || subject.trim().slice(0, 24);
}

export function deriveAgentGroupTitle(
  subject: string,
  template: GroupTemplate
): string {
  const titleTemplate = template.agent?.groupTitleTemplate ?? '{subject}';
  return titleTemplate.replace('{subject}', shortenAgentSubject(subject));
}
