import { Unread, UnreadThread } from '@tloncorp/shared/dist/urbit/activity';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { format, isToday } from 'date-fns';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import XIcon from '@/components/icons/XIcon';
import { useMarkChannelRead } from '@/logic/channel';
import { pluralize, whomIsFlag } from '@/logic/utils';
import { useMarkDmReadMutation } from '@/state/chat';

import { getUnreadStatus, threadIsOlderThanLastRead } from './unreadUtils';
import { useChatInfo, useChatStore } from './useChatStore';

interface UnreadAlertsProps {
  whom: string;
  root: string;
}

export default function UnreadAlerts({ whom, root }: UnreadAlertsProps) {
  const chatInfo = useChatInfo(whom);
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

  if (!chatInfo?.unread || chatInfo.unread.seen) {
    return null;
  }

  const unread = chatInfo.unread.unread as Unread;
  const { unread: mainChat, threads } = unread;
  const { isEmpty, hasThreadUnreads } = getUnreadStatus(unread);
  if (isEmpty) {
    return null;
  }

  const sortedThreads = Object.entries(threads).sort(([, a], [, b]) =>
    bigInt(a['parent-time']).compare(bigInt(b['parent-time']))
  );
  const oldestThread = sortedThreads[0] as [string, UnreadThread] | undefined;
  const threadIsOlder = threadIsOlderThanLastRead(
    unread,
    oldestThread ? oldestThread[0] : null
  );

  /* if we have thread unreads that are older than what's unseen
     in the main chat, we should link to them in the banner instead of
     just scrolling up
  */
  let to = '';
  let date = new Date();
  if (hasThreadUnreads && threadIsOlder) {
    const [id, thread] = oldestThread!;
    to = `${root}/message/${id}?reply=${thread.time}`;
    date = new Date(daToUnix(bigInt(thread.time)));
  } else {
    to = `${root}?msg=${mainChat!.time}`;
    date = new Date(daToUnix(bigInt(mainChat!.time)));
  }

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
