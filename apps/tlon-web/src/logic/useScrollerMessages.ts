import { MessageKey } from '@tloncorp/shared/dist/urbit/activity';
import { Post, Reply } from '@tloncorp/shared/dist/urbit/channel';
import { Writ } from '@tloncorp/shared/dist/urbit/dms';
import { daToUnix } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { useMemo, useRef } from 'react';

import getKindDataFromEssay from './getKindData';

export type WritArray = [BigInteger, Writ | Post | Reply | null][];

const getMessageAuthor = (writ: Writ | Post | Reply | null | undefined) => {
  if (!writ) {
    return null;
  }

  if ('memo' in writ) {
    return writ.memo.author;
  }
  return writ.essay.author;
};

function getDay(time: bigInt.BigInteger, messageDays: Map<string, number>) {
  let day = messageDays.get(time.toString());
  if (!day) {
    day = new Date(daToUnix(time)).setHours(0, 0, 0, 0);
    messageDays.set(time.toString(), day);
  }
  return day;
}

const getNewDayAndNewAuthorFromLastWrit = (
  author: string | null,
  key: bigInt.BigInteger,
  lastWrit: [BigInteger, Writ | Post | Reply | null] | undefined,
  messageDays: Map<string, number>
) => {
  const prevKey = lastWrit?.[0];
  const prevWrit = lastWrit?.[1];
  const prevAuthor = getMessageAuthor(prevWrit);
  const prevIsNotice =
    prevWrit &&
    'essay' in prevWrit &&
    !!getKindDataFromEssay(prevWrit.essay).notice;
  const newAuthor =
    prevIsNotice || !author || !prevAuthor ? true : author !== prevAuthor;
  const newDay = !prevKey
    ? true
    : getDay(prevKey, messageDays) !== getDay(key, messageDays);
  return {
    newAuthor,
    newDay,
  };
};

export type MessageListItemData = {
  writ: Writ | Post | Reply | null;
  type: 'message';
  time: bigInt.BigInteger;
  newAuthor: boolean;
  newDay: boolean;
  whom: string;
  isLast: boolean;
  isLinked: boolean;
  hideReplies: boolean;
  parent?: MessageKey;
};

function useMessageItems({
  messages,
  parent,
}: {
  scrollTo?: bigInt.BigInteger;
  messages: WritArray;
  parent?: MessageKey;
}): [
  bigInt.BigInteger[],
  {
    time: bigInt.BigInteger;
    newAuthor: boolean;
    newDay: boolean;
    writ: Writ | Post | Reply | null;
  }[],
  WritArray,
] {
  const messageDays = useRef(new Map<string, number>());

  const [keys, entries] = useMemo(() => {
    const ks: bigInt.BigInteger[] = messages.map(([k]) => k);
    const es = messages.map(([key, writ], index) => {
      const lastWrit = index === 0 ? undefined : messages[index - 1];
      const { newAuthor, newDay } = getNewDayAndNewAuthorFromLastWrit(
        getMessageAuthor(writ),
        key,
        lastWrit,
        messageDays.current
      );

      return {
        writ,
        time: key,
        newAuthor,
        newDay,
        parent,
        replyCount:
          writ && 'essay' in writ ? writ.seal.meta.replyCount : undefined,
      };
    }, []);
    return [ks, es];
  }, [messages]);

  return useMemo(() => [keys, entries, messages], [keys, entries, messages]);
}

export function useMessageData({
  whom,
  scrollTo,
  parent,
  messages,
  replying,
}: {
  whom: string;
  parent?: MessageKey;
  scrollTo?: bigInt.BigInteger;
  messages: WritArray;
  replying: boolean;
}) {
  const [activeMessageKeys, messageEntries, activeMessages] = useMessageItems({
    messages,
    parent,
  });

  const activeMessageEntries: MessageListItemData[] = useMemo(
    () =>
      messageEntries.map(
        (props, index) =>
          ({
            type: 'message',
            whom,
            isLast: index === messageEntries.length - 1,
            isLinked: !!scrollTo && (props.time?.eq(scrollTo) ?? false),
            hideReplies: replying,
            ...props,
          }) as MessageListItemData
      ),
    [whom, scrollTo, messageEntries, replying]
  );

  return {
    activeMessages,
    activeMessageKeys,
    activeMessageEntries,
  };
}
