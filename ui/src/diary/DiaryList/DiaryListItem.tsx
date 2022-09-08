import React from 'react';
import { DiaryNote } from '@/types/diary';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useNavigate } from 'react-router';

interface DiaryListItemProps {
  note: DiaryNote;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ note, time }: DiaryListItemProps) {
  const navigate = useNavigate();

  return (
    <div
      className="cursor-pointer rounded-xl bg-white p-8"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`note/${time.toString()}`)}
    >
      <DiaryNoteHeadline note={note} time={time} isInList />
    </div>
  );
}
