import { useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { daToUnix } from '@urbit/api';
import { Link } from 'react-router-dom';
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '@/logic/utils';
import { useChatState, useWrit } from '@/state/chat';
import { useChatInfo, useChatStore } from './useChatStore';

interface ChatUnreadAlertsProps {
  whom: string;
  root: string;
}

export default function ChatUnreadAlerts({
  whom,
  root,
}: ChatUnreadAlertsProps) {
  const chatInfo = useChatInfo(whom);
  const id = chatInfo?.unread?.brief['read-id'] || '';
  const { entry: maybeWrit } = useWrit(whom, id);
  const markRead = useCallback(() => {
    useChatState.getState().markRead(whom);
    useChatStore.getState().read(whom);
  }, [whom]);

  const [time, writ] = maybeWrit ?? [null, null];
  if (!time || !writ || !chatInfo.unread || chatInfo.unread.seen) {
    return null;
  }

  const scrollTo = `?msg=${time.toString()}`;
  const to = writ.memo.replying
    ? `${root}/message/${writ.memo.replying}${scrollTo}`
    : `${root}${scrollTo}`;

  const date = new Date(daToUnix(time));
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const { brief } = chatInfo.unread;
  const unreadMessage =
    brief &&
    `${brief.count} new ${pluralize('message', brief.count)} since ${since}`;

  if (!brief || brief?.count === 0) {
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
