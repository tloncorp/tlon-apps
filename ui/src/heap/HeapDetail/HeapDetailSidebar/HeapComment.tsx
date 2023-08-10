import React from 'react';
import { HeapCurio } from '@/types/heap';
import Author from '@/chat/ChatMessage/Author';
import HeapContent from '@/heap/HeapContent';
import { useChannelFlag } from '@/logic/channel';
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
    <div className="group-one flex w-full flex-col pb-2">
      <Author ship={author} date={unixDate} timeOnly />
      <div className="relative ml-[28px] rounded-md p-2 group-one-hover:bg-gray-50 ">
        <HeapContent
          className="break-words leading-5"
          isComment
          content={content}
        />
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
            replying={curio.heart.replying || undefined}
          />
        )}
      </div>
    </div>
  );
}
