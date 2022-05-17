import React from 'react';
import cn from 'classnames';
import _ from 'lodash';
import f from 'lodash/fp';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { format } from 'date-fns';
import { Link, NavLink } from 'react-router-dom';
import { ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';
import ChatMessageOptions from './ChatMessageOptions';
import { useMessagesForChat, usePact } from '../../state/chat';
import ShipImage from './ShipImage';
import { useChannelFlag } from '../../hooks';

export interface ChatMessageProps {
  whom: string;
  time: BigInteger;
  writ: ChatWrit;
  newAuthor?: boolean;
  newDay?: boolean;
  hideReplies?: boolean;
}

export default function ChatMessage({
  whom,
  time,
  writ,
  newAuthor = false,
  newDay = false,
  hideReplies = false,
}: ChatMessageProps) {
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
    <div className="flex flex-col">
      {newDay ? <DateDivider date={unix} /> : null}
      {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
      <div className="group-one relative z-0 flex">
        <ChatMessageOptions whom={whom} writ={writ} />
        <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
          {format(unix, 'HH:mm')}
        </div>
        <div className="flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
          {numReplies > 0 && !hideReplies ? (
            <NavLink
              to={`message/${seal.id}`}
              className={({ isActive }) =>
                cn(
                  'font-sm rounded p-2 text-gray-400',
                  isActive ? 'bg-gray-50' : ''
                )
              }
            >
              <div className="flex items-center space-x-2">
                {replyAuthors.map((ship) => (
                  <ShipImage key={ship} ship={ship} />
                ))}

                <span>
                  {numReplies} {numReplies > 1 ? 'Replies' : 'Reply'}{' '}
                </span>
              </div>
            </NavLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
