import useNest from '@/logic/useNest';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useHeapPerms } from '@/state/heap/heap';
import { canWriteChannel, nestToFlag } from '@/logic/utils';
import { QuipMap } from '@/types/channel';
import HeapDetailCommentField from './HeapDetailCommentField';
import HeapComment from './HeapComment';

interface HeapDetailCommentsProps {
  time: string;
  comments: QuipMap;
}

export default function HeapDetailComments({
  time,
  comments,
}: HeapDetailCommentsProps) {
  const nest = useNest();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [, chFlag] = nestToFlag(nest);
  const perms = useHeapPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const sortedComments = Array.from(comments).sort(([a], [b]) => a.compare(b));

  return (
    <>
      <div className="mx-4 mb-2 flex flex-col space-y-2 overflow-y-auto lg:flex-1">
        {sortedComments.map(([id, curio]) => (
          <HeapComment
            key={id.toString()}
            quip={curio}
            parentTime={time}
            time={id.toString()}
          />
        ))}
      </div>
      {canWrite ? <HeapDetailCommentField /> : null}
    </>
  );
}
