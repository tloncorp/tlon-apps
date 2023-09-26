import cn from 'classnames';
import { BigInteger } from 'big-integer';
import React from 'react';
import { Link } from 'react-router-dom';
import { daToUnix } from '@urbit/api';
import { Note } from '@/types/channel';
import { Writ } from '@/types/dms';
import Author from '../ChatMessage/Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';

export interface ChatSearchResultProps {
  whom: string;
  root: string;
  time: BigInteger;
  writ: Note | Writ;
  index: number;
  selected: boolean;
  isScrolling?: boolean;
}

function ChatSearchResult({
  whom,
  root,
  time,
  writ,
  index,
  selected,
  isScrolling,
}: ChatSearchResultProps) {
  const { seal, essay } = writ;
  const unix = new Date(daToUnix(time));
  const scrollTo = `?msg=${time.toString()}`;
  const to = `${root}${scrollTo}`;

  return (
    <Link
      to={to}
      id={`search-result-${time.toString()}`}
      className={cn(
        'default-focus flex flex-col break-words rounded-md border border-gray-50 px-2 py-1 hover:bg-gray-50',
        selected ? 'bg-gray-50' : ''
      )}
      role="option"
      aria-posinset={index + 1}
      aria-selected={selected}
    >
      <Author ship={essay.author} date={unix} />
      <div className="group-one wrap-anywhere relative z-0 flex w-full flex-col space-y-2 py-1 pl-9">
        <ChatContent
          story={essay.content}
          isScrolling={isScrolling}
          writId={seal.id}
        />
        {Object.keys(seal.feels).length > 0 && (
          <ChatReactions seal={seal} whom={whom} />
        )}
      </div>
    </Link>
  );
}

export default React.memo(ChatSearchResult);
