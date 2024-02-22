import { Post, Reply } from '@tloncorp/shared/dist/urbit/channel';
import { Writ } from '@tloncorp/shared/dist/urbit/dms';
import { daToUnix } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useMemo, useRef } from 'react';

import getKindDataFromEssay from './getKindData';

export type WritArray = [BigInteger, Writ | Post | Reply | null][];

const getMessageAuthor = (writ: Writ | Post | Reply) => {
  if ('memo' in writ) {
    return writ.memo.author;
  }
  return writ.essay.author;
};

function getDay(
  id: string,
  time: bigInt.BigInteger,
  messageDays: Map<string, number>
) {
  let day = messageDays.get(id);
  if (!day) {
    day = new Date(daToUnix(time)).setHours(0, 0, 0, 0);
    messageDays.set(id, day);
  }
  return day;
}

const getNewDayAndNewAuthorFromLastWrit = (
  messages: WritArray,
  writ: Writ | Post | Reply,
  key: bigInt.BigInteger,
  messageDays: Map<string, number>,
  index: number
) => {
  const lastWrit = index === 0 ? undefined : messages[index - 1];
  const newAuthor =
    lastWrit && lastWrit[1]
      ? getMessageAuthor(writ) !== getMessageAuthor(lastWrit[1]) ||
        ('essay' in lastWrit[1] &&
          !!getKindDataFromEssay(lastWrit[1].essay).notice)
      : true;
  const newDay =
    !lastWrit ||
    !(
      lastWrit[1] &&
      getDay(lastWrit[1]?.seal.id, lastWrit[0], messageDays) ===
        getDay(writ.seal.id, key, messageDays)
    );
  return {
    writ,
    time: key,
    newAuthor,
    newDay,
  };
};

const emptyWrit = {
  seal: {
    id: '',
    time: '',
    replies: [],
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
  WritArray,
] {
  const messageDays = useRef(new Map<string, number>());

  const [keys, entries] = useMemo(() => {
    const nonNullMessages = messages.filter(([_k, v]) => v !== null);
    const ks: bigInt.BigInteger[] = nonNullMessages.map(([k]) => k);
    const es = nonNullMessages.map(([key, writ], index) => {
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

      const { newAuthor, newDay } = getNewDayAndNewAuthorFromLastWrit(
        nonNullMessages,
        writ,
        key,
        messageDays.current,
        index
      );

      if ('memo' in writ) {
        return {
          writ,
          time: key,
          newAuthor,
          newDay,
        };
      }

      const isNotice =
        'chat' in writ.essay['kind-data'] &&
        writ.essay['kind-data'].chat &&
        'notice' in writ.essay['kind-data'].chat;

      return {
        writ,
        time: key,
        newAuthor: isNotice ? false : newAuthor,
        newDay,
        replyCount: writ.seal.meta.replyCount,
      };
    }, []);
    return [ks, es];
  }, [messages]);

  return useMemo(() => [keys, entries, messages], [keys, entries, messages]);
}

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
