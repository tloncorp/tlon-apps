import { MessageKey } from '@tloncorp/shared/urbit/activity';
import { ReplyTuple } from '@tloncorp/shared/urbit/channel';
import bigInt from 'big-integer';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import ChatScrollerPlaceholder from '@/chat/ChatScroller/ChatScrollerPlaceholder';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { canWriteChannel, useChannelFlag } from '@/logic/channel';
import { useStickyUnread } from '@/logic/useStickyUnread';
import ReplyMessage from '@/replies/ReplyMessage';
import { groupReplies, setNewDaysForReplies } from '@/replies/replies';
import { useThreadActivity } from '@/state/activity';
import { usePerms } from '@/state/channel/channel';
import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useDiaryCommentSortMode } from '@/state/settings';

import HeapDetailCommentField from './HeapDetailCommentField';

interface HeapDetailCommentsProps {
  parent: MessageKey;
  comments: ReplyTuple[] | null;
  loading: boolean;
}

export default function HeapDetailComments({
  parent,
  comments,
  loading,
}: HeapDetailCommentsProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const chFlag = useChannelFlag();
  const nest = `heap/${chFlag}`;
  const location = useLocation();
  const scrollTo = useMemo(() => {
    const reply = new URLSearchParams(location.search).get('reply');
    return reply ? bigInt(reply) : bigInt.zero;
  }, [location.search]);
  const perms = usePerms(nest);
  const sort = useDiaryCommentSortMode(chFlag ?? '');
  const vessel = useVessel(groupFlag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const { activity } = useThreadActivity(
    { channel: { nest, group: groupFlag } },
    `thread/${nest}/${parent.id}`
  );
  const unread = useStickyUnread(activity);
  const sortedComments =
    comments?.sort(([a], [b]) => {
      if (sort === 'asc') {
        return a.toString().localeCompare(b.toString());
      }
      return b.toString().localeCompare(a.toString());
    }) ?? [];
  const groupedReplies = !comments
    ? []
    : setNewDaysForReplies(
        groupReplies(parent, sortedComments, unread).sort(([a], [b]) => {
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
                  <ReplyMessage
                    whom={nest}
                    {...props}
                    showReply
                    isLinked={props.time.eq(scrollTo)}
                  />
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
