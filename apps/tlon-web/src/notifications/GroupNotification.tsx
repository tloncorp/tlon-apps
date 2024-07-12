import { makePrettyTime } from '@tloncorp/shared/dist';
import {
  ActivityBundle,
  ActivityEvent,
  ActivityRelevancy,
  Kind,
  Story,
  getChannelKind,
  isGroupMeta,
  isInvite,
  isJoin,
  isLeave,
  isRoleChange,
} from '@tloncorp/shared/dist/urbit';
import React from 'react';
import { Link } from 'react-router-dom';

import ChatContent from '@/chat/ChatContent/ChatContent';
import Avatar from '@/components/Avatar';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import DefaultGroupIcon from '@/components/icons/DefaultGroupIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';
import Person16Icon from '@/components/icons/Person16Icon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import GroupAvatar from '@/groups/GroupAvatar';
import useGroupJoin from '@/groups/useGroupJoin';
import { useIsMobile } from '@/logic/useMedia';
import { truncateProse } from '@/logic/utils';
import { useGang, useGroup } from '@/state/groups';

import ActivitySummary from './ActivitySummary';

const TRUNCATE_LENGTH = 20;

function GroupSubIcon(channelType: Kind | 'meta', event: ActivityEvent) {
  switch (channelType) {
    case 'chat':
      return <ChatSmallIcon className="mr-1 h-4 w-4" />;
    case 'diary':
      return <NotebookIcon className="mr-1 h-4 w-4" />;
    case 'heap':
      return <ShapesIcon className="mr-1 h-4 w-4" />;
    default:
      if (isJoin(event) || isRoleChange(event) || isLeave(event)) {
        return <Person16Icon className="mr-1 h-4 w-4" />;
      }
      return <DefaultGroupIcon className="mr-1 h-4 w-4" />;
  }
}

interface GroupNotificationProps {
  top: ActivityEvent;
  bundle: ActivityBundle;
  flag: string;
  author: string;
  path: string;
  time: number;
  content?: Story;
  relevancy: ActivityRelevancy;
  isUnread: boolean;
  onClick: () => void;
}

function GroupNotification({
  top,
  bundle,
  flag,
  relevancy,
  content,
  author,
  path,
  time,
  isUnread,
  onClick,
}: GroupNotificationProps) {
  const isMobile = useIsMobile();
  const group = useGroup(flag);
  const gang = useGang(flag);
  const { open, reject } = useGroupJoin(flag, gang);
  const channelEvent = 'post' in top || 'reply' in top;
  const channelType = channelEvent ? getChannelKind(top) : 'meta';
  const groupMetaEvent = isGroupMeta(top);
  const groupTitle = group?.meta?.title || gang?.preview?.meta.title;
  const channel = !channelEvent
    ? undefined
    : 'post' in top
      ? top.post.channel
      : top.reply.channel;
  const channelTitle = group?.channels[channel || '']?.meta?.title;
  const combinedTitle = `${groupTitle || ''}${
    channelTitle ? `: ${channelTitle}` : ''
  }`;
  const truncatedCombinedTitle = `${combinedTitle.slice(
    0,
    TRUNCATE_LENGTH
  )}...`;

  return (
    <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
      <Link
        to={path}
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">
          {!groupMetaEvent && author ? (
            <Avatar size="default-sm" ship={author} />
          ) : (
            <GroupAvatar size="w-12 h-12" {...(group || gang?.preview)?.meta} />
          )}
        </div>
        <div className="min-w-0 grow-0 break-words p-1 space-y-2">
          <div className="flex flex-row items-center space-x-1 text-sm font-semibold text-gray-400">
            {!groupMetaEvent ? (
              <GroupAvatar
                image={group?.meta.image || gang.preview?.meta.image}
                title={group?.meta.title || gang.preview?.meta.title}
                size="h-4 w-4"
              />
            ) : (
              GroupSubIcon(channelType, top)
            )}
            <p>
              {isMobile && combinedTitle.length > TRUNCATE_LENGTH + 1
                ? truncatedCombinedTitle
                : combinedTitle}
            </p>
          </div>
          {isInvite(top) && gang && !group ? (
            <>
              <div className="text-gray-800 py-1 leading-5">
                You have been invited to{' '}
                <span className="font-semibold">{groupTitle}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={open}
                  className="small-button bg-blue-soft text-blue"
                >
                  Accept
                </button>
                <button
                  onClick={reject}
                  className="small-button bg-gray-50 text-gray-800"
                >
                  Reject
                </button>
              </div>
            </>
          ) : (
            <>
              <ActivitySummary
                top={top}
                bundle={bundle}
                relevancy={relevancy}
              />
              {content ? (
                <div className="text-gray-800 py-1 leading-5">
                  <ChatContent story={truncateProse(content, 360)} />
                </div>
              ) : null}
              {[
                'involvedThread',
                'mention',
                'replyToGalleryOrNote',
                'replyToChatPost',
              ].includes(relevancy) ? (
                <div className="small-button bg-blue-soft text-blue">Reply</div>
              ) : null}
            </>
          )}
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

export default React.memo(GroupNotification);
