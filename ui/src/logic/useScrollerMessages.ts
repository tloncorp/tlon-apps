import { daToUnix } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useMemo, useRef } from 'react';
import { Writ, WritTuple } from '@/types/dms';
import {
  newReplyMap,
  PageTuple,
  Post,
  Reply,
  ReplyTuple,
} from '@/types/channel';

export type WritArray = [BigInteger, Writ | Post | Reply | null][];

const getMessageAuthor = (writ: Writ | Post | Reply) => {
  if ('memo' in writ) {
    return writ.memo.author;
  }
  return writ.essay.author;
};

const emptyWrit: Writ = {
  seal: {
    id: '',
    time: '',
    replies: newReplyMap(),
    reacts: {},
    meta: {
      replyCount: 0,
      lastRepliers: [],
      lastReply: null,
    },
  },
  essay: {
    content: [],
    author: window.our,
    sent: Date.now(),
    'kind-data': {
      chat: null,
    },
  },
};

export type ChatMessageListItemData = {
  writ: Writ | Post | Reply;
  type: 'message';
  time: bigInt.BigInteger;
  newAuthor: boolean;
  newDay: boolean;
  whom: string;
  isLast: boolean;
  isLinked: boolean;
  hideReplies: boolean;
};

function useMessageItems({
  messages,
}: {
  scrollTo?: bigInt.BigInteger;
  messages: WritArray;
}): [
  bigInt.BigInteger[],
  {
    time: bigInt.BigInteger;
    newAuthor: boolean;
    newDay: boolean;
    writ: Writ | Post | Reply;
  }[],
  WritArray
] {
  const messageDays = useRef(new Map<string, number>());

  function getDay(id: string, time: bigInt.BigInteger) {
    let day = messageDays.current.get(id);
    if (!day) {
      day = new Date(daToUnix(time)).setHours(0, 0, 0, 0);
      messageDays.current.set(id, day);
    }
    return day;
  }

  const [keys, entries] = useMemo(() => {
    const nonNullMessages = messages.filter(([_k, v]) => v !== null);
    const ks: bigInt.BigInteger[] = nonNullMessages.map(([k]) => k);
    const es = nonNullMessages.map(([key, writ]) => {
      if (!writ) {
        return {
          writ: emptyWrit,
          hideReplies: true,
          time: key,
          newAuthor: false,
          newDay: false,
          isLast: false,
          isLinked: false,
        };
      }

      const lastWrit = nonNullMessages[nonNullMessages.length - 1];
      if ('memo' in writ) {
        const newAuthor =
          lastWrit && lastWrit[1]
            ? getMessageAuthor(writ) !== getMessageAuthor(lastWrit[1])
            : true;
        const newDay =
          !lastWrit[1] ||
          !(
            getDay(lastWrit[1]?.seal.id, lastWrit[0]) ===
            getDay(writ.seal.id, key)
          );
        return {
          writ,
          time: key,
          newAuthor,
          newDay,
        };
      }

      const han = writ.essay['kind-data'];
      const newAuthor =
        lastWrit && lastWrit[1]
          ? getMessageAuthor(writ) !== getMessageAuthor(lastWrit[1]) ||
            !!('chat' in han && han.chat && 'notice' in han.chat)
          : true;
      const newDay =
        !lastWrit[1] ||
        !(
          getDay(lastWrit[1]?.seal.id, lastWrit[0]) ===
          getDay(writ.seal.id, key)
        );
      return {
        writ,
        time: key,
        newAuthor,
        newDay,
      };
    }, []);
    return [ks, es];
  }, [messages]);

  return useMemo(() => [keys, entries, messages], [keys, entries, messages]);
}

export type MessageFetchState = 'top' | 'bottom' | 'initial';

export function useMessageData({
  whom,
  scrollTo,
  messages,
  replying,
}: {
  whom: string;
  scrollTo?: bigInt.BigInteger;
  messages: WritArray;
  replying: boolean;
}) {
  const [activeMessageKeys, messageEntries, activeMessages] = useMessageItems({
    messages,
  });

  const activeMessageEntries: ChatMessageListItemData[] = useMemo(
    () =>
      messageEntries.map((props, index) => ({
        type: 'message',
        whom,
        isLast: index === messageEntries.length - 1,
        isLinked: !!scrollTo && (props.time?.eq(scrollTo) ?? false),
        hideReplies: replying,
        ...props,
      })),
    [whom, scrollTo, messageEntries, replying]
  );

  return {
    activeMessages,
    activeMessageKeys,
    activeMessageEntries,
  };
}
