import React from 'react';
import _ from 'lodash';
import f from 'lodash/fp';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';
import ChatMessageOptions from './ChatMessageOptions';
import { useMessagesForChat } from '../../state/chat';
import ShipImage from './ShipImage';
import { useChannelFlag } from '../../hooks';

export interface ChatMessageProps {
  writ: ChatWrit;
  newAuthor?: boolean;
  newDay?: boolean;
  hideReplies?: boolean;
}

export default function ChatMessage({
  writ,
  newAuthor = false,
  newDay = false,
  hideReplies = false,
}: ChatMessageProps) {
  const flag = useChannelFlag()!;
  const { seal, memo } = writ;

  const time = new Date(daToUnix(bigInt(udToDec(seal.time))));

  const messages = useMessagesForChat(flag);

  const numReplies = seal.replied.length;
  const replyAuthors = _.flow(
    f.map((k: string) => {
      const mess = messages.get(bigInt(udToDec(k)));
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
      {newDay ? <DateDivider date={time} /> : null}
      {newAuthor ? <Author ship={memo.author} date={time} /> : null}
      <div className="group-one relative z-0 flex">
        <ChatMessageOptions writ={writ} />
        <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
          {format(time, 'HH:mm')}
        </div>
        <div className="flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
          {numReplies > 0 && !hideReplies ? (
            <Link to={`message/${seal.time}`} className="font-sm text-gray-400">
              <div className="flex items-center space-x-2">
                {replyAuthors.map((ship) => (
                  <ShipImage key={ship} ship={ship} />
                ))}

                <span>
                  {numReplies} {numReplies > 1 ? 'Replies' : 'Reply'}{' '}
                </span>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
