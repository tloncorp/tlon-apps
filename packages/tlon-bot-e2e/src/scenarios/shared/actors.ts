import type { RuntimeContext, ShipEndpoint } from '../../drivers/types.js';
import {
  TlonActorClient,
  type BotProfileInput,
  type PostRef,
  type PromptResult,
  type StateReader,
  type StoryInput,
} from '../../tlon/index.js';

export interface UploadBlobParams {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ScenarioActors {
  bot: ScenarioActor;
  owner: ScenarioActor;
  thirdParty: ScenarioActor;
}

export interface ScenarioActor {
  ship: string;
  endpoint: ShipEndpoint;
  state: StateReader;
  prompt(text: string, opts?: { timeoutMs?: number }): Promise<PromptResult>;
  sendDm(text: string): Promise<void>;
  sendChannelPost(params: {
    channelId: string;
    content: StoryInput;
    blob?: string;
    botProfile?: BotProfileInput;
  }): Promise<PostRef>;
  replyToPost(params: {
    channelId: string;
    parentId: string;
    parentAuthor: string;
    content: StoryInput;
    blob?: string;
    botProfile?: BotProfileInput;
  }): Promise<PostRef>;
  createGroupWithChannel(params: {
    title: string;
    members?: string[];
  }): Promise<{ groupId: string; chatChannel: string }>;
  setSettingsEntry(params: {
    bucket: string;
    key: string;
    value: unknown;
    desk?: string;
  }): Promise<void>;
  uploadBlob?(params: UploadBlobParams): Promise<string>;
  teardown(fn: () => Promise<void>): void;
}

type Teardown = () => Promise<void>;

const teardownRegistry = new WeakMap<ScenarioActors, Teardown[]>();

export function createScenarioActors(ctx: RuntimeContext): ScenarioActors {
  const teardowns: Teardown[] = [];
  const actors: ScenarioActors = {
    bot: createScenarioActor(ctx.endpoints.ships.zod, ctx.endpoints.ships.zod, teardowns),
    owner: createScenarioActor(ctx.endpoints.ships.ten, ctx.endpoints.ships.zod, teardowns),
    thirdParty: createScenarioActor(
      ctx.endpoints.ships.mug,
      ctx.endpoints.ships.zod,
      teardowns
    ),
  };
  teardownRegistry.set(actors, teardowns);
  return actors;
}

export async function runScenarioTeardowns(actors: ScenarioActors): Promise<void> {
  const teardowns = teardownRegistry.get(actors) ?? [];
  const errors: unknown[] = [];
  while (teardowns.length > 0) {
    const teardown = teardowns.pop();
    if (!teardown) {
      continue;
    }
    try {
      await teardown();
    } catch (error) {
      if (!isBenignTeardownError(error)) {
        errors.push(error);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Scenario teardown failed: ${errors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join('; ')}`
    );
  }
}

function createScenarioActor(
  endpoint: ShipEndpoint,
  botEndpoint: ShipEndpoint,
  teardowns: Teardown[]
): ScenarioActor {
  const client = new TlonActorClient({
    shipUrl: endpoint.hostUrl,
    shipName: endpoint.ship,
    code: endpoint.code,
  });
  const botShip = botEndpoint.ship;

  return {
    ship: endpoint.ship,
    endpoint,
    state: client.state,

    async prompt(text, opts = {}) {
      return client.promptDm(botShip, text, opts);
    },

    async sendDm(text) {
      await client.sendDm(botShip, text);
    },

    async sendChannelPost(params) {
      return client.sendChannelPost(params);
    },

    async replyToPost(params) {
      return client.replyToPost(params);
    },

    async createGroupWithChannel(params) {
      const group = await client.createGroupWithChannel(params);
      teardowns.push(async () => {
        try {
          await client.state.deleteGroup(group.groupId);
        } catch (error) {
          if (!isBenignTeardownError(error)) {
            throw error;
          }
        }
      });
      return group;
    },

    async setSettingsEntry(params) {
      await client.setSettingsEntry(params);
    },

    teardown(fn) {
      teardowns.push(fn);
    },
  };
}

function isBenignTeardownError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /TimeoutError:\s*(active|reconnected)/i.test(message);
}
