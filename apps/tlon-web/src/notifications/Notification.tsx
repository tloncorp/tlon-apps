import {
  ActivityBundle,
  ActivityEvent,
  ActivitySummary,
  Source,
  getAuthor,
  getContent,
  getRelevancy,
  getSource,
  getTop,
} from '@tloncorp/shared/dist/urbit';
import { daToUnix, parseUd } from '@urbit/aura';
import _ from 'lodash';
import React, { useCallback } from 'react';

import { useMarkReadMutation } from '@/state/activity';

import DMNotification from './DMNotification';
import GroupNotification from './GroupNotification';

function getPath(source: Source, event: ActivityEvent): string {
  if ('group' in source) {
    const group = `/groups/${source.group}`;
    if ('group-ask' in event) {
      return `${group}/edit/members`;
    }

    return group;
  }

  if ('dm' in source) {
    const id = 'club' in source.dm ? source.dm.club : source.dm.ship;
    return `/dm/${id}`;
  }

  if ('channel' in source) {
    const suffix =
      'post' in event ? `?msg=${parseUd(event.post.key.time).toString()}` : '';
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
      'dm-reply' in event
        ? `?reply=${parseUd(event['dm-reply'].key.time).toString()}`
        : '';
    return `/dm/${id}/message/${thread.key.id}${suffix}`;
  }

  // base events don't exist, but this is a fallback
  return '/';
}

interface NotificationProps {
  bundle: ActivityBundle;
  summary: ActivitySummary;
}

function Notification({ bundle, summary }: NotificationProps) {
  const top = getTop(bundle);
  const source = getSource(bundle);
  const author = getAuthor(top);
  const relevancy = getRelevancy(top, window.our);
  const path = getPath(source, top);
  const time = daToUnix(parseUd(bundle.latest));
  const content = getContent(top);
  const unread = summary.count > 0 || summary['notify-count'] > 0;
  const { mutate } = useMarkReadMutation();
  const onClick = useCallback(() => {
    mutate({ source });
  }, [source]);

  if ('dm' in source || 'dm-thread' in source) {
    return (
      <DMNotification
        top={top}
        bundle={bundle}
        author={author!}
        path={path}
        time={time}
        content={content}
        relevancy={relevancy}
        isUnread={unread}
        onClick={onClick}
      />
    );
  }

  if ('thread' in source || 'channel' in source || 'group' in source) {
    const group =
      'thread' in source
        ? source.thread.group
        : 'channel' in source
          ? source.channel.group
          : source.group;
    return (
      <GroupNotification
        flag={group}
        top={top}
        bundle={bundle}
        author={author!}
        path={path}
        time={time}
        content={content}
        relevancy={relevancy}
        isUnread={unread}
        onClick={onClick}
      />
    );
  }

  console.warn('There are no "base" activity events. Something went wrong');
  return null;
}

export default React.memo(Notification);
