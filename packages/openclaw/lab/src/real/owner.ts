import {
  A2UI,
  type PostBlobDataEntry,
  addMembersToRole,
  Urbit,
  appendToPostBlob,
  configureClient,
  createGroup,
  getChannelPosts,
  getCurrentUserId,
  getGroup,
  notesV1,
  parsePostBlob,
  sendPost,
} from '@tloncorp/api';
import { AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID } from '../../../src/agent-task-plan-tool.js';
import type { Choice } from '../types.js';

// Plays the Tlon app's part for the owner (~ten) against a sandbox bot:
// furnishing the onboarding group, the intro request, card taps and the
// automatic plan submission. Every blob is checked against the app's schema.

export type BotPost = {
  id: string;
  seq: number;
  text: string;
  /** Coordinator messages carry a post marker; model posts do not. */
  marker?: string;
  choice?: Choice & { surfaceId: string; componentId: string };
  plan?: {
    surfaceId: string;
    summary: string;
    context: Record<string, unknown> & { topics: string[] };
  };
  serviceSetup?: { surfaceId: string; providerId?: string };
  cite?: string;
};

type RawPost = {
  id: string;
  authorId: string;
  sequenceNum?: number | null;
  textContent?: string | null;
  blob?: string | null;
};

type Component = {
  id: string;
  component: string;
  text?: string;
  options?: { id: string; label: string }[];
  action?: { event: { name: string; context: Record<string, unknown> } };
  children?: string[];
  child?: string;
};

function blobEntries(blob: string | null | undefined) {
  if (!blob) return [];
  try {
    return parsePostBlob(blob) as { type: string; [key: string]: unknown }[];
  } catch {
    return [];
  }
}

/**
 * Build a post blob and read it back with the app's own parser, which drops
 * entries its schemas reject, so protocol drift fails here instead of later.
 */
function checkedBlob(...entries: PostBlobDataEntry[]) {
  let blob: string | undefined;
  for (const entry of entries) blob = appendToPostBlob(blob, entry);
  const parsed = parsePostBlob(blob!) as { type: string }[];
  for (const entry of entries) {
    if (!parsed.some((read) => read.type === entry.type)) {
      throw new Error(
        `${entry.type} failed the app's blob schema: ${JSON.stringify(entry)}`
      );
    }
  }
  return blob!;
}

/** Read one bot post the way the app would render it. */
export function readBotPost(post: RawPost): BotPost {
  const entries = blobEntries(post.blob);
  const read: BotPost = {
    id: post.id,
    seq: post.sequenceNum ?? 0,
    text: post.textContent ?? '',
  };
  const marker = entries.find(
    (entry) => entry.type === 'tlon-agent-post-marker'
  );
  if (marker) read.marker = String(marker.key);
  const surface = entries.find((entry) => entry.type === 'a2ui');
  if (surface && A2UI.validateBlobEntry(surface)) {
    const surfaceId =
      A2UI.getCreateMessage(surface)?.createSurface.surfaceId ?? '';
    const components = (A2UI.getUpdateMessage(surface)?.updateComponents
      .components ?? []) as unknown as Component[];
    const byId = new Map(components.map((c) => [c.id, c]));
    const texts = components
      .filter((c) => c.component === 'Text' && c.text)
      .map((c) => c.text!);
    const smallChoice = components.find((c) => c.component === 'SmallChoice');
    const provision = byId.get(AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID);
    if (smallChoice?.options) {
      read.choice = {
        question: texts[0] ?? read.text,
        options: smallChoice.options.map((option) => option.label),
        surfaceId,
        componentId: smallChoice.id,
      };
    } else if (
      provision?.action?.event.name === A2UI.action.provisionAgent &&
      provision.action.event.context
    ) {
      read.plan = {
        surfaceId,
        summary: texts.filter((text) => text !== 'Set up task').join('\n'),
        context: provision.action.event.context as NonNullable<
          BotPost['plan']
        >['context'],
      };
    } else if (surfaceId.startsWith('agent-service-setup-')) {
      read.serviceSetup = { surfaceId };
    }
  }
  return read;
}

/**
 * Copies of the app's provisioning rules (packages/app/ui/components/
 * ChatMessage/agentProvision.ts), which can't be imported at runtime from
 * here. owner.test.ts checks them against the app's own functions.
 */
export function provisionTimezone(
  timezoneOverride: string | undefined,
  deviceTimezone: string | undefined
) {
  return timezoneOverride?.trim() || deviceTimezone?.trim() || 'UTC';
}

export function provisionId(sourcePostId: string, payloadIdentity: string) {
  let hash = 2166136261;
  for (const character of payloadIdentity) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `auto-${(hash >>> 0).toString(36)}-${sourcePostId}`.slice(0, 128);
}

/** Plain composer text as a story: one paragraph, line breaks kept. */
function textStory(text: string) {
  const inline: unknown[] = [];
  text.split('\n').forEach((line, index) => {
    if (index) inline.push({ break: null });
    if (line) inline.push(line);
  });
  return [{ inline }];
}

export class OwnerApp {
  private readonly urbit: Urbit;
  private connected = false;
  private queue: Promise<unknown> = Promise.resolve();
  groupId = '';
  notebookNest = '';

  constructor(
    readonly credentials: { shipUrl: string; shipName: string; code: string },
    readonly botShip: string,
    readonly device: { timezone: string; locale: string }
  ) {
    this.urbit = new Urbit(credentials.shipUrl, credentials.code);
    (this.urbit as Urbit & { ship: string }).ship =
      credentials.shipName.slice(1);
  }

  /** @tloncorp/api keeps one global client; run each call as this owner. */
  private use<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      // A ship busy after a reset can drop a request; retry network errors.
      for (let attempt = 1; ; attempt++) {
        try {
          if (!this.connected) {
            await this.urbit.connect();
            this.connected = true;
          }
          configureClient({
            shipName: this.credentials.shipName.slice(1),
            shipUrl: this.credentials.shipUrl,
            getCode: async () => this.credentials.code,
            client: this.urbit,
          });
          return await fn();
        } catch (error) {
          const network = /fetch failed|ECONNRESET|ECONNREFUSED|socket/i.test(
            String((error as Error)?.message ?? error)
          );
          if (!network || attempt >= 5) throw error;
          this.connected = false;
          await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
        }
      }
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  close() {
    this.urbit.delete?.();
  }

  /** Every post in the DM with the bot, oldest first. */
  async dmPosts(count = 60): Promise<RawPost[]> {
    const result = await this.use(() =>
      getChannelPosts({ channelId: this.botShip, mode: 'newest', count })
    );
    return ([...(result.posts ?? [])] as RawPost[]).sort(
      (a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0)
    );
  }

  async botPostsAfter(seq: number) {
    return (await this.dmPosts())
      .filter(
        (post) =>
          post.authorId === this.botShip && (post.sequenceNum ?? 0) > seq
      )
      .map(readBotPost);
  }

  async latestSeq() {
    const posts = await this.dmPosts(5);
    return Math.max(0, ...posts.map((post) => post.sequenceNum ?? 0));
  }

  /** What the app does on first open: group, chat, notebook, intro request. */
  async furnish() {
    const me = this.credentials.shipName;
    const slug = `lab-${Date.now().toString(36)}`;
    const groupId = `${me}/${slug}`;
    await this.use(() =>
      createGroup({
        memberIds: [this.botShip],
        group: {
          id: groupId,
          title: 'My agent group',
          privacy: 'secret',
          hostUserId: getCurrentUserId(),
          currentUserIsHost: true,
          currentUserIsMember: true,
          channels: [
            {
              id: `chat/${me}/${slug}-general`,
              title: 'General',
              type: 'chat',
              groupId,
            },
          ],
        } as never,
      })
    );
    this.groupId = groupId;
    await this.waitForGroup();
    const notebook = await this.use(() =>
      notesV1.createGroupNotebook({
        title: 'Updates',
        group: { host: me, flagName: slug },
        readers: [],
      })
    );
    this.groupId = groupId;
    this.notebookNest = await this.findNotebookNest(notebook);
    const intro: PostBlobDataEntry = {
      type: 'tlon-agent-intro-request',
      version: 1,
      groupId,
      isFirstGroup: true,
      clientTimezone: this.device.timezone,
      clientLocale: this.device.locale,
      campaignVersion: 1,
      timezone: this.device.timezone,
    };
    await this.post([''], checkedBlob(intro));
    return { groupId, notebookNest: this.notebookNest };
  }

  private async waitForGroup() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const found = await this.use(() => getGroup(this.groupId))
        .then(() => true)
        .catch(() => false);
      if (found) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`group ${this.groupId} was never created`);
  }

  private async findNotebookNest(created: unknown) {
    for (let attempt = 0; attempt < 30; attempt++) {
      // A just-created group can 404 for a moment.
      const group = (await this.use(() => getGroup(this.groupId)).catch(
        () => ({})
      )) as { channels?: { id: string; type?: string }[] };
      const notes = group.channels?.find(
        (channel) => channel.type === 'notes' || channel.id.startsWith('notes/')
      );
      if (notes) return notes.id;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      `notebook never appeared in ${this.groupId}: ${JSON.stringify(created).slice(0, 200)}`
    );
  }

  /** The app grants the bot admin once it has joined the group. */
  async grantBotAdmin(timeoutMs = 120_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const group = (await this.use(() => getGroup(this.groupId)).catch(
        () => ({})
      )) as { members?: { contactId?: string; id?: string }[] };
      const joined = group.members?.some(
        (member) => (member.contactId ?? member.id) === this.botShip
      );
      if (joined) {
        await this.use(() =>
          addMembersToRole({
            groupId: this.groupId,
            roleId: 'admin',
            ships: [this.botShip],
          })
        );
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
  }

  private async post(content: string[] | string, blob?: string) {
    const text = Array.isArray(content) ? content.join('') : content;
    await this.use(() =>
      sendPost({
        channelId: this.botShip,
        authorId: this.credentials.shipName,
        sentAt: Date.now(),
        content: (text ? textStory(text) : []) as never,
        ...(blob ? { blob } : {}),
      })
    );
  }

  /** The owner types into the composer. */
  async type(text: string) {
    await this.post(text);
  }

  /** The owner picks an option on a choice card, as SmallChoice sends it. */
  async pick(card: BotPost, label: string) {
    if (!card.choice) throw new Error('not a choice card');
    const selection: PostBlobDataEntry = {
      type: 'tlon-a2ui-selection',
      version: 1,
      sourcePostId: card.id,
      surfaceId: card.choice.surfaceId,
      componentId: card.choice.componentId,
      clientTimezone: this.device.timezone,
      values: [label],
    };
    await this.post(label, checkedBlob(selection));
  }

  /** The app submits a plan card once, with no tap, as autoProvision does. */
  async autoProvision(card: BotPost) {
    if (!card.plan) throw new Error('not a plan card');
    const context = card.plan.context as Record<string, unknown> & {
      topics: string[];
      timezoneOverride?: string;
      interviewTimezone?: string;
    };
    const timezone = provisionTimezone(
      context.timezoneOverride,
      context.interviewTimezone ?? this.device.timezone
    );
    const selection: PostBlobDataEntry = {
      type: 'tlon-a2ui-selection',
      version: 1,
      sourcePostId: card.id,
      surfaceId: card.plan.surfaceId,
      componentId: AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID,
      values: context.topics,
    };
    const request = {
      type: 'tlon-agent-provision',
      version: 1,
      provisionId: provisionId(card.id, JSON.stringify(context)),
      groupId: this.groupId,
      ...(context.interviewStartMessageId
        ? { interviewStartMessageId: context.interviewStartMessageId }
        : {}),
      ...(context.interviewMessageId
        ? { interviewMessageId: context.interviewMessageId }
        : {}),
      purposeId: context.purposeId,
      purpose: context.purpose,
      ...(context.approach ? { approach: context.approach } : {}),
      topics: context.topics,
      timezone,
      scheduleHour: context.scheduleHour,
      scheduleMinute: context.scheduleMinute,
      ...(context.taskPrompt ? { taskPrompt: context.taskPrompt } : {}),
      ...(context.scheduleExpression
        ? { scheduleExpression: context.scheduleExpression }
        : {}),
      ...(context.scheduleDescription
        ? { scheduleDescription: context.scheduleDescription }
        : {}),
      notebookNest: this.notebookNest,
      notebookTitle: 'Updates',
    } as PostBlobDataEntry;
    await this.post(context.topics.join(', '), checkedBlob(request, selection));
    return request;
  }

  /** Notes in the onboarding notebook, newest first. */
  async notes() {
    const notes = (await this.use(() =>
      notesV1.listNotes(this.notebookNest)
    )) as { id?: string | number; title?: string; body?: string }[];
    return [...notes].reverse();
  }
}
