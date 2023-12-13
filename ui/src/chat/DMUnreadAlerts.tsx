import bigInt from 'big-integer';
import { useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { daToUnix, unixToDa } from '@urbit/api';
import { Link } from 'react-router-dom';
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '@/logic/utils';
import { useMarkDmReadMutation } from '@/state/chat';
import { DMUnread } from '@/types/dms';
import { useChatInfo, useChatStore } from './useChatStore';

interface DMUnreadAlertsProps {
  whom: string;
  root: string;
}

export default function DMUnreadAlerts({ whom, root }: DMUnreadAlertsProps) {
  const chatInfo = useChatInfo(whom);
  const { mutate: markDmRead } = useMarkDmReadMutation();
  const markRead = useCallback(() => {
    markDmRead({ whom });
    useChatStore.getState().read(whom);
  }, [whom, markDmRead]);

  if (!chatInfo?.unread || chatInfo.unread.seen) {
    return null;
  }
  const { unread } = chatInfo.unread;
  const threadVals = Object.values(unread.threads);
  if ( unread.unread === null ||
       !('time' in unread.unread) ||
       (threadVals.length === 0)
  ) {
    return null;
  }

  if (threadVals.length > 0 && !threadVals.some((t) => typeof t === 'object')) {
    return null;
  }

  const time = unread.unread.time || unixToDa(Date.now()).toString();
  const threads = unread.threads as DMUnread['threads'];
  const entries = Object.entries(threads).sort(([, a], [, b]) =>
    a['parent-time'].localeCompare(b['parent-time'])
  );

  const topId = entries[0]?.[0];
  const parent = entries[0]?.[1]['parent-time'];
  const replyTime = entries[0]?.[1].time;
  const to =
    entries.length === 0 || parent > time
      ? `${root}?msg=${time}`
      : `${root}/message/${topId}?msg=${replyTime}`;

  const date = new Date(daToUnix(bigInt(time)));
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

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
