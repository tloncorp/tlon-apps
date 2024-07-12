import {
  ActivityBundle,
  ActivityEvent,
  ActivitySummary,
  Source,
  getContent,
  getSource,
  getTop,
  isComment,
  isGalleryBlock,
  isInvite,
  isMention,
  isMessage,
  isReply,
  isUnread,
} from '@tloncorp/shared/dist/urbit';
import { daToUnix, parseUd } from '@urbit/aura';
import cn from 'classnames';
import _ from 'lodash';
import { ReactNode, useCallback } from 'react';
import { Link } from 'react-router-dom';

import ChatContent from '@/chat/ChatContent/ChatContent';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import { makePrettyTime } from '@/logic/utils';
import { useMarkReadMutation } from '@/state/activity';

import ActivityTopLine from './ActivitySummary';
import { GalleryNotification } from './GalleryNotification';
import { GroupInviteNotification } from './GroupInviteNotification';

function getPath(source: Source, event: ActivityEvent): string {
  if ('group' in source) {
    return `/groups/${source.group}`;
  }

  if ('dm' in source) {
    const id = 'club' in source.dm ? source.dm.club : source.dm.ship;
    return `/dm/${id}`;
  }

  if ('channel' in source) {
    const suffix = 'post' in event ? `?msg=${event.post.key.time}` : '';
    return `/groups/${source.channel.group}/channels/${source.channel.nest}${suffix}`;
  }

  if ('thread' in source) {
    const suffix =
      'reply' in event
        ? `?reply=${parseUd(event.reply.key.time).toString()}`
        : '';
    return `/groups/${source.thread.group}/channels/${source.thread.channel}/message/${parseUd(source.thread.key.time).toString()}${suffix}`;
  }

  if ('dm-thread' in source) {
    const thread = source['dm-thread'];
    const id = 'club' in thread.whom ? thread.whom.club : thread.whom.ship;
    const suffix =
      'dm-reply' in event ? `?reply=${event['dm-reply'].key.time}` : '';
    return `/dm/${id}/message/${thread.key.id}${suffix}`;
  }

  // base events don't exist, but this is a fallback
  return '/';
}

interface NotificationProps {
  bundle: ActivityBundle;
  summary: ActivitySummary;
  topLine?: ReactNode;
  avatar?: ReactNode;
}

export default function Notification({
  bundle,
  summary,
  avatar,
  topLine,
}: NotificationProps) {
  const top = getTop(bundle);
  const source = getSource(bundle);
  const path = getPath(source, top);
  const { mutate } = useMarkReadMutation();
  const onClick = useCallback(() => {
    mutate({ source });
  }, [source]);
  const replyBool = isReply(top);
  const isMessageBool = isMessage(top);
  const commentBool = isComment(top);
  const mentionBool = isMention(top);
  // const isNoteBool = isNote(top);
  // const groupMetaBool = isGroupMeta(top);
  const time = daToUnix(parseUd(bundle.latest));
  const unread = isUnread(bundle.latest, summary);
  const content = getContent(top);

  if (isGalleryBlock(top)) {
    return (
      <GalleryNotification
        top={top}
        bundle={bundle}
        avatar={avatar}
        topLine={topLine}
      />
    );
  }

  if (isInvite(top) && 'group' in source) {
    return (
      <GroupInviteNotification
        top={top}
        bundle={bundle}
        flag={source.group}
        time={time}
        unread={unread}
        avatar={avatar}
        topLine={topLine}
      />
    );
  }

  return (
    <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
      <Link
        to={path}
        state={
          undefined
          // groupMetaBool
          //   ? {
          //       backgroundLocation: {
          //         pathname: `/groups/${rope.group}/channels/${recentChannel}`,
          //       },
          //     }
          //   : undefined
        }
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">{avatar}</div>
        <div className="min-w-0 grow-0 break-words p-1">
          {topLine}
          <ActivityTopLine top={top} bundle={bundle} />
          {content ? (
            <div className="text-black my-2 leading-5">
              <ChatContent story={content} />
            </div>
          ) : null}
          {mentionBool || commentBool || replyBool || isMessageBool ? (
            <div className={cn('small-button bg-blue-soft text-blue')}>
              Reply
            </div>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-5 flex-none p-1">
        <div className="flex items-center space-x-1">
          {unread ? <Bullet16Icon className="h-4 w-4 text-blue" /> : null}
          <span className="text-sm font-semibold">
            {makePrettyTime(new Date(time))}
          </span>
        </div>
      </div>
    </div>
  );
}
