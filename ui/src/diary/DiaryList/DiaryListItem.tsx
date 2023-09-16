import cn from 'classnames';
import { useNavigate } from 'react-router';
import { Note } from '@/types/channel';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useIsNotePending } from '@/state/channel/channel';

interface DiaryListItemProps {
  note: Note;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ note, time }: DiaryListItemProps) {
  const isPending = useIsNotePending(time.toString());
  const navigate = useNavigate();

  const { essay } = note;
  const { lastQuippers, quipCount } = note.seal;

  return (
    <div
      className={cn('card cursor-pointer border border-gray-100', {
        'bg-gray-100': isPending,
      })}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline
        lastQuippers={lastQuippers}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInList
      />
    </div>
  );
}
