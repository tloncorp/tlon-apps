import React from 'react';
import { BigInteger } from 'big-integer';
import useNest from '@/logic/useNest';
import { useComments } from '@/state/heap/heap';
import { nestToFlag } from '@/logic/utils';
import { decToUd } from '@urbit/api';
import HeapDetailCommentField from './HeapDetailCommentField';

interface HeapDetailCommentsProps {
  time: BigInteger;
}

export default function HeapDetailComments({ time }: HeapDetailCommentsProps) {
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const stringTime = time.toString();
  const comments = useComments(chFlag, stringTime);

  return (
    <div className="relative h-full overflow-y-auto">
      <HeapDetailCommentField />
    </div>
  );
}
