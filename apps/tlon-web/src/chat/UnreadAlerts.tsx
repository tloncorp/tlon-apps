import { ActivitySummary, getKey } from '@tloncorp/shared/dist/urbit/activity';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { format, isToday } from 'date-fns';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import XIcon from '@/components/icons/XIcon';
import { useMarkChannelRead } from '@/logic/channel';
import { pluralize, whomIsFlag } from '@/logic/utils';
import { useMarkDmReadMutation } from '@/state/chat';
import { useUnread } from '@/state/unreads';

import { useChatStore } from './useChatStore';

interface UnreadAlertsProps {
  whom: string;
  root: string;
}

export default function UnreadAlerts({ whom, root }: UnreadAlertsProps) {
  const unread = useUnread(getKey(whom));
  const { markRead: markReadChannel } = useMarkChannelRead(`chat/${whom}`);
  const { markDmRead } = useMarkDmReadMutation(whom);
  const markRead = useCallback(() => {
    if (whomIsFlag(whom)) {
      markReadChannel();
    } else {
      markDmRead();
    }
    useChatStore.getState().read(whom);
  }, [whom, markReadChannel, markDmRead]);

  if (!unread || unread.status === 'seen') {
    return null;
  }

  if (unread.count === 0 || !unread.lastUnread) {
    return null;
  }

  const to = `${root}?msg=${unread.lastUnread.time}`;
  const date = new Date(daToUnix(bigInt(unread.lastUnread.time)));

  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');
  const unreadMessage = `${unread.count} new ${pluralize(
    'message',
    unread.count
  )} since ${since}`;

  return (
    <>
      <div className="absolute left-1/2 top-2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
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
