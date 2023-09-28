import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { isSameDay } from 'date-fns';
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import BTree from 'sorted-btree';

import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { useChatState, useWritWindow } from '@/state/chat/chat';
import { ChatWrit } from '@/types/chat';
import { ChatMessageProps } from '@/chat/ChatMessage/ChatMessage';

export type ChatWritTree = BTree<bigInt.BigInteger, ChatWrit>;

export interface ScrollerItemData extends ChatMessageProps {
  index: bigInt.BigInteger;
  prefixedElement?: ReactNode;
}

function getMessageItems({
  whom,
  scrollTo,
  messages,
  replying,
  prefixedElement,
}: {
  whom: string;
  scrollTo?: bigInt.BigInteger;
  messages: ChatWritTree;
  replying: boolean;
  prefixedElement: React.ReactNode;
}): [bigInt.BigInteger[], ScrollerItemData[], ChatWritTree] {
  const messagesWithoutReplies = messages.filter((k) => {
    if (replying) {
      return true;
    }
    return messages.get(k)?.memo.replying === null;
  });

  const ks: bigInt.BigInteger[] = Array.from(messagesWithoutReplies.keys());
  const min = messagesWithoutReplies.minKey() || bigInt();
  const es: ScrollerItemData[] = messagesWithoutReplies
    .toArray()
    .map<ScrollerItemData>(([index, writ]) => {
      const keyIdx = ks.findIndex((idx) => idx.eq(index));
      const lastWritKey = keyIdx > 0 ? ks[keyIdx - 1] : undefined;
      const lastWrit = lastWritKey ? messages.get(lastWritKey) : undefined;
      const newAuthor = lastWrit
        ? writ.memo.author !== lastWrit.memo.author ||
          'notice' in lastWrit.memo.content
        : true;
      const writDay = new Date(daToUnix(index));
      const lastWritDay = lastWritKey
        ? new Date(daToUnix(lastWritKey))
        : undefined;
      const newDay =
        lastWrit && lastWritDay ? !isSameDay(writDay, lastWritDay) : !lastWrit;

      return {
        index,
        whom,
        writ,
        hideReplies: replying,
        time: index,
        newAuthor,
        newDay,
        isLast: keyIdx === ks.length - 1,
        isLinked: scrollTo ? index.eq(scrollTo) : false,
        prefixedElement: index.eq(min) ? prefixedElement : undefined,
      };
    });
  return [ks, es, messagesWithoutReplies];
}

export type MessageFetchState = 'top' | 'bottom' | 'initial';

const DEBUG_FETCH = true;

function fetchDebugMessage(...args: unknown[]) {
  if (DEBUG_FETCH) {
    console.log('[useFetchMessages]', ...args);
  }
}

export default function useFetchMessages({
  whom,
  messages,
  scrollTo,
}: {
  whom: string;
  messages: ChatWritTree;
  scrollTo?: bigInt.BigInteger;
}) {
  const writWindow = useWritWindow(whom, scrollTo);
  const [fetchState, setFetchState] = useState<MessageFetchState>('initial');

  const fetchMessages = useCallback(
    async (newer: boolean, pageSize = STANDARD_MESSAGE_FETCH_PAGE_SIZE) => {
      fetchDebugMessage(
        'fetchMessages',
        newer ? 'newer' : 'older',
        'whom',
        whom,
        'scrolTo',
        scrollTo,
        pageSize
      );

      const newest = messages.maxKey();
      const seenNewest =
        newer && newest && writWindow && writWindow.loadedNewest;
      const oldest = messages.minKey();
      const seenOldest =
        !newer && oldest && writWindow && writWindow.loadedOldest;

      if (seenNewest || seenOldest) {
        fetchDebugMessage('skipping fetch, seen', newer ? 'newest' : 'oldest');
        return;
      }

      try {
        setFetchState(newer ? 'bottom' : 'top');
        if (newer) {
          fetchDebugMessage('load newer');
          const result = await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'newer', scrollTo);
          fetchDebugMessage('load result', result);
        } else {
          fetchDebugMessage('load older');
          const result = await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'older', scrollTo);
          fetchDebugMessage('load result', result);
        }

        setFetchState('initial');
      } catch (e) {
        console.log(e);
        setFetchState('initial');
      }
    },
    [whom, messages, scrollTo, writWindow]
  );

  return useMemo(
    () => ({
      fetchMessages,
      fetchState,
      // If there's no writWindow, we've loaded the newest we can load
      hasLoadedNewest: writWindow?.loadedNewest ?? true,
      hasLoadedOldest: writWindow?.loadedOldest ?? true,
    }),
    [fetchMessages, fetchState, writWindow]
  );
}

export function useMessageData({
  whom,
  scrollTo,
  messages,
  replying,
  prefixedElement,
}: {
  whom: string;
  scrollTo?: bigInt.BigInteger;
  messages: ChatWritTree;
  replying: boolean;
  prefixedElement: React.ReactNode;
}) {
  const [activeMessageKeys, activeMessageEntries, activeMessages] = useMemo(
    () =>
      getMessageItems({
        whom,
        scrollTo,
        messages,
        replying,
        prefixedElement,
      }),
    [whom, scrollTo, messages, replying, prefixedElement]
  );

  const { fetchMessages, fetchState, hasLoadedNewest, hasLoadedOldest } =
    useFetchMessages({
      whom,
      messages,
      scrollTo,
    });

  const [hasEverLoadedNewest, setHasEverLoadedNewest] = useState(false);
  const nextHasLoadedNewest = hasLoadedNewest || replying || hasEverLoadedNewest;
  useEffect(() => {
    if (nextHasLoadedNewest) {
      setHasEverLoadedNewest(true);
    }
  }, [nextHasLoadedNewest]);

  return {
    activeMessages,
    activeMessageKeys,
    activeMessageEntries,
    fetchMessages,
    fetchState,
    hasLoadedNewest:nextHasLoadedNewest,
    hasLoadedOldest: replying ? true : hasLoadedOldest,
  };
}
