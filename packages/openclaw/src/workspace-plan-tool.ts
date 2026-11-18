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
  /**
   * The bot's answer to the owner's message in the DM, posted as the bot's
   * first message in the workspace chat on Create.
   */
  answer?: string;
  /** The owner tapped Edit: the revised card keeps this card's answer. */
  editing?: boolean;
  /** The answer is posted in the workspace chat. */
  answerPosted?: boolean;
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
    if (!proposal.editing) {
      await store.register(proposal.proposalId, { ...proposal, editing: true });
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
    "Pass your full answer to the owner's message as `answer`, and the confirmation of any reminder you set up this turn as `confirmation`: the tool posts both after the card. Your own reply after the card is not delivered, so return NO_REPLY.",
  ],
};

export const WORKSPACE_ANSWER_MAX_LENGTH = 4000;
export const WORKSPACE_CONFIRMATION_MAX_LENGTH = 500;

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
        'One sentence posted above the card, such as "I can keep all of that in one place. Here\'s a private workspace to start from." Not a reminder confirmation: that goes in `confirmation`.',
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
    answer: {
      type: 'string',
      maxLength: WORKSPACE_ANSWER_MAX_LENGTH,
      description:
        "Your full answer to the owner's message. The tool posts it in the DM after the card, and it becomes your first message in the workspace chat when the owner taps Create. Your own reply after the card is not delivered, so everything the owner should read goes here or in `confirmation`. Leave out the card and any reminder confirmation.",
    },
    confirmation: {
      type: 'string',
      maxLength: WORKSPACE_CONFIRMATION_MAX_LENGTH,
      description:
        'The confirmation of a reminder, digest or schedule change you set up with cron this turn: the day, the time, the zone and its UTC offset, such as "Done: every Monday at 9:00 AM America/Los_Angeles (UTC-08:00)". The tool posts it after the answer. Leave it out when you set up nothing.',
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

/** An optional text field, trimmed but with its line breaks kept. */
function parseOptionalText(
  value: unknown,
  name: string,
  max: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  const text = value.trim();
  if (text.length > max) {
    throw new Error(`${name} must be at most ${max} characters`);
  }
  return text || undefined;
}

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
  /**
   * The schedules of cron jobs set up with the cron tool in this turn (not
   * workspace tasks), so a card can't schedule the same thing again on
   * Create.
   */
  recentSchedules?: () => Promise<Array<{ expr: string; tz?: string }>>;
  /**
   * Posts the answer the way replies are posted, as tlon_workspace_create
   * posts it in the workspace chat, so the two read the same. Defaults to
   * postText.
   */
  postAnswer?: (target: string, text: string) => Promise<unknown>;
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
      const store = (deps.store ?? getWorkspaceProposalStore)();
      if (plan.task && deps.recentSchedules) {
        // The same schedule, set up moments ago: the reminder the owner asked
        // for in this message. A different zone is a different schedule.
        const task = plan.task;
        const same = (await deps.recentSchedules()).some(
          (job) =>
            job.expr.trim() === task.schedule &&
            (!job.tz || !task.timezone || job.tz === task.timezone)
        );
        if (same) {
          throw new Error(
            `you already scheduled "${plan.task.schedule}" with the cron tool; leave the task out of the card so Create doesn't schedule it twice`
          );
        }
      }
      // A revision after Edit keeps the edited card's answer unless it brings
      // its own; an inherited answer is already in the DM.
      const input = (params ?? {}) as {
        answer?: unknown;
        confirmation?: unknown;
      };
      const givenAnswer = parseOptionalText(
        input.answer,
        'answer',
        WORKSPACE_ANSWER_MAX_LENGTH
      );
      const confirmation = parseOptionalText(
        input.confirmation,
        'confirmation',
        WORKSPACE_CONFIRMATION_MAX_LENGTH
      );
      const answer =
        givenAnswer ??
        (await store.entries())
          .map(({ value }) => value)
          .filter(
            (value) =>
              value.ownerShip === ownerShip &&
              value.status === 'open' &&
              value.editing
          )
          .sort((a, b) => b.proposedAt - a.proposedAt)[0]?.answer;
      const proposalId = newWorkspaceProposalId();
      const blob = buildWorkspacePlanBlob(proposalId, plan);
      await store.register(proposalId, {
        proposalId,
        ownerShip,
        plan,
        status: 'open',
        proposedAt: (deps.now ?? Date.now)(),
        ...(answer ? { answer } : {}),
      });
      await deps.postText(ownerShip, intro);
      await deps.postCard({
        target: ownerShip,
        fallbackText: workspacePlanFallbackText(plan),
        blob: JSON.stringify(blob),
      });
      // The answer and any confirmation follow the card, posted here: the
      // model's own reply after a card is not delivered (the reply hook drops
      // it), so the DM and the workspace chat carry the same answer. Best
      // effort: the card is up either way.
      const failed: string[] = [];
      for (const [label, text] of [
        ['answer', givenAnswer],
        ['confirmation', confirmation],
      ] as const) {
        if (!text) continue;
        try {
          await (deps.postAnswer ?? deps.postText)(ownerShip, text);
        } catch {
          failed.push(label);
        }
      }
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
      const posted = `Posted the ${JSON.stringify(plan.title)} workspace card (proposal ${proposalId}). Nothing exists yet: it is created only when the owner taps Create. `;
      // A failed post leaves the model's reply to carry it: the reply hook
      // delivers it this once (deliverReply).
      if (failed.length) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `${posted}Posting your ${failed.join(' and ')} failed, so reply with ${failed.length > 1 ? 'them' : 'it'} now; this reply is delivered.`,
            },
          ],
          details: { deliverReply: true },
        };
      }
      return textResult(
        posted +
          (givenAnswer || confirmation
            ? 'Your answer and any confirmation are posted after the card. '
            : '') +
          'Your own reply after the card is not delivered; return NO_REPLY now.'
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

/**
 * How recent a cron job counts as set up in this turn: a reminder set up just
 * before the card is proposed, not one from an earlier topic.
 */
export const WORKSPACE_RECENT_SCHEDULE_MS = 3 * 60 * 1000;

const createFlights = sharedMap<string, Promise<string>>(
  'workspacePlan.createFlights'
);

export function createWorkspaceCreateToolExecutor(deps: {
  runTlon: (toolCallId: string, command: string) => Promise<TlonCommandResult>;
  getCron: () => TlonCronService | undefined;
  /**
   * Mirror the bot's jobs into the owner's %steward task list. A job added
   * through the cron service fires no cron_changed, so without this the
   * workspace task never shows in the owner's app and can't be managed there.
   */
  syncTasks?: () => Promise<void>;
  /**
   * Posts text to the owner the way replies are posted, so a `/1/group/` path
   * becomes a group card. The tool posts the card itself: asked to end its
   * reply with the path, the model once wrote the owner's ship with the
   * fixture group's slug instead of the new workspace's.
   */
  postText?: (target: string, text: string) => Promise<unknown>;
  store?: () => WorkspaceProposalStore;
}) {
  /**
   * Post the workspace's card to the owner. Returns what the model should do
   * about the link: nothing when the card posted, or include it if it didn't.
   */
  async function postGroupCard(
    ownerShip: string,
    ref: string
  ): Promise<string> {
    if (deps.postText) {
      try {
        await deps.postText(ownerShip, ref);
        return "The workspace's card is already posted in the DM, so don't write its link, path or ID.";
      } catch {
        // Fall through: the model carries the link instead.
      }
    }
    return `Put this on its own line in that reply, exactly:\n${ref}`;
  }

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
      const link = await postGroupCard(proposal.ownerShip, ref());
      return `Already created: ${JSON.stringify(plan.title)} exists and nothing new was made. Say so in one line. ${link}`;
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

    // The DM answer opens the workspace chat, before the starter content.
    let answerNote: string | undefined;
    if (proposal.answer && !proposal.answerPosted) {
      if (deps.postText) {
        try {
          await deps.postText(nests[0]!, proposal.answer);
        } catch (error) {
          throw new Error(
            `posting your answer in ${nests[0]} failed: ${errorText(error)}`
          );
        }
        await save({ answerPosted: true });
      } else {
        answerNote = `Before anything else, post this in ${nests[0]}, exactly:\n${proposal.answer}`;
      }
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
      // Best effort: the task runs either way, and the next cron change or
      // gateway start mirrors it. syncTasks reports its own failure.
      await deps.syncTasks?.().catch(() => undefined);
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
      ...(answerNote
        ? [answerNote]
        : proposal.answerPosted
          ? [
              `${nests[0]} already opens with your answer from the DM; don't post it again.`,
            ]
          : []),
      'Now post that starter content in each channel (gallery items one per post, notebook content as a note). Then reply here in one line.',
      await postGroupCard(proposal.ownerShip, ref()),
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
