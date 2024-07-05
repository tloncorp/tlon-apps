import {
  ActivityBundle,
  ActivityEvent,
  ActivitySummary,
  Source,
  getSource,
  getTop,
  isBlock,
  isComment,
  isGroupMeta,
  isInvite,
  isMention,
  isMessage,
  isNote,
  isReply,
  isUnread,
} from '@tloncorp/shared/dist/urbit';
import { daToUnix, parseUd } from '@urbit/aura';
import cn from 'classnames';
import _ from 'lodash';
import { ReactNode, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { getTabPath } from '@/components/Sidebar/util';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import { makePrettyTime } from '@/logic/utils';
import { useMarkReadMutation } from '@/state/activity';

import { GalleryNotification } from './GalleryNotification';
import { GroupInviteNotification } from './GroupInviteNotification';

function getPath(
  source: Source,
  event: ActivityEvent,
  locationPath: string
): string {
  if ('group' in source) {
    return `/groups/${source.group}`;
  }

  if ('dm' in source) {
    const id = 'club' in source.dm ? source.dm.club : source.dm.ship;
    return `/dm/${id}`;
  }

  if ('channel' in source) {
    const path = `/groups/${source.channel.group}/channels/${source.channel.nest}`;
    return getTabPath(path, locationPath);
  }

  if ('thread' in source) {
    const suffix = 'reply' in event ? `?reply=${event.reply.key.time}` : '';
    return `/groups/${source.thread.group}/channels/${source.thread.channel}/message/${source.thread.key.time}${suffix}`;
  }

  if ('dm-thread' in source) {
    const thread = source['dm-thread'];
    const id = 'club' in thread.whom ? thread.whom.club : thread.whom.ship;
    const suffix =
      'dm-reply' in event ? `?reply=${event['dm-reply'].key.time}` : '';
    return `/dm/${id}/message/${thread.key.time}${suffix}`;
  }

  // all replies should go to the post and scroll to the reply
  if (reply) {
    return `${parts.slice(0, index + 2).join('/')}?reply=${reply}`;
  }

  // chat messages should go to the channel and scroll to the message
  if (isChatMsg) {
    return `${parts.slice(0, index).join('/')}?msg=${post}`;
  }

  // all other posts should go to the post
  return path;
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
  const moreCount = bundle.events.length - 1;
  const { mutate } = useMarkReadMutation();
  const mentionBool = isMention(top);
  const commentBool = isComment(top);
  const isMessageBool = isMessage(top);
  const isNoteBool = isNote(top);
  const groupMetaBool = isGroupMeta(top);
  const replyBool = isReply(top);
  const path = getPath(bundle);
  const onClick = useCallback(() => {
    mutate({ source: getSource(bundle) });
  }, [bundle]);
  const source = getSource(bundle);
  const time = daToUnix(parseUd(bundle.latest));
  const unread = isUnread(bundle.latest, summary);

  if (isBlock(top)) {
    return (
      <GalleryNotification
        top={top}
        time={time}
        moreCount={moreCount}
        avatar={avatar}
        topLine={topLine}
      />
    );
  }

  if (isInvite(top) && 'group' in source) {
    return (
      <GroupInviteNotification
        top={top}
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
          groupMetaBool
            ? {
                backgroundLocation: {
                  pathname: `/groups/${rope.group}/channels/${recentChannel}`,
                },
              }
            : undefined
        }
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">{avatar}</div>
        <div className="min-w-0 grow-0 break-words p-1">
          {topLine}
          <div className="my-2 leading-5">
            <NotificationContent
              time={bin.time}
              content={bin.top.con}
              conIsMention={mentionBool}
              conIsComment={commentBool}
              conIsReply={replyBool}
              conIsNote={isNoteBool}
            />
          </div>
          {moreCount > 0 ? (
            <p className="mt-2 text-sm font-semibold">
              Latest of {moreCount} new messages
            </p>
          ) : null}
          {mentionBool || commentBool || replyBool || isMessageBool ? (
            <div
              className={cn(
                'small-button bg-blue-soft text-blue',
                moreCount > 0 ? 'mt-2' : 'mt-0'
              )}
            >
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
