import React from 'react';
import { BigInteger } from 'big-integer';
import useNest from '@/logic/useNest';
import { useComments } from '@/state/heap/heap';
import { nestToFlag } from '@/logic/utils';
import HeapDetailCommentField from './HeapDetailCommentField';
import HeapComment from './HeapComment';

interface HeapDetailCommentsProps {
  time: BigInteger;
}

export default function HeapDetailComments({ time }: HeapDetailCommentsProps) {
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const stringTime = time.toString();
  const comments = useComments(chFlag, stringTime);

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-2">
      <div className="flex flex-col space-y-2">
        {Array.from(comments)
          .sort(([a], [b]) => a.compare(b))
          .map(([, curio]) => (
            <HeapComment curio={curio} />
          ))}
      </div>
      <HeapDetailCommentField />
    </div>
  );
}
