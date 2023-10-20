import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useUnread, usePerms } from '@/state/channel/channel';
import { ReplyTuple } from '@/types/channel';
import { canWriteChannel, useChannelFlag } from '@/logic/channel';
import { useDiaryCommentSortMode } from '@/state/settings';
import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { groupReplies, setNewDaysForReplies } from '@/replies/replies';
import ReplyMessage from '@/replies/ReplyMessage';
import HeapDetailCommentField from './HeapDetailCommentField';

interface HeapDetailCommentsProps {
  time: string;
  comments: ReplyTuple[] | null;
  loading: boolean;
}

export default function HeapDetailComments({
  time,
  comments,
  loading,
}: HeapDetailCommentsProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const chFlag = useChannelFlag();
  const nest = `heap/${chFlag}`;
  const perms = usePerms(nest);
  const sort = useDiaryCommentSortMode(chFlag ?? '');
  const vessel = useVessel(groupFlag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const unread = useUnread(nest);
  const groupedReplies = !comments
    ? []
    : setNewDaysForReplies(
        groupReplies(time, comments, unread).sort(([a], [b]) => {
          if (sort === 'asc') {
            return a.localeCompare(b);
          }

          return b.localeCompare(a);
        })
      );

  return (
    <>
      <div className="mx-4 mb-2 flex flex-col space-y-2 overflow-y-auto lg:flex-1">
        {!loading ? (
          <ul className="mt-12">
            {groupedReplies.map(([_t, g]) =>
              g.map((props) => (
                <li key={props.time.toString()}>
                  <ReplyMessage whom={nest} {...props} />
                </li>
              ))
            )}
          </ul>
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
