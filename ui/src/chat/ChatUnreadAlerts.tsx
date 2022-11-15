import React, { useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { useLocation, useNavigate } from 'react-router';
import bigInt from 'big-integer';
import XIcon from '@/components/icons/XIcon';
import { pluralize } from '../logic/utils';
import { useChatKeys, useChatState } from '../state/chat';
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

  const markRead = useCallback(async () => {
    useChatState.getState().markRead(whom);
  }, [whom]);

  // TODO: how to handle replies?
  const navigate = useNavigate();
  const location = useLocation();
  const chatKeys = useChatKeys({ replying: false });

  const goToFirstUnread = useCallback(() => {
    const { 'read-id': lastRead } = brief;
    if (!lastRead) {
      return;
    }
    // lastRead is formatted like: ~zod/123.456.789...
    const lastReadBN = bigInt(lastRead.split('/')[1].replaceAll('.', ''));
    const firstUnread = chatKeys.find((key) => key.gt(lastReadBN));
    if (!firstUnread) {
      return;
    }
    navigate(`${location.pathname}?msg=${firstUnread.toString()}`);
  }, [brief, chatKeys, location.pathname, navigate]);

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
