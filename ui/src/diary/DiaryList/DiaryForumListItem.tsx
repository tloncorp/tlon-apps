import React from 'react';
import { DiaryLetter } from '@/types/diary';
import { useNavigate } from 'react-router';
import { sampleQuippers } from '@/logic/utils';
import DiaryForumHeadline from '../DiaryForumHeadline';

interface DiaryForumListItemProps {
  letter: DiaryLetter;
  time: bigInt.BigInteger;
}

export default function DiaryForumListItem({
  letter,
  time,
}: DiaryForumListItemProps) {
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
      className="cursor-pointer rounded-xl bg-white p-4"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryForumHeadline
        quippers={quippers}
        quipCount={quipCount}
        essay={essay}
        time={time}
        isInList
      />
    </div>
  );
}
