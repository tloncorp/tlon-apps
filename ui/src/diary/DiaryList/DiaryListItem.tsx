import React from 'react';
import cn from 'classnames';
import { DiaryLetter } from '@/types/diary';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useNavigate } from 'react-router';
import { sampleQuippers } from '@/logic/utils';
import { useIsNotePending } from '@/state/diary';

interface DiaryListItemProps {
  letter: DiaryLetter;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ letter, time }: DiaryListItemProps) {
  const isPending = useIsNotePending(time.toString());
  const navigate = useNavigate();
  const essay = letter.type === 'outline' ? letter : letter.essay;
  const quippers =
    letter.type === 'outline'
      ? letter.quippers
      : sampleQuippers(letter.seal.quips);
  const quipCount =
    letter.type === 'outline' ? letter.quipCount : letter.seal.quips.size;

  return (
    <div
      className={cn('card cursor-pointer', {
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
