import cn from 'classnames';
import { useNavigate } from 'react-router';

import getKindDataFromEssay from '@/logic/getKindData';
import { useIsPostUndelivered, usePostToggler } from '@/state/channel/channel';
import { useCalm } from '@/state/settings';
import { Post } from '@/types/channel';

import DiaryNoteHeadline from '../DiaryNoteHeadline';

interface DiaryGridItemProps {
  note: Post;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ note, time }: DiaryGridItemProps) {
  const navigate = useNavigate();
  const calm = useCalm();
  const { essay } = note;
  const { image } = getKindDataFromEssay(essay);
  const hasImage = image?.length !== 0;
  const { replyCount, lastRepliers } = note.seal.meta;
  const { isHidden } = usePostToggler(time.toString());
  const isUndelivered = useIsPostUndelivered(note);

  return (
    <div
      role="link"
      tabIndex={0}
      className={cn(
        'flex w-full flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8',
        {
          'cursor-pointer': !isHidden,
        }
      )}
      style={
        hasImage && !calm?.disableRemoteContent
          ? {
              backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.33), rgba(0, 0, 0, 0.33)), url(${image})`,
              color: '#ffffff',
            }
          : undefined
      }
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        lastRepliers={lastRepliers}
        replyCount={replyCount}
        essay={essay}
        isUndelivered={isUndelivered}
        time={time}
        isInGrid
      />
    </div>
  );
}
