import type { TlonCronService } from './cron-telemetry.js';
import type { PluginStateKeyedStore } from './plugin-state-types.js';
import { sharedMap, sharedSlot } from './shared-state.js';
import {
  type WorkspacePlan,
  type WorkspacePlanTap,
  buildWorkspacePlanBlob,
  newWorkspaceProposalId,
  parseWorkspacePlan,
  workspaceChannelCliKind,
  workspacePlanFallbackText,
} from './workspace-plan.js';

/**
 * One proposal per card. `approved` is set by the monitor when the owner taps
 * Create, so the model cannot create a proposed workspace on its own; the
 * progress fields let a retry finish a partial create instead of repeating it.
 */
export type WorkspaceProposal = {
  proposalId: string;
  ownerShip: string;
  plan: WorkspacePlan;
  status: 'open' | 'approved' | 'superseded' | 'created';
  proposedAt: number;
  groupId?: string;
  /** The chat create-owned makes, which becomes the plan's first channel. */
  defaultChannelNest?: string;
  secret?: boolean;
  /** Nest of each planned channel, by index, once it exists. */
  channelNests?: (string | null)[];
  /** The channels are in the card's order. */
  ordered?: boolean;
  taskJobId?: string;
};

export type WorkspaceProposalStore = Pick<
  PluginStateKeyedStore<WorkspaceProposal>,
  'register' | 'lookup' | 'entries'
>;

const storeSlot = sharedSlot<WorkspaceProposalStore>('workspacePlan.store');
const memoryRecords = sharedMap<string, WorkspaceProposal>(
  'workspacePlan.memoryRecords'
);
const memoryStore: WorkspaceProposalStore = {
  register: async (key, value) => {
    memoryRecords.set(key, value);
  },
  lookup: async (key) => memoryRecords.get(key),
  entries: async () =>
    [...memoryRecords.entries()].map(([key, value]) => ({
      key,
      value,
      createdAt: value.proposedAt,
    })),
};

/** Durable when the host has plugin state; in memory otherwise. */
export function setWorkspaceProposalStore(
  store: WorkspaceProposalStore | null
): void {
  storeSlot.set(
    store
      ? {
          // Plugin state rejects `undefined`; store JSON, as it will be read.
          register: (key, value) =>
            store.register(key, JSON.parse(JSON.stringify(value))),
          lookup: (key) => store.lookup(key),
          entries: () => store.entries(),
        }
      : null
  );
}

export function getWorkspaceProposalStore(): WorkspaceProposalStore {
  return storeSlot.get() ?? memoryStore;
}

/**
 * Records the owner's tap and returns the trusted note for the model's turn.
 * Only the owner's own DM messages reach this.
 */
export async function noteWorkspacePlanTap(
  tap: WorkspacePlanTap,
  store: WorkspaceProposalStore = getWorkspaceProposalStore()
): Promise<string> {
  const proposal = await store.lookup(tap.proposalId);
  if (!proposal) {
    return '\n[Workspace card: this card is no longer known to you, so nothing will be created from it. Say so in one line and offer to propose it again.]';
  }
  const title = JSON.stringify(proposal.plan.title);
  if (proposal.status === 'superseded') {
    return `\n[Workspace card: the owner tapped ${tap.action === 'create' ? 'Create' : 'Edit'} on the ${title} card, which a newer card replaced. Create nothing; say in one line to use the latest card.]`;
  }
  if (tap.action === 'edit') {
    if (proposal.status === 'created') {
      return `\n[Workspace card: the owner tapped Edit on ${title}, which is already created. Ask what to change and change the workspace itself with the tlon tool.]`;
    }
    return `\n[Workspace card: the owner tapped Edit on ${title}. Ask in one short line what to change. Once they answer, post the revised card with tlon_workspace_plan; it replaces this one. Create nothing yet.]`;
  }
  if (proposal.status === 'open') {
    await store.register(proposal.proposalId, {
      ...proposal,
      status: 'approved',
    });
  }
  return `\n[Workspace card: the owner tapped Create on ${title}. Call tlon_workspace_create with proposalId "${proposal.proposalId}" now and follow its result. Do not create the workspace or its channels with the tlon tool.]`;
}

export const workspacePlanToolMetadata = {
  name: 'tlon_workspace_plan',
  label: 'Tlon Workspace Plan',
  description:
    "Propose a new workspace in your owner's DM: posts your intro sentence and a card listing the workspace, its channels and an optional recurring task, with Edit and Create buttons. " +
    'Nothing is created until the owner taps Create; then you get a note to call tlon_workspace_create. ' +
    'A new card replaces any earlier open one. Owner DM only, never during first-run onboarding.',
  promptSnippet:
    "`tlon_workspace_plan`: propose a workspace for a project-like topic in your owner's DM",
  promptGuidelines: [
    'After the card posts, return NO_REPLY: the intro and card are your reply.',
  ],
};

const channelSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['chat', 'gallery', 'notebook'] },
    title: { type: 'string', maxLength: 40 },
    purpose: {
      type: 'string',
      maxLength: 120,
      description:
        'One line: what the channel holds and what you will start it with, such as "Three sourced references to start from".',
    },
  },
  required: ['kind', 'title', 'purpose'],
  additionalProperties: false,
} as const;

export const workspacePlanToolParameters = {
  type: 'object',
  properties: {
    intro: {
      type: 'string',
      maxLength: 300,
      description:
        'One sentence posted above the card, such as "I can keep all of that in one place. Here\'s a private workspace to start from."',
    },
    title: {
      type: 'string',
      maxLength: 60,
      description:
        'Short, specific workspace title inferred from the conversation, such as "Bike Parts" or "Lisbon Trip"; never generic.',
    },
    description: {
      type: 'string',
      maxLength: 200,
      description: 'One sentence on what the workspace is for.',
    },
    channels: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: channelSchema,
      description:
        'The channels to create, first one a chat. Each purpose is a promise: after Create you post that starter content.',
    },
    task: {
      type: 'object',
      description:
        'Optional recurring task that posts in the workspace chat, such as a weekly price check.',
      properties: {
        title: { type: 'string', maxLength: 40 },
        description: {
          type: 'string',
          maxLength: 120,
          description:
            'One line, such as "A weekly task: I look up prices and post changes".',
        },
        schedule: {
          type: 'string',
          description: 'Five-field cron expression, such as "0 9 * * 0".',
        },
        timezone: {
          type: 'string',
          description: "IANA timezone for the schedule: the owner's.",
        },
        prompt: {
          type: 'string',
          maxLength: 2000,
          description:
            'Self-contained instruction for each run; its output is posted to the workspace chat.',
        },
      },
      required: ['title', 'description', 'schedule', 'prompt'],
      additionalProperties: false,
    },
  },
  required: ['intro', 'title', 'description', 'channels'],
  additionalProperties: false,
} as const;

function textResult(text: string, error = false) {
  return {
    content: [{ type: 'text' as const, text }],
    details: error ? { error: true } : undefined,
  };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkspacePlanToolExecutor(deps: {
  ownerShip: () => string | undefined;
  postText: (target: string, text: string) => Promise<unknown>;
  postCard: (input: {
    target: string;
    fallbackText: string;
    blob: string;
  }) => Promise<unknown>;
  store?: () => WorkspaceProposalStore;
  now?: () => number;
}) {
  return async function execute(_id: string, params: unknown) {
    try {
      const ownerShip = deps.ownerShip();
      if (!ownerShip) throw new Error('no owner is configured for this bot');
      const parsed = parseWorkspacePlan(params);
      const { intro, ...plan } = parsed;
      const proposalId = newWorkspaceProposalId();
      const blob = buildWorkspacePlanBlob(proposalId, plan);
      const store = (deps.store ?? getWorkspaceProposalStore)();
      await store.register(proposalId, {
        proposalId,
        ownerShip,
        plan,
        status: 'open',
        proposedAt: (deps.now ?? Date.now)(),
      });
      await deps.postText(ownerShip, intro);
      await deps.postCard({
        target: ownerShip,
        fallbackText: workspacePlanFallbackText(plan),
        blob: JSON.stringify(blob),
      });
      // One open card at a time: a revision or a new topic replaces the last,
      // once the owner has the new card to tap instead.
      for (const { value } of await store.entries()) {
        if (
          value.proposalId !== proposalId &&
          value.ownerShip === ownerShip &&
          (value.status === 'open' ||
            (value.status === 'approved' && !value.groupId))
        ) {
          await store.register(value.proposalId, {
            ...value,
            status: 'superseded',
          });
        }
      }
      return textResult(
        `Posted the ${JSON.stringify(plan.title)} workspace card (proposal ${proposalId}). Nothing exists yet: it is created only when the owner taps Create. Return NO_REPLY now; the intro and card are your reply.`
      );
    } catch (error) {
      return textResult(`Error: ${errorText(error)}`, true);
    }
  };
}

export const workspaceCreateToolMetadata = {
  name: 'tlon_workspace_create',
  label: 'Tlon Workspace Create',
  description:
    'Create the workspace from a card the owner tapped Create on: a secret workspace with exactly the listed channels and recurring task. ' +
    'Call it only when a workspace-card note tells you to. Safe to call again: it finishes a partial create and never makes a second workspace.',
  promptSnippet:
    '`tlon_workspace_create`: create the workspace from a tapped workspace card',
  promptGuidelines: [],
};

export const workspaceCreateToolParameters = {
  type: 'object',
  properties: {
    proposalId: {
      type: 'string',
      description: 'The proposal id from the workspace-card note.',
    },
  },
  required: ['proposalId'],
  additionalProperties: false,
} as const;

export type TlonCommandResult = { ok: boolean; text: string };
export type WorkspaceTlonRunner = (
  toolCallId: string,
  command: string
) => Promise<TlonCommandResult>;

// Set by the plugin entry, which holds the tlon tool's owner routing; the
// create tool is a channel tool and has no access to it otherwise.
const tlonRunnerSlot = sharedSlot<WorkspaceTlonRunner>(
  'workspacePlan.tlonRunner'
);

export function setWorkspaceTlonRunner(runner: WorkspaceTlonRunner | null) {
  tlonRunnerSlot.set(runner);
}

export function getWorkspaceTlonRunner(): WorkspaceTlonRunner | undefined {
  return tlonRunnerSlot.get() ?? undefined;
}

/** Quotes one argument for the tlon tool's shell-style splitter. */
export function quoteTlonArg(value: string): string {
  return `"${value.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}

const GROUP_ID = /(~[a-z-]+\/[\w-]+)/;

function matchLine(text: string, label: string, pattern = /(\S+)/) {
  const line = text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(`${label}:`));
  return line
    ?.slice(label.length + 1)
    .trim()
    .match(pattern)?.[1];
}

export const WORKSPACE_TASK_DESCRIPTION_PREFIX = 'tlon-workspace:';

const createFlights = sharedMap<string, Promise<string>>(
  'workspacePlan.createFlights'
);

export function createWorkspaceCreateToolExecutor(deps: {
  runTlon: (toolCallId: string, command: string) => Promise<TlonCommandResult>;
  getCron: () => TlonCronService | undefined;
  store?: () => WorkspaceProposalStore;
}) {
  async function createOnce(id: string, proposalId: string): Promise<string> {
    const store = (deps.store ?? getWorkspaceProposalStore)();
    let proposal = await store.lookup(proposalId);
    if (!proposal) throw new Error(`no workspace card ${proposalId}`);
    const { plan } = proposal;
    const ref = () => `/1/group/${proposal!.groupId}`;
    const save = async (patch: Partial<WorkspaceProposal>) => {
      proposal = { ...proposal!, ...patch };
      await store.register(proposalId, proposal);
    };
    const run = async (command: string, step: string) => {
      const result = await deps.runTlon(id, command);
      if (!result.ok) throw new Error(`${step} failed: ${result.text}`);
      return result.text;
    };

    if (proposal.status === 'created') {
      return `Already created: ${JSON.stringify(plan.title)} exists and nothing new was made. Reply with one line and this on its own line:\n${ref()}`;
    }
    if (proposal.status === 'superseded') {
      throw new Error(
        'a newer card replaced this one; ask the owner to use the latest card'
      );
    }
    if (proposal.status !== 'approved') {
      throw new Error(
        'the owner has not tapped Create on this card; nothing was created'
      );
    }

    if (!proposal.groupId) {
      const command = [
        'groups create-owned',
        quoteTlonArg(plan.title),
        '--admin',
        proposal.ownerShip,
        '--description',
        quoteTlonArg(plan.description),
      ].join(' ');
      const result = await deps.runTlon(id, command);
      // A failed admin grant still made the group and its chat: remember
      // both, so a retry neither makes a second group nor adds a second chat.
      const groupId = result.ok
        ? matchLine(result.text, 'ID', GROUP_ID)
        : result.text.match(/Created (~[a-z-]+\/[\w-]+)/)?.[1];
      if (groupId) {
        await save({
          groupId,
          defaultChannelNest: result.ok
            ? matchLine(result.text, 'Channel')
            : result.text.match(/with its chat (chat\/~[a-z-]+\/[\w-]+)/)?.[1],
        });
      }
      if (!result.ok) {
        throw new Error(`creating the workspace failed: ${result.text}`);
      }
      if (!groupId) {
        throw new Error(
          `creating the workspace returned no group id: ${result.text}`
        );
      }
    }
    const groupId = proposal.groupId!;

    if (!proposal.secret) {
      await run(
        `groups set-privacy ${groupId} secret`,
        'making the workspace secret'
      );
      await save({ secret: true });
    }

    const nests = [...(proposal.channelNests ?? [])];
    for (const [index, channel] of plan.channels.entries()) {
      if (nests[index]) continue;
      const kind = workspaceChannelCliKind(channel.kind);
      // Notebooks take no description.
      const description =
        kind === 'notes'
          ? ''
          : ` --description ${quoteTlonArg(channel.purpose)}`;
      let nest: string | undefined;
      if (index === 0 && proposal.defaultChannelNest) {
        nest = proposal.defaultChannelNest;
        await run(
          `channels update ${nest} --title ${quoteTlonArg(channel.title)}${description}`,
          `naming ${channel.title}`
        );
      } else {
        const result = await deps.runTlon(
          id,
          `channels create ${groupId} ${quoteTlonArg(channel.title)} --kind ${kind}${description}`
        );
        if (!result.ok) {
          // A notebook whose verification failed is left in place: remember
          // it, so a retry does not make a second one.
          const made = result.text.match(
            /%notes created (notes\/~[a-z-]+\/[\w-]+)/
          )?.[1];
          if (made) {
            nests[index] = made;
            await save({ channelNests: nests });
          }
          throw new Error(`creating ${channel.title} failed: ${result.text}`);
        }
        const text = result.text;
        nest = matchLine(text, 'Nest');
        if (!nest) {
          throw new Error(
            `creating ${channel.title} returned no nest: ${text}`
          );
        }
      }
      nests[index] = nest;
      await save({ channelNests: nests });
    }

    // New channels go to the top of the list; put them in the card's order.
    if (!proposal.ordered) {
      for (const [index, nest] of nests.entries()) {
        await run(
          `groups move-channel ${groupId} ${nest} --section default --index ${index}`,
          'ordering the channels'
        );
      }
      await save({ ordered: true });
    }

    if (plan.task && !proposal.taskJobId) {
      const cron = deps.getCron();
      if (!cron) throw new Error('the scheduler is not available yet');
      const description = `${WORKSPACE_TASK_DESCRIPTION_PREFIX}${proposalId}`;
      const find = async () =>
        (await cron.list({ includeDisabled: true })).find(
          (job) => job.description === description
        );
      let job = await find();
      if (!job) {
        await cron.add({
          name: plan.task.title,
          description,
          enabled: true,
          schedule: {
            kind: 'cron',
            expr: plan.task.schedule,
            ...(plan.task.timezone ? { tz: plan.task.timezone } : {}),
          },
          sessionTarget: 'isolated',
          wakeMode: 'now',
          payload: { kind: 'agentTurn', message: plan.task.prompt },
          delivery: { mode: 'announce', channel: 'tlon', to: nests[0] },
        } as never);
        job = await find();
      }
      if (!job) throw new Error('scheduling the recurring task failed');
      await save({ taskJobId: job.id });
    }

    await save({ status: 'created' });
    const lines = [
      `Created ${JSON.stringify(plan.title)} (secret: only the owner and you).`,
      'Channels, each with the starter content its card line promised:',
      ...plan.channels.map(
        (channel, index) =>
          `- ${channel.title} (${channel.kind}) ${nests[index]}: ${channel.purpose}`
      ),
      ...(plan.task
        ? [
            `Recurring task "${plan.task.title}" scheduled (${plan.task.schedule}), posting to ${nests[0]}.`,
          ]
        : []),
      'Now post that starter content in each channel (gallery items one per post, notebook content as a note). Then reply here in one line, with this on its own line:',
      ref(),
    ];
    return lines.join('\n');
  }

  return async function execute(id: string, params: unknown) {
    const proposalId = String(
      (params as { proposalId?: unknown } | null)?.proposalId ?? ''
    ).trim();
    try {
      if (!proposalId) throw new Error('proposalId is required');
      // A double tap or a retry while this runs waits for the same create.
      let flight = createFlights.get(proposalId);
      if (!flight) {
        flight = createOnce(id, proposalId).finally(() =>
          createFlights.delete(proposalId)
        );
        createFlights.set(proposalId, flight);
      }
      return textResult(await flight);
    } catch (error) {
      return textResult(
        `Error: ${errorText(error)}\nTell the owner in one line what failed. Calling tlon_workspace_create again resumes from where it stopped.`,
        true
      );
    }
  };
}
