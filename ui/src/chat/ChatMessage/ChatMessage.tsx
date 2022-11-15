/* eslint-disable react/no-unused-prop-types */
import React, { useEffect } from 'react';
import cn from 'classnames';
import _ from 'lodash';
import f from 'lodash/fp';
import { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { format, formatDistanceToNow, formatRelative, isToday } from 'date-fns';
import { NavLink } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { ChatBrief, ChatWrit } from '@/types/chat';
import Author from '@/chat/ChatMessage/Author';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import ChatReactions from '@/chat/ChatReactions/ChatReactions';
import DateDivider from '@/chat/ChatMessage/DateDivider';
import ChatMessageOptions from '@/chat/ChatMessage/ChatMessageOptions';
import {
  usePact,
  useChatState,
  useIsMessageDelivered,
  useIsMessagePosted,
} from '@/state/chat';
import Avatar from '@/components/Avatar';
import DoubleCaretRightIcon from '@/components/icons/DoubleCaretRightIcon';

export interface ChatMessageProps {
  whom: string;
  time: BigInteger;
  writ: ChatWrit;
  isReplyOp?: boolean;
  newAuthor?: boolean;
  newDay?: boolean;
  unread?: ChatBrief;
  hideReplies?: boolean;
  hideOptions?: boolean;
  isLast?: boolean;
  isLinked?: boolean;
}

const ChatMessage = React.memo<
  ChatMessageProps & React.RefAttributes<HTMLDivElement>
>(
  React.forwardRef<HTMLDivElement, ChatMessageProps>(
    (
      {
        whom,
        time,
        writ,
        unread,
        isReplyOp = false,
        newAuthor = false,
        newDay = false,
        hideReplies = false,
        hideOptions = false,
        isLast = false,
        isLinked = false,
      }: ChatMessageProps,
      ref
    ) => {
      const { seal, memo } = writ;
      const { markRead } = useChatState.getState();
      const [viewRef, inView, entry] = useInView({
        threshold: 1,
        triggerOnce: true,
      });
      const isMessageDelivered = useIsMessageDelivered(seal.id);
      const isMessagePosted = useIsMessagePosted(seal.id);

      useEffect(() => {
        if (inView && unread) {
          markRead(whom);
        }
      }, [unread, inView, markRead, whom]);

      const unix = new Date(daToUnix(time));

      const pact = usePact(whom);

      const numReplies = seal.replied.length;
      const replyAuthors = _.flow(
        f.map((k: string) => {
          const t = pact.index[k];
          const mess = t ? pact.writs.get(t) : undefined;
          if (!mess) {
            return undefined;
          }
          return mess.memo.author;
        }),
        f.compact,
        f.uniq,
        f.take(3)
      )(seal.replied);

      return (
        <div
          ref={ref}
          className={cn('flex flex-col break-words', {
            'pt-2': newAuthor,
            'pb-2': isLast,
          })}
        >
          {unread && unread.count > 0 ? (
            <DateDivider date={unix} unreadCount={unread.count} ref={viewRef} />
          ) : null}
          {newDay && !unread ? <DateDivider date={unix} /> : null}
          {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
          <div className="group-one relative z-0 flex w-full">
            {hideOptions ? null : (
              <ChatMessageOptions
                hideReply={hideReplies}
                whom={whom}
                writ={writ}
              />
            )}
            <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
              {format(unix, 'HH:mm')}
            </div>
            <div className="wrap-anywhere flex w-full">
              <div
                className={cn(
                  'flex w-full grow flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50',
                  isReplyOp && 'bg-gray-50',
                  !isMessageDelivered && !isMessagePosted && 'text-gray-400',
                  isLinked && 'bg-gray-50'
                )}
              >
                {'story' in memo.content ? (
                  <ChatContent story={memo.content.story} />
                ) : null}
                {Object.keys(seal.feels).length > 0 && (
                  <ChatReactions seal={seal} whom={whom} />
                )}
                {numReplies > 0 && !hideReplies ? (
                  <NavLink
                    to={`message/${seal.id}`}
                    className={({ isActive }) =>
                      cn(
                        'rounded p-2 text-sm font-semibold text-blue',
                        isActive ? 'bg-gray-50' : ''
                      )
                    }
                  >
                    <div className="flex items-center space-x-2">
                      {replyAuthors.map((ship) => (
                        <Avatar key={ship} ship={ship} size="xs" />
                      ))}

                      <span>
                        {numReplies} {numReplies > 1 ? 'replies' : 'reply'}{' '}
                      </span>
                      <span className="text-gray-400">
                        Last reply{' '}
                        {isToday(unix)
                          ? `${formatDistanceToNow(unix)} ago`
                          : formatRelative(unix, new Date())}
                      </span>
                    </div>
                  </NavLink>
                ) : null}
              </div>
              <div className="flex items-end rounded-r group-one-hover:bg-gray-50">
                {!isMessageDelivered && (
                  <DoubleCaretRightIcon
                    className="h-5 w-5"
                    primary={isMessagePosted ? 'text-black' : 'text-gray-200'}
                    secondary="text-gray-200"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
  )
);

export default ChatMessage;
