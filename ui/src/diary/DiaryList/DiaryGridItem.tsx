import cn from 'classnames';
import { useNavigate } from 'react-router';
import { Post } from '@/types/channel';
import { useCalm } from '@/state/settings';
<<<<<<< HEAD
import getKindDataFromEssay from '@/logic/getKindData';
import { usePostToggler } from '@/state/channel/channel';
||||||| 0c006213
=======
import { usePostToggler } from '@/state/diary';
>>>>>>> develop
import DiaryNoteHeadline from '../DiaryNoteHeadline';

interface DiaryGridItemProps {
  note: Post;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ note, time }: DiaryGridItemProps) {
  const navigate = useNavigate();
  const calm = useCalm();
<<<<<<< HEAD

  const { essay } = note;
  const { image } = getKindDataFromEssay(essay);
  const hasImage = image?.length !== 0;
  const { replyCount, lastRepliers } = note.seal.meta;
  const { isHidden } = usePostToggler(time.toString());
||||||| 0c006213
  const commenters = outline.quippers;
  const { quipCount } = outline;
=======
  const commenters = outline.quippers;
  const { quipCount } = outline;
  const { isHidden } = usePostToggler(time.toString());
>>>>>>> develop

  return (
    <div
      role="link"
      tabIndex={0}
<<<<<<< HEAD
      className={cn(
        'flex w-full cursor-pointer flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8',
        {
          'cursor-pointer': !isHidden,
        }
      )}
||||||| 0c006213
      className={
        'flex w-full cursor-pointer flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8'
      }
=======
      className={cn(
        'flex w-full flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8',
        {
          'cursor-pointer': !isHidden,
        }
      )}
>>>>>>> develop
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
        time={time}
        isInGrid
      />
    </div>
  );
}
