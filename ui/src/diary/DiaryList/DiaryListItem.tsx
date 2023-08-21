import React from 'react';
import cn from 'classnames';
import { DiaryOutline } from '@/types/diary';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useNavigate } from 'react-router';
import { useIsNotePending } from '@/state/diary';

interface DiaryListItemProps {
  outline: DiaryOutline;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ outline, time }: DiaryListItemProps) {
  const isPending = useIsNotePending(time.toString());
  const navigate = useNavigate();
  const essay = outline;
  const { quippers, quipCount } = outline;

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
        quippers={quippers}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInList
      />
    </div>
  );
}
