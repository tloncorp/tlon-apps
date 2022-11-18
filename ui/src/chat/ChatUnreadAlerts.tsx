import React, { useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { useLocation, useNavigate } from 'react-router';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '@/logic/utils';
import { useChatState, useGetFirstUnreadID } from '@/state/chat';
import { useChatInfo } from './useChatStore';

interface ChatUnreadAlertsProps {
  whom: string;
}

export default function ChatUnreadAlerts({ whom }: ChatUnreadAlertsProps) {
  const chatInfo = useChatInfo(whom);
  const markRead = useCallback(() => {
    useChatState.getState().markRead(whom);
  }, [whom]);

  const navigate = useNavigate();
  const location = useLocation();
  // TODO: how to handle replies?
  const firstUnreadID = useGetFirstUnreadID(whom);
  const goToFirstUnread = useCallback(() => {
    if (!firstUnreadID) {
      return;
    }
    navigate(`${location.pathname}?msg=${firstUnreadID.toString()}`);
  }, [firstUnreadID, location.pathname, navigate]);

  if (!chatInfo.unread || chatInfo.unread.seen) {
    return null;
  }

  const { brief } = chatInfo.unread;
  const readId = brief['read-id'];
  const udTime = readId
    ? daToUnix(bigInt(udToDec(readId.split('/')[1])))
    : null;
  const date = udTime ? new Date(udTime) : new Date();
  const since = isToday(date)
    ? `${format(date, 'HH:mm')} today`
    : format(date, 'LLLL d');

  const unreadMessage =
    brief &&
    `${brief.count} new ${pluralize('message', brief.count)} since ${since}`;

  if (!brief || brief?.count === 0) {
    return null;
  }

  return (
    <>
      <div className="absolute top-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <button
          className="button whitespace-nowrap bg-blue-soft text-sm text-blue dark:bg-blue-900 lg:text-base"
          onClick={goToFirstUnread}
        >
          <span className="whitespace-nowrap font-normal">
            {unreadMessage}&nbsp;&mdash;&nbsp;Click to View
          </span>
        </button>
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
