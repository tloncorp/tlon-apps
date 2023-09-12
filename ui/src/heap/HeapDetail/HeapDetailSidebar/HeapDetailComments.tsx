import { useGroup, useRouteGroup, useVessel } from '@/state/groups/groups';
import { useBrief, usePerms } from '@/state/channel/channel';
import { canWriteChannel, groupQuips, setNewDaysForQuips } from '@/logic/utils';
import { QuipMap } from '@/types/channel';
import DiaryComment from '@/diary/DiaryComment';
import { useChannelFlag } from '@/logic/channel';
import { useDiaryCommentSortMode } from '@/state/settings';
import HeapDetailCommentField from './HeapDetailCommentField';

interface HeapDetailCommentsProps {
  time: string;
  comments: QuipMap;
}

export default function HeapDetailComments({
  time,
  comments,
}: HeapDetailCommentsProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const chFlag = useChannelFlag();
  const nest = `nest/${chFlag}`;
  const perms = usePerms(nest);
  const sort = useDiaryCommentSortMode(chFlag ?? '');
  const vessel = useVessel(groupFlag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const brief = useBrief(nest);
  const groupedQuips = setNewDaysForQuips(
    groupQuips(time, Array.from(comments).reverse(), brief).sort(([a], [b]) => {
      if (sort === 'asc') {
        return a.localeCompare(b);
      }

      return b.localeCompare(a);
    })
  );

  return (
    <>
      <div className="mx-4 mb-2 flex flex-col space-y-2 overflow-y-auto lg:flex-1">
        <ul className="mt-12">
          {groupedQuips.map(([_t, g]) =>
            g.map((props) => (
              <li key={props.time.toString()}>
                <DiaryComment {...props} han="heap" />
              </li>
            ))
          )}
        </ul>
      </div>
      {canWrite ? <HeapDetailCommentField /> : null}
    </>
  );
}
