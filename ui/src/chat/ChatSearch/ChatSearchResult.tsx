import cn from 'classnames';
import { BigInteger } from 'big-integer';
import React from 'react';
import { Link } from 'react-router-dom';
import { daToUnix } from '@urbit/api';
import { ChatWrit } from '@/types/chat';
import Author from '../ChatMessage/Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';

export interface ChatSearchResultProps {
  whom: string;
  root: string;
  time: BigInteger;
  writ: ChatWrit;
  index: number;
  selected: boolean;
  msgLoad: (time: BigInteger, type: 'click' | 'hover') => void;
  isScrolling?: boolean;
}

function ChatSearchResult({
  whom,
  root,
  time,
  writ,
  index,
  selected,
  msgLoad,
  isScrolling,
}: ChatSearchResultProps) {
  const { seal, memo } = writ;
  const unix = new Date(daToUnix(time));
  const scrollTo = `?msg=${time.toString()}`;
  const to = memo.replying
    ? `${root}/message/${memo.replying}${scrollTo}`
    : `${root}${scrollTo}`;

  return (
    <Link
      to={to}
      id={`search-result-${time.toString()}`}
      className={cn(
        'default-focus flex flex-col break-words rounded-md border border-gray-50 px-2 py-1 hover:bg-gray-50',
        selected ? 'bg-gray-50' : ''
      )}
      onClick={() => msgLoad(time, 'click')}
      onMouseOver={() => msgLoad(time, 'hover')}
      role="option"
      aria-posinset={index + 1}
      aria-selected={selected}
    >
      <Author ship={memo.author} date={unix} />
      <div className="group-one wrap-anywhere relative z-0 flex w-full flex-col space-y-2 py-1 pl-9">
        {'story' in memo.content ? (
          <ChatContent
            story={memo.content.story}
            isScrolling={isScrolling}
            writId={seal.id}
          />
        ) : null}
        {Object.keys(seal.feels).length > 0 && (
          <ChatReactions seal={seal} whom={whom} />
        )}
      </div>
    </Link>
  );
}

export default React.memo(ChatSearchResult);
