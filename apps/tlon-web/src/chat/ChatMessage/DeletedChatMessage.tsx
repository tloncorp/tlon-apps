/* eslint-disable react/no-unused-prop-types */
import { getKey } from '@tloncorp/shared/dist/urbit/activity';
import { daToUnix } from '@urbit/api';
import { formatUd } from '@urbit/aura';
import { BigInteger } from 'big-integer';
import cn from 'classnames';
import { format } from 'date-fns';
import React, { useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

import DateDivider from '@/chat/ChatMessage/DateDivider';
import { useMarkChannelRead } from '@/logic/channel';
import { useUnread, useUnreadsStore } from '@/state/unreads';

export interface DeletedChatMessageProps {
  whom: string;
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

const DeletedChatMessage = React.memo<
  DeletedChatMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, DeletedChatMessageProps>(
    (
      {
        whom,
        time,
        newDay = false,
        isLast = false,
        isLinked = false,
      }: DeletedChatMessageProps,
      ref
    ) => {
      const container = useRef<HTMLDivElement>(null);
      const unix = new Date(daToUnix(time));
      const unreadsKey = getKey(whom);
      const unread = useUnread(unreadsKey);
      const isUnread = useMemo(
        () => unread && unread.lastUnread?.time === time.toString(),
        [unread, time]
      );
      const { markRead: markReadChannel } = useMarkChannelRead(`chat/${whom}`);

      const { ref: viewRef, inView } = useInView({
        threshold: 1,
      });

      useEffect(() => {
        if (!inView || !unread) {
          return;
        }

        const unseen = unread.status === 'unread';
        const { seen: markSeen, delayedRead } = useUnreadsStore.getState();
        /* once the unseen marker comes into view we need to mark it
            as seen and start a timer to mark it read so it goes away.
            we ensure that the brief matches and hasn't changed before
            doing so. we don't want to accidentally clear unreads when
            the state has changed
        */
        if (inView && isUnread && unseen) {
          markSeen(unreadsKey);
          delayedRead(unreadsKey, markReadChannel);
        }
      }, [inView, unread, unreadsKey, isUnread, markReadChannel]);

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

export default DeletedChatMessage;
