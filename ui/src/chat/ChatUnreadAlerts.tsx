import { useCallback } from 'react';
import { format, isToday } from 'date-fns';
<<<<<<< HEAD
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { VirtuosoHandle } from 'react-virtuoso';
||||||| 0c006213
import { daToUnix, udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { VirtuosoHandle } from 'react-virtuoso';
=======
import { daToUnix } from '@urbit/api';
import { Link } from 'react-router-dom';
>>>>>>> develop
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '@/logic/utils';
<<<<<<< HEAD
import {
  useGetFirstUnreadID,
  useMarkReadMutation,
  usePostKeys,
} from '@/state/channel/channel';
import { useChatInfo } from './useChatStore';
||||||| 0c006213
import {
  useChatKeys,
  useChatState,
  useGetFirstUnreadID,
  useWrit,
} from '@/state/chat';
import { useChatInfo, useChatStore } from './useChatStore';
=======
import { useChatState, useWrit } from '@/state/chat';
import { useChatInfo, useChatStore } from './useChatStore';
>>>>>>> develop

interface ChatUnreadAlertsProps {
  whom: string;
  root: string;
}

export default function ChatUnreadAlerts({
  whom,
  root,
}: ChatUnreadAlertsProps) {
<<<<<<< HEAD
  const { mutate: markChatRead } = useMarkReadMutation();
  const chatInfo = useChatInfo(`chat/${whom}`);
||||||| 0c006213
  const chatInfo = useChatInfo(whom);
  const maybeWrit = useWrit(whom, chatInfo?.unread?.brief['read-id'] || '');
  let replyToId: BigInteger = bigInt(0);
  if (maybeWrit) {
    const [_, writ] = maybeWrit;
    const replyTo = writ.memo.replying || '';
    replyToId =
      replyTo !== ''
        ? bigInt(replyTo.split('/')[1].replaceAll('.', ''))
        : bigInt(0);
  }
=======
  const chatInfo = useChatInfo(whom);
  const id = chatInfo?.unread?.brief['read-id'] || '';
  const { entry: maybeWrit } = useWrit(whom, id);
>>>>>>> develop
  const markRead = useCallback(() => {
    markChatRead({ nest: `chat/${whom}` });
  }, [whom, markChatRead]);

<<<<<<< HEAD
  // TODO: how to handle replies?
  const firstChatUnreadID = useGetFirstUnreadID(`chat/${whom}`);

  const keys = usePostKeys(`chat/${whom}`);
  const goToFirstUnread = useCallback(() => {
    if (!scrollerRef.current) {
      return;
    }

    if (!firstChatUnreadID) {
      return;
    }

    const idx = keys.findIndex((k) => k.greaterOrEquals(firstChatUnreadID));
    if (idx === -1) {
      return;
    }

    scrollerRef.current.scrollToIndex({
      index: idx,
      align: 'start',
      behavior: 'auto',
    });
  }, [firstChatUnreadID, keys, scrollerRef]);

  if (!chatInfo.unread || chatInfo.unread.seen) {
||||||| 0c006213
  // TODO: how to handle replies?
  const firstUnreadID = useGetFirstUnreadID(whom);
  const keys = useChatKeys({ whom, replying: false });
  const goToFirstUnread = useCallback(() => {
    if (!scrollerRef.current) {
      return;
    }

    if (replyToId !== bigInt(0)) {
      const idx = keys.findIndex((k) => k.greaterOrEquals(replyToId));
      if (idx === -1) {
        return;
      }

      scrollerRef.current.scrollToIndex({
        index: idx,
        align: 'start',
        behavior: 'auto',
      });
    }

    if (!firstUnreadID) {
      return;
    }

    const idx = keys.findIndex((k) => k.greaterOrEquals(firstUnreadID));
    if (idx === -1) {
      return;
    }

    scrollerRef.current.scrollToIndex({
      index: idx,
      align: 'start',
      behavior: 'auto',
    });
  }, [firstUnreadID, keys, scrollerRef, replyToId]);

  if (!chatInfo.unread || chatInfo.unread.seen) {
=======
  const [time, writ] = maybeWrit ?? [null, null];
  if (!time || !writ || !chatInfo.unread || chatInfo.unread.seen) {
>>>>>>> develop
    return null;
  }

<<<<<<< HEAD
  const { unread } = chatInfo.unread;
  const readId = unread['read-id'];
  const udTime = readId ? daToUnix(bigInt(udToDec(readId))) : null;
  const date = udTime ? new Date(udTime) : new Date();
||||||| 0c006213
  const { brief } = chatInfo.unread;
  const readId = brief['read-id'];
  const udTime = readId
    ? daToUnix(bigInt(udToDec(readId.split('/')[1])))
    : null;
  const date = udTime ? new Date(udTime) : new Date();
=======
  const scrollTo = `?msg=${time.toString()}`;
  const to = writ.memo.replying
    ? `${root}/message/${writ.memo.replying}${scrollTo}`
    : `${root}${scrollTo}`;

  const date = new Date(daToUnix(time));
>>>>>>> develop
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const { brief } = chatInfo.unread;
  const unreadMessage =
    unread &&
    `${unread.count} new ${pluralize('message', unread.count)} since ${since}`;

  if (!unread || unread?.count === 0) {
    return null;
  }

  return (
    <>
      <div className="absolute top-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <Link
          to={to}
          className="button whitespace-nowrap bg-blue-soft text-sm text-blue dark:bg-blue-900 lg:text-base"
        >
          <span className="whitespace-nowrap font-normal">
            {unreadMessage}&nbsp;&mdash;&nbsp;Click to View
          </span>
        </Link>
        <button
          className="button whitespace-nowrap bg-blue-soft px-2 text-sm text-blue dark:bg-blue-900 lg:text-base"
          onClick={markRead}
        >
          <XIcon className="h-4 w-4" aria-label="Mark as Read" />
        </button>
      </div>
      <div />
    </>
  );
}
