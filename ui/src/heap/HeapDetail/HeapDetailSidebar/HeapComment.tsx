import React from 'react';
import { HeapCurio } from '@/types/heap';
import Author from '@/chat/ChatMessage/Author';
import HeapContent from '@/heap/HeapContent';
import { useChannelFlag } from '@/hooks';
import HeapCommentOptions from './HeapCommentOptions';
import HeapCommentReactions from './HeapCommentReactions';

interface HeapCommentProps {
  curio: HeapCurio;
  time: string;
  parentTime: string;
}

export default function HeapComment({
  curio,
  time,
  parentTime,
}: HeapCommentProps) {
  const { author, content, sent } = curio.heart;
  const unixDate = new Date(sent);
  const flag = useChannelFlag();

  return (
    <div className="group-one flex w-full flex-col">
      <Author ship={author} date={unixDate} timeOnly />
      <div className="relative flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
        <HeapContent className="ml-9" content={content} />
        <HeapCommentOptions
          whom={flag || ''}
          curio={curio}
          parentTime={parentTime}
          time={time.toString()}
        />
        {Object.keys(curio.seal.feels).length > 0 && (
          <HeapCommentReactions
            whom={flag || ''}
            seal={curio.seal}
            time={time.toString()}
          />
        )}
      </div>
    </div>
  );
}
