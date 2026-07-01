import {
  Urbit,
  configureClient,
  createGroup,
  deleteGroup,
  getChannelPosts,
  getCurrentUserId,
  getGroup,
  getGroups,
  getSettings,
  inviteGroupMembers,
  joinGroup,
  poke,
  scry,
  sendPost,
  sendReply,
} from '@tloncorp/api';
import type { Story } from '@tloncorp/api';
import { markdownToStory } from '@tloncorp/api/client/markdown';
import { da, scot } from '@urbit/aura';

import { sleep } from '../runtime/waiters.js';

export interface ShipCredentials {
  shipUrl: string;
  shipName: string;
  code: string;
}

export interface DmPost {
  authorId?: string;
  sequenceNum?: number | null;
  text: string;
}

export interface PromptResult {
  success: boolean;
  text?: string;
  error?: string;
}

export type StoryInput = Story | string;

export interface BotProfileInput {
  nickname: string;
  avatar: string;
}

export interface ChannelPost {
  id?: string;
  authorId?: string;
  sentAt?: number;
  sequenceNum?: number | null;
  text: string;
  content?: unknown;
}

export interface PostRef {
  channelId: string;
  id: string;
  authorId: string;
  text?: string;
  sentAt?: number;
  sequenceNum?: number | null;
}

export interface StateReader {
  connect(): Promise<void>;
  groups(): Promise<unknown[]>;
  group(flag: string): Promise<unknown | null>;
  settings(): Promise<unknown>;
  settingsBucket(desk: string, bucket: string): Promise<Record<string, unknown>>;
  channelPosts(channelId: string, count?: number): Promise<ChannelPost[]>;
  latestSequenceFrom(
    peerShip: string,
    authorShip: string,
    opts?: { strict?: boolean }
  ): Promise<number>;
  scry<T = unknown>(app: string, path: string): Promise<T>;
  poke(params: { app: string; mark: string; json: unknown }): Promise<void>;
  inviteToGroup(groupId: string, contactIds: string[]): Promise<void>;
  joinGroup(groupId: string): Promise<void>;
  isMemberOfGroup(groupId: string): Promise<boolean>;
  deleteGroup(groupId: string): Promise<void>;
}

let apiQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = apiQueue.then(fn, fn);
  apiQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export class TlonActorClient {
  readonly shipUrl: string;
  readonly shipName: string;
  readonly code: string;
  readonly state: StateReader;

  private readonly urbit: Urbit;
  private connected = false;

  constructor(credentials: ShipCredentials) {
    this.shipUrl = credentials.shipUrl;
    this.shipName = normalizeShip(credentials.shipName);
    this.code = credentials.code;
    this.urbit = new Urbit(this.shipUrl, this.code);
    (this.urbit as Urbit & { ship: string }).ship = this.shipName.slice(1);
    this.state = this.createStateReader();
  }

  async sendDm(toShip: string, message: string): Promise<void> {
    await this.ensureConnected();
    const targetShip = normalizeShip(toShip);
    const sentAt = Date.now();
    const id = `${this.shipName}/${scot('ud', da.fromUnix(sentAt))}`;
    const action = {
      ship: targetShip,
      diff: {
        id,
        delta: {
          add: {
            memo: {
              content: markdownToStory(message),
              author: this.shipName,
              sent: sentAt,
            },
            kind: null,
            time: null,
          },
        },
      },
    };

    await this.urbit.poke({ app: 'chat', mark: 'chat-dm-action', json: action });
  }

  async dmPostsWith(peerShip: string, count = 30): Promise<DmPost[]> {
    return this.state.channelPosts(normalizeShip(peerShip), count);
  }

  async promptDm(
    botShip: string,
    text: string,
    opts: { timeoutMs?: number } = {}
  ): Promise<PromptResult> {
    const bot = normalizeShip(botShip);
    let baseline: number;
    try {
      baseline = await this.latestSequenceFrom(bot, bot, { strict: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error:
          `Failed to capture DM baseline from ${bot} before sending prompt: ` +
          message,
      };
    }
    await this.sendDm(bot, text);
    const started = Date.now();
    const timeoutMs = opts.timeoutMs ?? 90_000;
    let lastError = '';

    while (Date.now() - started < timeoutMs) {
      await sleep(500);
      try {
        const posts = await this.dmPostsWith(bot, 30);
        const candidates = posts
          .filter((post) => post.authorId === bot)
          .filter((post) => post.text.length > 0)
          .filter(
            (post) =>
              typeof post.sequenceNum === 'number' &&
              post.sequenceNum > baseline
          );
        if (candidates.length > 0) {
          const latest = candidates.toSorted(
            (a, b) => (b.sequenceNum ?? -1) - (a.sequenceNum ?? -1)
          )[0];
          return { success: true, text: latest.text };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      success: false,
      error:
        `Timeout waiting for DM reply from ${bot} after ${timeoutMs}ms` +
        (lastError ? ` (last error: ${lastError})` : ''),
    };
  }

  async waitForNoDmFrom(
    botShip: string,
    baselineSequence: number,
    timeoutMs: number
  ): Promise<void> {
    const bot = normalizeShip(botShip);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await sleep(500);
      const posts = await this.dmPostsWith(bot, 30);
      const directReply = posts
        .filter((post) => post.authorId === bot)
        .filter((post) => post.text.length > 0)
        .find(
          (post) =>
            typeof post.sequenceNum === 'number' &&
            post.sequenceNum > baselineSequence
        );
      if (directReply) {
        throw new Error(
          `Unexpected direct DM reply from ${bot}: ${directReply.text.slice(0, 200)}`
        );
      }
    }
  }

  async latestSequenceFrom(
    peerShip: string,
    authorShip: string,
    opts: { strict?: boolean } = {}
  ): Promise<number> {
    return this.state.latestSequenceFrom(peerShip, authorShip, opts);
  }

  async sendChannelPost(params: {
    channelId: string;
    content: StoryInput;
    blob?: string;
    botProfile?: BotProfileInput;
  }): Promise<PostRef> {
    const sentAt = Date.now();
    const content = storyFromInput(params.content);
    await this.withClient(async () => {
      await sendPost({
        channelId: params.channelId,
        authorId: this.shipName,
        sentAt,
        content,
        blob: params.blob,
        botProfile: params.botProfile,
      });
    });

    return (
      (await this.findAuthoredPost(params.channelId, params.content, sentAt)) ?? {
        channelId: params.channelId,
        id: `${this.shipName}/${scot('ud', da.fromUnix(sentAt))}`,
        authorId: this.shipName,
        text: storyInputText(params.content),
        sentAt,
      }
    );
  }

  async replyToPost(params: {
    channelId: string;
    parentId: string;
    parentAuthor: string;
    content: StoryInput;
    blob?: string;
    botProfile?: BotProfileInput;
  }): Promise<PostRef> {
    const sentAt = Date.now();
    const content = storyFromInput(params.content);
    await this.withClient(async () => {
      await sendReply({
        channelId: params.channelId,
        parentId: params.parentId,
        parentAuthor: normalizeShip(params.parentAuthor),
        authorId: this.shipName,
        sentAt,
        content,
        blob: params.blob,
        botProfile: params.botProfile,
      });
    });

    return {
      channelId: params.channelId,
      id: `${this.shipName}/${scot('ud', da.fromUnix(sentAt))}`,
      authorId: this.shipName,
      text: storyInputText(params.content),
      sentAt,
    };
  }

  async createGroupWithChannel(params: {
    title: string;
    members?: string[];
  }): Promise<{ groupId: string; chatChannel: string }> {
    const slug = slugify(`${params.title}-${Date.now().toString(36)}-${randomId()}`);
    const groupId = `${this.shipName}/${slug}`;
    const chatChannel = `chat/${this.shipName}/${slug}-general`;
    const memberIds = params.members?.map(normalizeShip);

    await this.withClient(async () => {
      await createGroup({
        memberIds,
        group: {
          id: groupId,
          title: params.title,
          description: 'Shared E2E scenario group',
          hostUserId: getCurrentUserId(),
          currentUserIsHost: true,
          currentUserIsMember: true,
          channels: [
            {
              id: chatChannel,
              title: 'General',
              description: 'General chat',
              type: 'chat',
              groupId,
            },
          ],
        },
      });
    });

    return { groupId, chatChannel };
  }

  async setSettingsEntry(params: {
    bucket: string;
    key: string;
    value: unknown;
    desk?: string;
  }): Promise<void> {
    await this.state.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'put-entry': {
          desk: params.desk ?? 'moltbot',
          'bucket-key': params.bucket,
          'entry-key': params.key,
          value: params.value,
        },
      },
    });
  }

  async deleteSettingsEntry(params: {
    bucket: string;
    key: string;
    desk?: string;
  }): Promise<void> {
    await this.state.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'del-entry': {
          desk: params.desk ?? 'moltbot',
          'bucket-key': params.bucket,
          'entry-key': params.key,
        },
      },
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.urbit.connect();
    this.connected = true;
  }

  private async withClient<T>(fn: () => Promise<T>): Promise<T> {
    return runExclusive(async () => {
      await this.ensureConnected();
      configureClient({
        shipName: this.shipName.slice(1),
        shipUrl: this.shipUrl,
        getCode: async () => this.code,
        client: this.urbit,
      });
      return fn();
    });
  }

  private createStateReader(): StateReader {
    return {
      connect: async () => {
        await this.withClient(async () => {});
      },

      groups: async () => {
        return this.withClient(async () => getGroups());
      },

      group: async (flag: string) => {
        return this.withClient(async () => {
          try {
            return await getGroup(flag);
          } catch {
            return null;
          }
        });
      },

      settings: async () => {
        return this.withClient(async () => getSettings());
      },

      settingsBucket: async (desk: string, bucket: string) => {
        const raw = await this.state.scry<{
          all?: Record<string, Record<string, Record<string, unknown>>>;
          desk?: Record<string, Record<string, unknown>>;
        }>('settings', '/all');
        return raw?.all?.[desk]?.[bucket] ?? raw?.desk?.[bucket] ?? {};
      },

      channelPosts: async (channelId: string, count = 20) => {
        return this.withClient(async () => {
          const result = await getChannelPosts({
            channelId,
            count,
            mode: 'newest',
          });
          return (result.posts ?? []).map(postFromApi);
        });
      },

      latestSequenceFrom: async (
        peerShip: string,
        authorShip: string,
        opts: { strict?: boolean } = {}
      ) => {
        const author = normalizeShip(authorShip);
        let posts: ChannelPost[];
        try {
          posts = await this.state.channelPosts(normalizeShip(peerShip), 30);
        } catch (error) {
          if (opts.strict) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
              `Failed to read DM baseline for author ${author} in ` +
                `${normalizeShip(peerShip)}: ${message}`
            );
          }
          return -1;
        }
        return posts
          .filter((post) => post.authorId === author)
          .map((post) =>
            typeof post.sequenceNum === 'number' ? post.sequenceNum : -1
          )
          .reduce((max, sequence) => Math.max(max, sequence), -1);
      },

      scry: async <T = unknown>(app: string, scryPath: string): Promise<T> => {
        return this.withClient(async () => scry<T>({ app, path: scryPath }));
      },

      poke: async (params: { app: string; mark: string; json: unknown }) => {
        await this.withClient(async () => {
          await poke(params);
        });
      },

      inviteToGroup: async (groupId: string, contactIds: string[]) => {
        await this.withClient(async () => {
          await inviteGroupMembers({ groupId, contactIds: contactIds.map(normalizeShip) });
        });
      },

      joinGroup: async (groupId: string) => {
        await this.withClient(async () => {
          await joinGroup(groupId);
        });
      },

      isMemberOfGroup: async (groupId: string) => {
        return this.withClient(async () => {
          const groups = await getGroups();
          return (groups ?? []).some((group: any) => group.id === groupId);
        });
      },

      deleteGroup: async (groupId: string) => {
        await this.withClient(async () => {
          await deleteGroup(groupId);
        });
      },
    };
  }

  private async findAuthoredPost(
    channelId: string,
    content: StoryInput,
    sentAt: number
  ): Promise<PostRef | null> {
    const expected = storyInputText(content);
    if (!expected) {
      return null;
    }
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      await sleep(500);
      const posts = await this.state.channelPosts(channelId, 40);
      const found = posts.find((post) => {
        return (
          post.authorId === this.shipName &&
          (post.sentAt == null || post.sentAt >= sentAt - 2_000) &&
          post.text.includes(expected)
        );
      });
      if (found?.id) {
        return {
          channelId,
          id: found.id,
          authorId: this.shipName,
          text: found.text,
          sentAt: found.sentAt,
          sequenceNum: found.sequenceNum,
        };
      }
    }
    return null;
  }
}

export function actorFromEnv(prefix: string): TlonActorClient {
  return new TlonActorClient({
    shipUrl: requireEnv(`${prefix}_URL`),
    shipName: requireEnv(`${prefix}_SHIP`),
    code: requireEnv(`${prefix}_CODE`),
  });
}

export function botCredentialsFromEnv(): ShipCredentials {
  return {
    shipUrl: requireEnv('TLON_URL'),
    shipName: requireEnv('TLON_SHIP'),
    code: requireEnv('TLON_CODE'),
  };
}

export function normalizeShip(ship: string): string {
  const trimmed = String(ship || '').trim();
  return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
}

export function storyFromInput(input: StoryInput): Story {
  return typeof input === 'string' ? markdownToStory(input) : input;
}

export function storyInputText(input: StoryInput): string {
  if (typeof input === 'string') {
    return input.trim();
  }
  const parts: string[] = [];
  visitStoryValue(input, parts);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function postFromApi(post: unknown): ChannelPost {
  const raw = post as {
    id?: string;
    authorId?: string;
    sentAt?: number;
    sequenceNum?: number | null;
    textContent?: string | null;
    content?: unknown;
  };
  return {
    id: raw.id,
    authorId: raw.authorId,
    sentAt: raw.sentAt,
    sequenceNum: raw.sequenceNum,
    text: (raw.textContent ?? storyInputText((raw.content ?? []) as Story)).trim(),
    content: raw.content,
  };
}

function visitStoryValue(value: unknown, parts: string[]): void {
  if (typeof value === 'string') {
    parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      visitStoryValue(child, parts);
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.ship === 'string') {
    parts.push(normalizeShip(record.ship));
    return;
  }
  for (const child of Object.values(record)) {
    visitStoryValue(child, parts);
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `scenario-${randomId()}`;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
