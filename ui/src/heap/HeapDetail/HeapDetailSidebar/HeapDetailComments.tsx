import { BigInteger } from 'big-integer';
import useNest from '@/logic/useNest';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useHeapPerms } from '@/state/heap/heap';
import { canWriteChannel, nestToFlag } from '@/logic/utils';
import { HeapCurioMap } from '@/types/heap';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import HeapDetailCommentField from './HeapDetailCommentField';
import HeapComment from './HeapComment';

interface HeapDetailCommentsProps {
  time: BigInteger;
  comments?: HeapCurioMap;
  loading: boolean;
}

export default function HeapDetailComments({
  time,
  comments,
  loading,
}: HeapDetailCommentsProps) {
  const nest = useNest();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [, chFlag] = nestToFlag(nest);
  const stringTime = time.toString();
  const perms = useHeapPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const sortedComments = comments
    ? Array.from(comments).sort(([a], [b]) => a.compare(b))
    : [];

  return (
    <>
      <div className="mx-4 mb-2 flex flex-col space-y-2 overflow-y-auto lg:flex-1">
        {!loading ? (
          sortedComments.map(([id, curio]) => (
            <HeapComment
              key={id.toString()}
              curio={curio}
              parentTime={stringTime}
              time={id.toString()}
            />
          ))
        ) : (
          <>
            <div className="hidden overflow-y-auto lg:block">
              <ChatScrollerPlaceholder count={20} />
            </div>
            <div className="flex w-full items-center justify-center py-4 sm:flex lg:hidden">
              <LoadingSpinner />
            </div>
          </>
        )}
      </div>
      {canWrite ? <HeapDetailCommentField /> : null}
    </>
  );
}
