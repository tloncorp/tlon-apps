import { expect, test, vi } from 'vitest';
import {
  DurableClient,
  configureDurableClient,
  durablePostId,
} from '../client/durable';
import { searchMessages } from '../client/messageSearch';

function fixture() {
  const client = new DurableClient('brian');
  client.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [{ id: 'galen', contactId: '~nec', name: 'Galen' }],
    bot: { contactId: '~ten', name: 'Pi' },
    revision: 1,
    groups: [],
    rooms: [
      {
        id: 'private',
        channelId: '~nec',
        title: 'Galen',
        members: ['brian', 'galen'],
        groupId: null,
        kind: 'dm',
      },
    ],
  };
  configureDurableClient(client);
  return client;
}

test('search stays scoped to the configured user and registers cold reply aliases without marking messages read', async () => {
  const client = fixture();
  const request = vi.spyOn(client, 'request').mockResolvedValue({
    hits: [
      {
        roomId: 'private',
        message: {
          id: 'reply',
          seq: 22,
          sentAt: 1000,
          parentId: 'root',
          authorId: '~nec',
          text: 'needle preview',
          content: [{ inline: ['needle preview'] }],
        },
        parentAuthorId: '~sampel-palnet',
      },
      { roomId: 'not-in-my-bootstrap', message: {} },
    ],
    nextCursor: 'opaque-cursor',
  });
  const controller = new AbortController();
  const result = await searchMessages({
    query: 'needle',
    channelId: '~nec',
    authorId: '~nec',
    signal: controller.signal,
  });
  expect(request).toHaveBeenCalledWith(
    '/search?query=needle&room=private&author=%7Enec',
    undefined,
    controller.signal
  );
  expect(result.hits).toHaveLength(1);
  expect(result.hits[0]).toMatchObject({
    authorName: 'Galen',
    conversationTitle: 'Galen',
    post: {
      id: durablePostId('~nec', 'reply'),
      parentId: durablePostId('~nec', 'root'),
      sequenceNum: null,
    },
  });
  expect(result.nextCursor).toBe('opaque-cursor');
  expect(client.messageId('~nec', result.hits[0].post.id)).toBe('reply');
  expect(client.messageId('~nec', result.hits[0].post.parentId!)).toBe('root');
  await client.markRead('~nec');
  expect(request).toHaveBeenLastCalledWith('/state', {
    type: 'read',
    room: 'private',
    threadId: undefined,
    seq: 0,
  });
});
