import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { isSameDay } from 'date-fns';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
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
      const newest = messages.maxKey();
      const seenNewest =
        newer && newest && writWindow && writWindow.loadedNewest;
      const oldest = messages.minKey();
      const seenOldest =
        !newer && oldest && writWindow && writWindow.loadedOldest;

      if (seenNewest || seenOldest) {
        return;
      }

      try {
        setFetchState(newer ? 'bottom' : 'top');

        if (newer) {
          await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'newer', scrollTo);
        } else {
          await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'older', scrollTo);
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
      hasLoadedNewest: writWindow?.loadedNewest,
      hasLoadedOldest: writWindow?.loadedOldest,
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

  return {
    activeMessages,
    activeMessageKeys,
    activeMessageEntries,
    fetchMessages,
    fetchState,
    hasLoadedNewest,
    hasLoadedOldest,
  };
}
