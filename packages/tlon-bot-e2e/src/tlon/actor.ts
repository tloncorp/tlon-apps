import { Urbit, configureClient, getChannelPosts } from '@tloncorp/api';
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

  private readonly urbit: Urbit;
  private connected = false;

  constructor(credentials: ShipCredentials) {
    this.shipUrl = credentials.shipUrl;
    this.shipName = normalizeShip(credentials.shipName);
    this.code = credentials.code;
    this.urbit = new Urbit(this.shipUrl, this.code);
    (this.urbit as Urbit & { ship: string }).ship = this.shipName.slice(1);
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
    const peer = normalizeShip(peerShip);
    return runExclusive(async () => {
      await this.ensureConnected();
      configureClient({
        shipName: this.shipName.slice(1),
        shipUrl: this.shipUrl,
        getCode: async () => this.code,
        client: this.urbit,
      });
      const result = await getChannelPosts({
        channelId: peer,
        count,
        mode: 'newest',
      });
      return (result.posts ?? []).map((post) => {
        const raw = post as {
          authorId?: string;
          sequenceNum?: number | null;
          textContent?: string | null;
        };
        return {
          authorId: raw.authorId,
          sequenceNum: raw.sequenceNum,
          text: (raw.textContent ?? '').trim(),
        };
      });
    });
  }

  async promptDm(
    botShip: string,
    text: string,
    opts: { timeoutMs?: number } = {}
  ): Promise<PromptResult> {
    const bot = normalizeShip(botShip);
    const baseline = await this.latestSequenceFrom(bot, bot);
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

  async latestSequenceFrom(peerShip: string, authorShip: string): Promise<number> {
    const author = normalizeShip(authorShip);
    const posts = await this.dmPostsWith(peerShip, 30);
    return posts
      .filter((post) => post.authorId === author)
      .map((post) =>
        typeof post.sequenceNum === 'number' ? post.sequenceNum : -1
      )
      .reduce((max, sequence) => Math.max(max, sequence), -1);
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.urbit.connect();
    this.connected = true;
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
