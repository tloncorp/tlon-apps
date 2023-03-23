import cn from 'classnames';
import React from 'react';
import { BigInteger } from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import useNest from '@/logic/useNest';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useComments, useHeapPerms } from '@/state/heap/heap';
import { canWriteChannel, nestToFlag } from '@/logic/utils';
import { HeapCurio } from '@/types/heap';
import useMedia from '@/logic/useMedia';
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
  const isSmall = useMedia('(max-width: 1023px)');
  const perms = useHeapPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const sortedComments = Array.from(comments).sort(([a], [b]) => a.compare(b));

  const computeItemKey = (
    _i: number,
    [t, _curio]: [bigInt.BigInteger, HeapCurio]
  ) => t.toString();

  const itemContent = (index: number, id: BigInteger, curio: HeapCurio) => (
    <HeapComment
      key={id.toString()}
      curio={curio}
      parentTime={stringTime}
      time={id.toString()}
    />
  );

  return (
    <div className="space-y-2 lg:relative lg:h-full lg:space-y-0">
      <Virtuoso
        useWindowScroll={isSmall}
        data={sortedComments}
        computeItemKey={computeItemKey}
        itemContent={(i, [id, curio]) => itemContent(i, id, curio)}
        followOutput={true}
        style={{
          height: '100%',
          width: '100%',
          maxHeight: 'calc(100% - 2.5rem)',
        }}
      />

      {canWrite ? <HeapDetailCommentField /> : null}
    </div>
  );
}
