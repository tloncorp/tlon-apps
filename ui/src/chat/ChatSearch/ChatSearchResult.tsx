import cn from 'classnames';
import { BigInteger } from 'big-integer';
import React from 'react';
import { Link } from 'react-router-dom';
import { daToUnix } from '@urbit/api';
import { ChatWrit } from '@/types/chat';
import { useRouteGroup } from '@/state/groups';
import Author from '../ChatMessage/Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';

export interface ChatSearchResultProps {
  whom: string;
  time: BigInteger;
  writ: ChatWrit;
  msgLoad: (time: BigInteger, type: 'click' | 'hover') => void;
  isScrolling?: boolean;
}

function ChatSearchResult({
  whom,
  time,
  writ,
  msgLoad,
  isScrolling,
}: ChatSearchResultProps) {
  const { seal, memo } = writ;
  const groupFlag = useRouteGroup();
  const unix = new Date(daToUnix(time));
  const root = `/groups/${groupFlag}/channels/chat/${whom}`;
  const scrollTo = `?msg=${time.toString()}`;
  const to = memo.replying
    ? `${root}/message/${memo.replying}${scrollTo}`
    : `${root}${scrollTo}`;

  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col break-words rounded-md px-2 py-1 hover:bg-gray-50'
      )}
      onClick={() => msgLoad(time, 'click')}
      onMouseOver={() => msgLoad(time, 'hover')}
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
