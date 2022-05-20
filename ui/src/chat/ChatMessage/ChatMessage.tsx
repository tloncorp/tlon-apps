import React from 'react';
import cn from 'classnames';
import _ from 'lodash';
import f from 'lodash/fp';
import { BigInteger } from 'big-integer';
import { daToUnix } from '@urbit/api';
import { format, formatDistanceToNow, formatRelative, isToday } from 'date-fns';
import { NavLink } from 'react-router-dom';
import { ChatBrief, ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';
import ChatMessageOptions from './ChatMessageOptions';
import { usePact } from '../../state/chat';
import Avatar from '../../components/Avatar';

export interface ChatMessageProps {
  whom: string;
  time: BigInteger;
  writ: ChatWrit;
  isReplyOp?: boolean;
  newAuthor?: boolean;
  newDay?: boolean;
  unread?: ChatBrief;
  hideReplies?: boolean;
}

const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
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
    }: ChatMessageProps,
    ref
  ) => {
    const { seal, memo } = writ;

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
      <div ref={ref} className="flex flex-col">
        {unread ? <DateDivider date={unix} unreadCount={unread.count} /> : null}
        {newDay && !unread ? <DateDivider date={unix} /> : null}
        {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
        <div className="group-one relative z-0 flex">
          <ChatMessageOptions whom={whom} writ={writ} />
          <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
            {format(unix, 'HH:mm')}
          </div>
          <div
            className={cn(
              'flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50',
              isReplyOp && 'bg-gray-50'
            )}
          >
            {'story' in memo.content ? (
              <ChatContent story={memo.content.story} />
            ) : null}
            {Object.keys(seal.feels).length > 0 && (
              <ChatReactions seal={seal} />
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
        </div>
      </div>
    );
  }
);

export default ChatMessage;
