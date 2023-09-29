import cn from 'classnames';
import { BigInteger } from 'big-integer';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { daToUnix } from '@urbit/api';
import { Post, Reply } from '@/types/channel';
import { Writ } from '@/types/dms';
import ReplyReactions from '@/replies/ReplyReactions/ReplyReactions';
import Author from '../ChatMessage/Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';

export interface ChatSearchResultProps {
  whom: string;
  root: string;
  time: BigInteger;
  writ: Post | Writ | Reply;
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
  const unix = useMemo(() => new Date(daToUnix(time)), [time]);
  const noteId = useMemo(() => {
    if ('cork' in writ) {
      return writ.cork['parent-id'];
    }
    if ('seal' in writ) {
      if ('time' in writ.seal) {
        return time;
      }

      return writ.seal.id;
    }

    return '';
  }, [writ, time]);
  const isReply = 'cork' in writ;
  const scrollTo = `?msg=${noteId}`;
  const to = isReply ? `${root}/message/${noteId}` : `${root}${scrollTo}`;
  const content = useMemo(() => {
    if ('essay' in writ) {
      return writ.essay.content;
    }
    if ('memo' in writ) {
      return writ.memo.content;
    }

    return [];
  }, [writ]);

  const author = useMemo(() => {
    if ('essay' in writ) {
      return writ.essay.author;
    }
    if ('memo' in writ) {
      return writ.memo.author;
    }

    return '';
  }, [writ]);
  const reacts = useMemo(() => {
    if ('seal' in writ) {
      return writ.seal.reacts;
    }
    if ('cork' in writ) {
      return writ.cork.reacts;
    }

    return {};
  }, [writ]);

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
      <Author ship={author} date={unix} />
      <div className="group-one wrap-anywhere relative z-0 flex w-full flex-col space-y-2 py-1 pl-9">
        <ChatContent story={content} isScrolling={isScrolling} />
        {Object.keys(reacts).length > 0 &&
          ('cork' in writ ? (
            <ReplyReactions
              time={time.toString()}
              whom={whom}
              cork={writ.cork}
            />
          ) : (
            <ChatReactions seal={writ.seal} whom={whom} />
          ))}
      </div>
    </Link>
  );
}

export default React.memo(ChatSearchResult);
