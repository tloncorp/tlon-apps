import { useInfiniteQuery } from '@tanstack/react-query';
import {
  searchMessages,
  type MessageSearchHit,
} from '@tloncorp/api/client/messageSearch';
import { getDurableClient } from '@tloncorp/api/client/durable';
import { useMemo } from 'react';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { useDebouncedValue } from '../logic/utilHooks';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const logger = createDevLogger('message search', false);
export const MESSAGE_SEARCH_QUERY_KEY = 'messageSearch';

export function useMessageSearchSupported(): boolean {
  return Boolean(getDurableClient());
}

export function useMessageSearch({
  query,
  channelId,
  authorId,
  enabled = true,
}: {
  query: string;
  channelId?: string;
  authorId?: string;
  enabled?: boolean;
}) {
  const client = getDurableClient();
  const text = useDebouncedValue(query.trim(), 250);
  const result = useInfiniteQuery({
    queryKey: [
      MESSAGE_SEARCH_QUERY_KEY,
      useKeyFromQueryDeps(db.getChannel),
      client?.user,
      text,
      channelId,
      authorId,
    ],
    enabled: Boolean(client) && enabled && Boolean(text),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const started = performance.now();
      const context = {
        queryLength: text.length,
        conversationFiltered: Boolean(channelId),
        authorFiltered: Boolean(authorId),
      };
      logger.trackEvent('Message Search Started', context);
      try {
        const page = await searchMessages({
          query: text,
          channelId,
          authorId,
          cursor: pageParam,
          signal,
        });
        logger.trackEvent('Message Search Completed', {
          ...context,
          durationMs: performance.now() - started,
          resultCount: page.hits.length,
        });
        return page;
      } catch (error) {
        if (!signal.aborted)
          logger.trackError('Message search failed', { ...context, error });
        throw error;
      }
    },
    retry: 1,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
  });
  const rooms = client?.bootstrap.rooms;
  const hits = useMemo(() => {
    const found = new Map<string, MessageSearchHit>();
    for (const page of result.data?.pages ?? [])
      for (const hit of page.hits)
        if (rooms?.some((room) => room.channelId === hit.post.channelId))
          found.set(hit.post.id, hit);
    return [...found.values()];
  }, [result.data, rooms]);
  return {
    ...result,
    hits,
    available: Boolean(client),
    waiting: query.trim() !== text,
    conversations:
      client?.bootstrap.rooms.map((room) => ({
        id: room.channelId,
        title: room.groupId
          ? `${client.bootstrap.groups.find((group) => group.id === room.groupId)?.title} · ${room.title}`
          : room.title,
      })) ?? [],
    authors: client
      ? [
          ...client.bootstrap.people.map((person) => ({
            id: person.contactId,
            name: person.name,
          })),
          ...(client.bootstrap.bot
            ? [
                {
                  id: client.bootstrap.bot.contactId,
                  name: client.bootstrap.bot.name,
                },
              ]
            : []),
        ]
      : [],
  };
}
