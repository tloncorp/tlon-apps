import { randomBytes } from 'node:crypto';

import { A2UI, TLON_A2UI_CATALOG_ID, parsePostBlob } from '@tloncorp/api';

/**
 * A workspace the bot proposes in its owner's DM. The card lists exactly what
 * Create provisions; the plan is kept bot-side, so a tap cannot change it.
 */
export type WorkspacePlanChannelKind = 'chat' | 'gallery' | 'notebook';

export type WorkspacePlanChannel = {
  kind: WorkspacePlanChannelKind;
  title: string;
  /** One line: what the channel is for and what the bot will start it with. */
  purpose: string;
};

export type WorkspacePlanTask = {
  title: string;
  description: string;
  /** Five-field cron expression. */
  schedule: string;
  timezone?: string;
  prompt: string;
};

export type WorkspacePlan = {
  title: string;
  description: string;
  channels: WorkspacePlanChannel[];
  task?: WorkspacePlanTask;
};

export type WorkspacePlanToolParams = WorkspacePlan & {
  /** One sentence posted above the card. */
  intro: string;
};

export const WORKSPACE_PLAN_LIMITS = {
  titleLength: 60,
  descriptionLength: 200,
  introLength: 300,
  channelTitleLength: 40,
  purposeLength: 120,
  minChannels: 1,
  maxChannels: 6,
  taskPromptLength: 2000,
} as const;

export const WORKSPACE_PLAN_SURFACE_PREFIX = 'workspace-plan-';
export const WORKSPACE_PLAN_CREATE_ID = 'create';
export const WORKSPACE_PLAN_EDIT_ID = 'edit';

const CHANNEL_KIND_CLI: Record<WorkspacePlanChannelKind, string> = {
  chat: 'chat',
  gallery: 'heap',
  notebook: 'notes',
};

// The item icons arrived with the list-item hint; an app that predates them
// drops the icon and shows the item as text.
const CHANNEL_KIND_ICON: Record<WorkspacePlanChannelKind, string> = {
  chat: 'ChannelTalk',
  gallery: 'ChannelGalleries',
  notebook: 'ChannelNotebooks',
};

export function workspaceChannelCliKind(kind: WorkspacePlanChannelKind) {
  return CHANNEL_KIND_CLI[kind];
}

export function newWorkspaceProposalId(): string {
  return `${WORKSPACE_PLAN_SURFACE_PREFIX}${randomBytes(6).toString('hex')}`;
}

function requireText(value: unknown, name: string, max: number): string {
  const text =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) throw new Error(`${name} is required`);
  if (text.length > max) {
    throw new Error(`${name} must be at most ${max} characters`);
  }
  return text;
}

const CRON_FIELD = /^[\d*,/-]+$/;

function parseSchedule(value: unknown): string {
  const schedule = requireText(value, 'task.schedule', 100);
  const fields = schedule.split(' ');
  if (fields.length !== 5 || !fields.every((field) => CRON_FIELD.test(field))) {
    throw new Error(
      'task.schedule must be a five-field cron expression, such as "0 9 * * 0" for Sundays at 9:00'
    );
  }
  return schedule;
}

function parseTimezone(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  const timezone = requireText(value, 'task.timezone', 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new Error('task.timezone must be a valid IANA timezone');
  }
  return timezone;
}

/** Validates and normalizes a plan; throws with a message the model can fix. */
export function parseWorkspacePlan(params: unknown): WorkspacePlanToolParams {
  const input = (params ?? {}) as Record<string, unknown>;
  const L = WORKSPACE_PLAN_LIMITS;
  const title = requireText(input.title, 'title', L.titleLength);
  const description = requireText(
    input.description,
    'description',
    L.descriptionLength
  );
  const intro = requireText(input.intro, 'intro', L.introLength);
  if (!Array.isArray(input.channels)) {
    throw new Error('channels must be a list');
  }
  if (
    input.channels.length < L.minChannels ||
    input.channels.length > L.maxChannels
  ) {
    throw new Error(
      `channels must list ${L.minChannels} to ${L.maxChannels} channels`
    );
  }
  const channels = input.channels.map((raw, index) => {
    const channel = (raw ?? {}) as Record<string, unknown>;
    if (!['chat', 'gallery', 'notebook'].includes(String(channel.kind))) {
      throw new Error(
        `channels[${index}].kind must be chat, gallery or notebook`
      );
    }
    return {
      kind: channel.kind as WorkspacePlanChannelKind,
      title: requireText(
        channel.title,
        `channels[${index}].title`,
        L.channelTitleLength
      ),
      purpose: requireText(
        channel.purpose,
        `channels[${index}].purpose`,
        L.purposeLength
      ),
    };
  });
  // A new workspace always starts with a chat; the plan names it.
  if (channels[0].kind !== 'chat') {
    throw new Error('the first channel must be a chat');
  }
  const titles = channels.map((channel) => channel.title.toLowerCase());
  if (new Set(titles).size !== titles.length) {
    throw new Error('channel titles must be different');
  }
  let task: WorkspacePlanTask | undefined;
  if (input.task !== undefined && input.task !== null) {
    const raw = input.task as Record<string, unknown>;
    task = {
      title: requireText(raw.title, 'task.title', L.channelTitleLength),
      description: requireText(
        raw.description,
        'task.description',
        L.purposeLength
      ),
      schedule: parseSchedule(raw.schedule),
      prompt: requireText(raw.prompt, 'task.prompt', L.taskPromptLength),
    };
    const timezone = parseTimezone(raw.timezone);
    if (timezone) task.timezone = timezone;
  }
  return { intro, title, description, channels, ...(task ? { task } : {}) };
}

/** The card's text, for apps that cannot draw it. */
export function workspacePlanFallbackText(plan: WorkspacePlan): string {
  const lines = [
    `New workspace: ${plan.title}`,
    plan.description,
    ...plan.channels.map((channel) => `- ${channel.title}: ${channel.purpose}`),
    ...(plan.task ? [`- ${plan.task.title}: ${plan.task.description}`] : []),
    'Update Tlon to create it from this card.',
  ];
  return lines.join('\n');
}

export function workspacePlanCreateMessage(plan: WorkspacePlan) {
  return `Create the "${plan.title}" workspace`;
}

export function workspacePlanEditMessage(plan: WorkspacePlan) {
  return `Edit the "${plan.title}" workspace`;
}

export function buildWorkspacePlanBlob(
  proposalId: string,
  plan: WorkspacePlan
): A2UI.BlobEntry[] {
  const items = plan.channels.flatMap((channel, index) => [
    {
      id: `channel-${index}`,
      component: 'Text' as const,
      text: channel.title,
      icon: CHANNEL_KIND_ICON[channel.kind],
    },
    {
      id: `channel-${index}-purpose`,
      component: 'Text' as const,
      variant: 'caption' as const,
      text: channel.purpose,
    },
  ]);
  if (plan.task) {
    items.push(
      {
        id: 'task',
        component: 'Text' as const,
        text: plan.task.title,
        icon: 'Clock',
      },
      {
        id: 'task-description',
        component: 'Text' as const,
        variant: 'caption' as const,
        text: plan.task.description,
      }
    );
  }
  // Typed loosely: the published @tloncorp/api this plugin builds against may
  // predate the item icons, which an older app drops (see CHANNEL_KIND_ICON).
  const entry = {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: proposalId,
          catalogId: TLON_A2UI_CATALOG_ID,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: proposalId,
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: [
                'header',
                'title',
                'description',
                ...items.map((item) => item.id),
                'actions',
              ],
            },
            {
              id: 'header',
              component: 'Row',
              justify: 'spaceBetween',
              children: ['kicker', 'privacy'],
            },
            {
              id: 'kicker',
              component: 'Text',
              text: 'New workspace',
              role: 'kicker',
              icon: 'Lock',
            },
            {
              id: 'privacy',
              component: 'Text',
              text: 'Only you',
              role: 'status',
            },
            { id: 'title', component: 'Text', variant: 'h3', text: plan.title },
            { id: 'description', component: 'Text', text: plan.description },
            ...items,
            {
              id: 'actions',
              component: 'Row',
              children: [WORKSPACE_PLAN_EDIT_ID, WORKSPACE_PLAN_CREATE_ID],
            },
            {
              id: WORKSPACE_PLAN_EDIT_ID,
              component: 'Button',
              child: 'edit-label',
              variant: 'secondary',
              resultLabel: 'You asked for changes.',
              action: {
                event: {
                  name: A2UI.action.sendMessage,
                  context: { text: workspacePlanEditMessage(plan) },
                },
              },
            },
            { id: 'edit-label', component: 'Text', text: 'Edit' },
            {
              id: WORKSPACE_PLAN_CREATE_ID,
              component: 'Button',
              child: 'create-label',
              variant: 'primary',
              resultLabel: `You asked to create ${plan.title}.`,
              action: {
                event: {
                  name: A2UI.action.sendMessage,
                  context: { text: workspacePlanCreateMessage(plan) },
                },
              },
            },
            { id: 'create-label', component: 'Text', text: 'Create' },
          ],
        },
      },
    ],
  } as unknown as A2UI.BlobEntry;
  if (!A2UI.validateBlobEntry(entry)) {
    throw new Error('the workspace card is too large; shorten its text');
  }
  return [entry];
}

export type WorkspacePlanTap = {
  proposalId: string;
  action: 'create' | 'edit';
};

/** A tap on a workspace card's Edit or Create, from an owner message's blob. */
export function readWorkspacePlanTap(
  blob: string | null | undefined
): WorkspacePlanTap | undefined {
  if (!blob) return undefined;
  const selection = parsePostBlob(blob).find(
    (entry) =>
      entry.type === 'tlon-a2ui-selection' &&
      entry.surfaceId.startsWith(WORKSPACE_PLAN_SURFACE_PREFIX)
  );
  if (selection?.type !== 'tlon-a2ui-selection') return undefined;
  if (selection.componentId === WORKSPACE_PLAN_CREATE_ID) {
    return { proposalId: selection.surfaceId, action: 'create' };
  }
  if (selection.componentId === WORKSPACE_PLAN_EDIT_ID) {
    return { proposalId: selection.surfaceId, action: 'edit' };
  }
  return undefined;
}
