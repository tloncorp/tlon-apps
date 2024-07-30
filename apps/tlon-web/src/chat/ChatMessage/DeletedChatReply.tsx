/* eslint-disable react/no-unused-prop-types */
import {
  MessageKey,
  getChannelSource,
  getDmSource,
  getThreadKey,
} from '@tloncorp/shared/dist/urbit/activity';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import cn from 'classnames';
import { format } from 'date-fns';
import React, { useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

import DateDivider from '@/chat/ChatMessage/DateDivider';
import { useMarkChannelRead } from '@/logic/channel';
import { useStickyUnread } from '@/logic/useStickyUnread';
import { whomIsFlag } from '@/logic/utils';
import { useThreadActivity } from '@/state/activity';
import { useRouteGroup } from '@/state/groups';
import { useInFocus } from '@/state/local';

export interface DeletedChatReplyProps {
  whom: string;
  parent: MessageKey;
  time: BigInteger;
  newDay?: boolean;
  isBroadcast?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
  isScrolling?: boolean;
}

const mergeRefs =
  (...refs: any[]) =>
  (node: any) => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      /* eslint-disable-next-line no-param-reassign */
      ref.current = node;
    });
  };

const DeletedChatReply = React.memo<
  DeletedChatReplyProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, DeletedChatReplyProps>(
    (
      {
        whom,
        parent,
        time,
        newDay = false,
        isLast = false,
        isLinked = false,
      }: DeletedChatReplyProps,
      ref
    ) => {
      const container = useRef<HTMLDivElement>(null);
      const unix = new Date(daToUnix(time));
      const group = useRouteGroup();
      const parentSrc = whomIsFlag(whom)
        ? getChannelSource(group, `chat/${whom}`)
        : getDmSource(whom);
      const unreadsKey = getThreadKey(
        whom,
        !whomIsFlag(whom) ? parent.id : parent.time
      );
      const { activity } = useThreadActivity(parentSrc, unreadsKey);
      const summary = useStickyUnread(activity);
      const { unread } = summary;
      const isUnread = useMemo(
        () => unread && unread.time === time.toString(),
        [unread, time]
      );
      const { markRead: markReadChannel } = useMarkChannelRead(
        `chat/${whom}`,
        parent
      );

      const inFocus = useInFocus();
      const { ref: viewRef, inView } = useInView({
        threshold: 1,
      });

      useEffect(() => {
        if (!inFocus || !inView || !isUnread) {
          return;
        }

        markReadChannel();
      }, [inFocus, inView, isUnread, markReadChannel]);

      return (
        <div
          ref={mergeRefs(ref, container)}
          className={cn('flex flex-col break-words pt-3', {
            'pb-2': isLast,
          })}
          data-testid="deleted-chat-message"
          id="deleted-chat-message-target"
        >
          {unread && isUnread ? (
            <DateDivider date={unix} unreadCount={unread.count} ref={viewRef} />
          ) : null}
          {newDay && !isUnread ? <DateDivider date={unix} /> : null}
          <div
            className={cn(
              'relative z-0 flex w-full select-none sm:select-auto rounded-lg p-3 items-center',
              isLinked ? 'bg-blue-softer' : 'bg-gray-50'
            )}
          >
            <div className="-ml-1 mr-1 w-[31px] whitespace-nowrap text-xs font-semibold text-gray-400">
              {format(unix, 'HH:mm')}
            </div>
            <div
              className={cn(
                'flex w-full min-w-0 grow flex-col px-2 text-gray-400 italic'
              )}
            >
              This message was deleted
            </div>
          </div>
        </div>
      );
    }
  )
);

export default DeletedChatReply;
