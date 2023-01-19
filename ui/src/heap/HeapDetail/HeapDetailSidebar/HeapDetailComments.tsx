import cn from 'classnames';
import _ from 'lodash';
import React from 'react';
import { BigInteger } from 'big-integer';
import useNest from '@/logic/useNest';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useComments, useHeapPerms } from '@/state/heap/heap';
import { canWriteChannel, nestToFlag } from '@/logic/utils';
import HeapDetailCommentField from './HeapDetailCommentField';
import HeapComment from './HeapComment';

interface HeapDetailCommentsProps {
  time: BigInteger;
}

export default function HeapDetailComments({ time }: HeapDetailCommentsProps) {
  const nest = useNest();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [, chFlag] = nestToFlag(nest);
  const stringTime = time.toString();
  const comments = useComments(chFlag, stringTime);

  const perms = useHeapPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  return (
    <div className="flex h-full flex-col justify-between p-4 sm:overflow-y-auto">
      <div
        className={cn('flex flex-col space-y-2', comments.size !== 0 && 'mb-4')}
      >
        {Array.from(comments)
          .sort(([a], [b]) => a.compare(b))
          .map(([, curio]) => (
            <HeapComment curio={curio} />
          ))}
      </div>
      {canWrite ? <HeapDetailCommentField /> : null}
    </div>
  );
}
