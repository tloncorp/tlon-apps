import { describe, expect, test, vi } from 'vitest';

import { TlonActorClient } from './actor.js';

const api = vi.hoisted(() => ({
  addReaction: vi.fn(async () => {}),
  configureClient: vi.fn(),
  createGroup: vi.fn(async () => {}),
}));

vi.mock('@tloncorp/api', () => ({
  Urbit: class {
    async connect(): Promise<void> {}
  },
  ...api,
  deleteGroup: vi.fn(),
  getChannelPosts: vi.fn(),
  getCurrentUserId: vi.fn(),
  getGroup: vi.fn(),
  getGroups: vi.fn(),
  getPostWithReplies: vi.fn(),
  getSettings: vi.fn(),
  inviteGroupMembers: vi.fn(),
  joinGroup: vi.fn(),
  poke: vi.fn(),
  scry: vi.fn(),
  sendPost: vi.fn(),
  sendReply: vi.fn(),
}));

vi.mock('@tloncorp/api/client/markdown', () => ({
  markdownToStory: vi.fn((text: string) => text),
}));

describe('TlonActorClient reactions', () => {
  test('delegates Unicode reactions with normalized actor arguments', async () => {
    const client = new TlonActorClient({
      shipUrl: 'http://127.0.0.1:12345',
      shipName: 'ten',
      code: 'code',
    });

    await client.addReact({
      channelId: 'chat/~ten/test',
      postId: '123',
      react: '👍',
      postAuthor: 'zod',
      parentId: '456',
      parentAuthorId: 'mug',
    });

    expect(api.addReaction).toHaveBeenCalledWith({
      channelId: 'chat/~ten/test',
      postId: '123',
      emoji: '👍',
      our: '~ten',
      postAuthor: '~zod',
      parentId: '456',
      parentAuthorId: '~mug',
    });
  });
});

describe('TlonActorClient createGroupWithChannel', () => {
  test('defaults to a chat nest and General title', async () => {
    const client = new TlonActorClient({
      shipUrl: 'http://127.0.0.1:12345',
      shipName: 'zod',
      code: 'code',
    });

    const { groupId, chatChannel } = await client.createGroupWithChannel({
      title: 'Probe group',
    });

    const [call] = api.createGroup.mock.calls.at(-1) as unknown as [
      { group: { channels: Array<Record<string, unknown>> } },
    ];
    expect(chatChannel).toBe(`chat/${groupId}-general`);
    expect(call.group.channels[0]).toMatchObject({
      id: chatChannel,
      title: 'General',
      type: 'chat',
      groupId,
    });
  });

  test('carries the channel kind in the nest prefix for diary channels', async () => {
    const client = new TlonActorClient({
      shipUrl: 'http://127.0.0.1:12345',
      shipName: 'zod',
      code: 'code',
    });

    const { groupId, chatChannel } = await client.createGroupWithChannel({
      title: 'Probe group',
      channelKind: 'diary',
      channelTitle: 'migrate-src-probe',
    });

    const [call] = api.createGroup.mock.calls.at(-1) as unknown as [
      { group: { channels: Array<Record<string, unknown>> } },
    ];
    expect(chatChannel).toBe(`diary/${groupId}-general`);
    expect(call.group.channels[0]).toMatchObject({
      id: chatChannel,
      title: 'migrate-src-probe',
      type: 'notebook',
      groupId,
    });
  });
});
