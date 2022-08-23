import React from 'react';
import { HeapCurio } from '@/types/heap';
import Author from '@/chat/ChatMessage/Author';
import HeapContent from '@/heap/HeapContent';

interface HeapCommentProps {
  curio: HeapCurio;
}

export default function HeapComment({ curio }: HeapCommentProps) {
  const { author, content, sent } = curio.heart;
  const unixDate = new Date(sent);

  return (
    <div className="flex w-full flex-col">
      <Author ship={author} date={unixDate} timeOnly />
      <HeapContent className="ml-9" content={content} />
    </div>
  );
}
