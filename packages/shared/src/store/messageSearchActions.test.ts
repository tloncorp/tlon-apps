import { expect, test, vi } from 'vitest';
import {
  DurableClient,
  configureDurableClient,
  durablePostId,
} from '@tloncorp/api/client/durable';
import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import { prepareMessageSearchResult } from './messageSearchActions';

setupDatabaseTestSuite();
async function fixture() {
  const client = new DurableClient('brian');
  client.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [],
    bot: { contactId: '~ten', name: 'Pi' },
    revision: 0,
    groups: [],
    rooms: [
      {
        id: 'private',
        channelId: '~nec',
        title: 'Galen',
        kind: 'dm',
        groupId: null,
        members: ['brian', 'galen'],
      },
    ],
  };
  configureDurableClient(client);
  await db.insertContacts([{ id: '~nec' }, { id: '~bud' }]);
  await db.insertChannels([
    { id: '~nec', type: 'dm', contactId: '~nec', currentUserIsMember: true },
  ]);
  const parent = {
    id: 'root',
    seq: 1,
    sentAt: 1,
    authorId: '~nec',
    text: 'Parent',
    content: [{ inline: ['Parent'] }],
  };
  const target = {
    id: 'reply',
    seq: 22,
    sentAt: 22,
    authorId: '~bud',
    parentId: 'root',
    text: 'Actual reply',
    content: [{ inline: ['Actual reply'] }],
  };
  client.rememberId('~nec', 'root');
  client.rememberId('~nec', 'reply');
  vi.spyOn(client, 'message').mockImplementation(async (_channel, id) =>
    id === durablePostId('~nec', 'reply') ? target : parent
  );
  const window = vi.spyOn(client, 'window').mockResolvedValue({
    messages: [target],
    cursor: 22,
    newestSequenceNum: 1,
    older: 1,
    newer: null,
  });
  const hit = {
    post: {
      id: durablePostId('~nec', 'reply'),
      channelId: '~nec',
      authorId: '~bud',
      parentId: durablePostId('~nec', 'root'),
      sentAt: 22,
      receivedAt: 22,
      type: 'reply' as const,
      textContent: 'Preview',
    },
    authorName: 'Dan',
    conversationTitle: 'Galen',
  };
  return { client, parent, target, window, hit };
}

test('opening a cold reply hydrates a bounded window and navigates using its actual parent author', async () => {
  const f = await fixture();
  const result = await prepareMessageSearchResult(f.hit);
  expect(f.window).toHaveBeenCalledWith('~nec', {
    mode: 'around',
    anchor: 22,
    parentId: 'root',
    count: 50,
  });
  expect(result.parent).toMatchObject({
    id: durablePostId('~nec', 'root'),
    authorId: '~nec',
  });
  expect(result.selectedPostId).toBe(durablePostId('~nec', 'reply'));
  expect(
    (await db.getPost({ postId: result.selectedPostId }))?.textContent
  ).toBe('Actual reply');
});

test('an obsolete deleted result cannot navigate or populate the post cache', async () => {
  const f = await fixture();
  vi.mocked(f.client.message).mockResolvedValue({ ...f.target, deleted: true });
  await expect(prepareMessageSearchResult(f.hit)).rejects.toThrow('deleted');
  expect(f.window).not.toHaveBeenCalled();
  expect(await db.getPost({ postId: f.hit.post.id })).toBeFalsy();
});
