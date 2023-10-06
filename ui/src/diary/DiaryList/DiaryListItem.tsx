import React from 'react';
import cn from 'classnames';
import { DiaryOutline } from '@/types/diary';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useNavigate } from 'react-router';
import { useIsNotePending, usePostToggler } from '@/state/diary';

interface DiaryListItemProps {
  outline: DiaryOutline;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ outline, time }: DiaryListItemProps) {
  const isPending = useIsNotePending(time.toString());
  const navigate = useNavigate();
  const essay = outline;
  const { quippers, quipCount } = outline;
  const { isHidden } = usePostToggler(time.toString());

  return (
    <div
      className={cn('card border border-gray-100', {
        'cursor-pointer': !isHidden,
        'bg-gray-100': isPending,
      })}
      role="link"
      tabIndex={0}
      onClick={() => !isHidden && navigate(`note/${time.toString()}`)}
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
