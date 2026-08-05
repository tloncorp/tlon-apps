import { describe, expect, test, vi } from 'vitest';

import { TlonActorClient } from './actor.js';

const api = vi.hoisted(() => ({
  addReaction: vi.fn(async () => {}),
  configureClient: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  Urbit: class {
    async connect(): Promise<void> {}
  },
  ...api,
  createGroup: vi.fn(),
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
