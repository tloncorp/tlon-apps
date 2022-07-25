import { format, isToday } from 'date-fns';
import React, { useCallback } from 'react';
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '../logic/utils';
import { useChatState } from '../state/chat';
import { ChatBrief } from '../types/chat';

interface ChatUnreadAlertsProps {
  whom: string;
  brief: ChatBrief;
}

export default function ChatUnreadAlerts({
  brief,
  whom,
}: ChatUnreadAlertsProps) {
  const date = brief ? new Date(brief.last) : new Date();
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const unreadMessage =
    brief &&
    `${brief.count} new ${pluralize('message', brief.count)} since ${since}`;

  const markRead = useCallback(() => {
    useChatState.getState().markRead(whom);
  }, [whom]);

  if (!brief || brief?.count === 0) {
    return null;
  }

  return (
    <>
      <div className="absolute top-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <button
          className="button whitespace-nowrap bg-blue-soft text-sm text-blue dark:bg-blue-900 lg:text-base"
          // TODO: This should navigate you to the last unread message
          onClick={markRead}
        >
          <span className="whitespace-nowrap font-normal">
            {unreadMessage}&nbsp;&mdash;&nbsp;Click to View
          </span>
        </button>
        <button
          className="button whitespace-nowrap bg-blue-soft px-2 text-sm text-blue dark:bg-blue-900 lg:text-base"
          onClick={markRead}
        >
          <XIcon className="h-4 w-4" ariaLabel="Mark as Read" />
        </button>
      </div>
      <div />
    </>
  );
}
