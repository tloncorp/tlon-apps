import {
  Urbit,
  configureClient,
  getChannelPosts,
  getContacts,
  poke,
  scry,
  sendPost,
} from '@tloncorp/api';
import type { Story } from '@tloncorp/api';

export interface StateClientConfig {
  shipUrl: string;
  shipName: string;
  code: string;
}

export interface StateClient {
  connect(): Promise<void>;
  contacts(): Promise<unknown[]>;
  channelPosts(channelId: string, count?: number): Promise<unknown[]>;
  scry<T = unknown>(app: string, path: string): Promise<T>;
  poke(params: { app: string; mark: string; json: unknown }): Promise<void>;
  sendPost(params: { channelId: string; content: Story }): Promise<void>;
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

export function createStateClient(config: StateClientConfig): StateClient {
  const shipName = config.shipName.replace(/^~/, '');
  const urbit = new Urbit(config.shipUrl, config.code);
  (urbit as unknown as { ship: string }).ship = shipName;

  let connected = false;

  const withClient = async <T>(fn: () => Promise<T>) => {
    return runExclusive(async () => {
      if (!connected) {
        await urbit.connect();
        connected = true;
      }

      configureClient({
        shipName,
        shipUrl: config.shipUrl,
        getCode: async () => config.code,
        client: urbit,
      });

      return fn();
    });
  };

  return {
    async connect() {
      await withClient(async () => {});
    },

    async contacts() {
      return withClient(async () => getContacts());
    },

    async channelPosts(channelId: string, count = 20) {
      return withClient(async () => {
        const result = await getChannelPosts({
          channelId,
          count,
          mode: 'newest',
        });
        return result.posts ?? [];
      });
    },

    async scry<T = unknown>(app: string, path: string): Promise<T> {
      return withClient(async () => scry<T>({ app, path }));
    },

    async poke(params: { app: string; mark: string; json: unknown }) {
      return withClient(async () => {
        await poke(params);
      });
    },

    async sendPost(params: { channelId: string; content: Story }) {
      return withClient(async () => {
        await sendPost({
          channelId: params.channelId,
          authorId: `~${shipName}`,
          sentAt: Date.now(),
          content: params.content,
        });
      });
    },
  };
}
