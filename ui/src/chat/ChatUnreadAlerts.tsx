import { useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { Link } from 'react-router-dom';
import XIcon from '@/components/icons/XIcon';
import { nestToFlag, pluralize } from '@/logic/utils';
import { useMarkReadMutation } from '@/state/channel/channel';
import { unixToDa } from '@urbit/aura';
import { useChatInfo, useChatStore } from './useChatStore';

interface ChatUnreadAlertsProps {
  nest: string;
  root: string;
}

export default function ChatUnreadAlerts({
  nest,
  root,
}: ChatUnreadAlertsProps) {
  const { mutate: markChatRead } = useMarkReadMutation();
  const [, flag] = nestToFlag(nest);
  const chatInfo = useChatInfo(flag);
  const markRead = useCallback(() => {
    markChatRead({ nest });
    useChatStore.getState().read(flag);
  }, [nest, flag, markChatRead]);

  if (!chatInfo?.unread || chatInfo.unread.seen) {
    return null;
  }

  const { unread } = chatInfo.unread;
  const unreadId = unread['unread-id'];
  const { threads } = unread;
  const threadKeys = Object.keys(threads).sort((a, b) => a.localeCompare(b));
  if (
    unread.count === 0 ||
    (!unreadId && threadKeys.length === 0) ||
    (typeof unreadId === 'object' && unreadId !== null)
  ) {
    return null;
  }

  const id = unreadId || unixToDa(Date.now()).toString();
  const topId = threadKeys[0];
  const to =
    threadKeys.length === 0 || topId > id
      ? `${root}?msg=${id}`
      : `${root}/message/${topId}?msg=${threads[topId]}`;

  const date = new Date(daToUnix(bigInt(id)));
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const unreadMessage =
    unread &&
    `${unread.count} new ${pluralize('message', unread.count)} since ${since}`;

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
