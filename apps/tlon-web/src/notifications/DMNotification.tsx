import { makePrettyTime } from '@tloncorp/shared/dist';
import {
  ActivityBundle,
  ActivityEvent,
  ActivityRelevancy,
  Story,
} from '@tloncorp/shared/dist/urbit';
import React from 'react';
import { Link } from 'react-router-dom';

import ChatContent from '@/chat/ChatContent/ChatContent';
import Avatar from '@/components/Avatar';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import { truncateProse } from '@/logic/utils';

import ActivitySummary from './ActivitySummary';

interface DMNotificationProps {
  top: ActivityEvent;
  bundle: ActivityBundle;
  author: string;
  path: string;
  time: number;
  content?: Story;
  relevancy: ActivityRelevancy;
  isUnread: boolean;
  onClick: () => void;
}

function DMNotification({
  top,
  bundle,
  relevancy,
  content,
  author,
  path,
  time,
  isUnread,
  onClick,
}: DMNotificationProps) {
  return (
    <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
      <Link
        to={path}
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">
          <Avatar size="default-sm" ship={author} />
        </div>
        <div className="min-w-0 grow-0 break-words p-1 space-y-2">
          <ChatSmallIcon className="h-4 w-4" />
          <ActivitySummary top={top} bundle={bundle} relevancy={relevancy} />
          {content ? (
            <div className="text-black py-1 leading-5">
              <ChatContent story={truncateProse(content, 360)} />
            </div>
          ) : null}
          {['involvedThread', 'mention'].includes(relevancy) ? (
            <div className="small-button bg-blue-soft text-blue">Reply</div>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-5 flex-none p-1">
        <div className="flex items-center space-x-1">
          {isUnread ? <Bullet16Icon className="h-4 w-4 text-blue" /> : null}
          <span className="text-sm font-semibold">
            {makePrettyTime(new Date(time))}
          </span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(DMNotification);
