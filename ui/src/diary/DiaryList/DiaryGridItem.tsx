import cn from 'classnames';
import { useNavigate } from 'react-router';
import { DiaryOutline, NoteEssay } from '@/types/diary';
import { useCalm } from '@/state/settings';
import { usePostToggler } from '@/state/diary';
import DiaryNoteHeadline from '../DiaryNoteHeadline';

interface DiaryGridItemProps {
  outline: DiaryOutline;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ outline, time }: DiaryGridItemProps) {
  const essay: NoteEssay = outline;
  const navigate = useNavigate();
  const hasImage = outline.image?.length !== 0;
  const calm = useCalm();
  const commenters = outline.quippers;
  const { quipCount } = outline;
  const { isHidden } = usePostToggler(time.toString());

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
              backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.33), rgba(0, 0, 0, 0.33)), url(${essay.image})`,
              color: '#ffffff',
            }
          : undefined
      }
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        quippers={commenters}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInGrid
      />
    </div>
  );
}
