import { useNavigate } from 'react-router';
import { Outline, NoteEssay } from '@/types/channel';
import { useCalm } from '@/state/settings';
import getHanDataFromEssay from '@/logic/getHanData';
import DiaryNoteHeadline from '../DiaryNoteHeadline';

interface DiaryGridItemProps {
  outline: Outline;
  time: bigInt.BigInteger;
}

export default function DiaryGridItem({ outline, time }: DiaryGridItemProps) {
  const essay: NoteEssay = outline;
  const { image } = getHanDataFromEssay(essay);
  const navigate = useNavigate();
  const hasImage = image?.length !== 0;
  const calm = useCalm();
  const commenters = outline.quippers;
  const { quipCount } = outline;

  return (
    <div
      role="link"
      tabIndex={0}
      className={
        'flex w-full cursor-pointer flex-col space-y-8 rounded-xl bg-white bg-cover bg-center p-8'
      }
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
        quippers={commenters}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInGrid
      />
    </div>
  );
}
