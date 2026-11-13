import type { Post } from '../types/models';
import { getDurableClient, type DurableMessage } from './durable';
import { durableMessageToPost } from './postsApi';

export interface MessageSearchOptions {
  query: string;
  channelId?: string;
  authorId?: string;
  cursor?: string;
  signal?: AbortSignal;
}
export interface MessageSearchHit {
  post: Post;
  parentAuthorId?: string;
  conversationTitle: string;
  authorName: string;
}
export interface MessageSearchPage {
  hits: MessageSearchHit[];
  nextCursor: string | null;
}

export async function searchMessages(
  options: MessageSearchOptions
): Promise<MessageSearchPage> {
  const client = getDurableClient();
  if (!client) throw new Error('Message search is unavailable on this backend');
  const query = new URLSearchParams({ query: options.query });
  if (options.channelId) query.set('room', client.room(options.channelId).id);
  if (options.authorId) query.set('author', options.authorId);
  if (options.cursor) query.set('cursor', options.cursor);
  const page = await client.request<{
    hits: {
      roomId: string;
      message: DurableMessage;
      parentAuthorId?: string;
    }[];
    nextCursor: string | null;
  }>(`/search?${query}`, undefined, options.signal);
  return {
    hits: page.hits.flatMap((hit) => {
      const room = client.bootstrap.rooms.find(
        (room) => room.id === hit.roomId
      );
      if (!room) return [];
      client.rememberId(room.channelId, hit.message.id);
      if (hit.message.parentId)
        client.rememberId(room.channelId, hit.message.parentId);
      const group = client.bootstrap.groups.find(
        (group) => group.id === room.groupId
      );
      const authorName =
        hit.message.authorId === client.bootstrap.bot?.contactId
          ? client.bootstrap.bot?.name
          : (client.bootstrap.people.find(
              (person) => person.contactId === hit.message.authorId
            )?.name ?? hit.message.authorId);
      return [
        {
          post: {
            ...durableMessageToPost(room.channelId, hit.message),
            groupId: room.groupId,
            sequenceNum: null,
          },
          parentAuthorId: hit.parentAuthorId,
          conversationTitle: group
            ? `${group.title} · ${room.title}`
            : room.title,
          authorName,
        },
      ];
    }),
    nextCursor: page.nextCursor,
  };
}
