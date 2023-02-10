import React from 'react';
import { DiaryLetter, DiaryNote } from '@/types/diary';
import { useChannelFlag } from '@/hooks';
import DiaryNoteHeadline from '@/diary/DiaryNoteHeadline';
import { useNavigate } from 'react-router';
import { sampleQuippers } from '@/logic/utils';
import { useNote } from '@/state/diary';
import NoteReactions from '../NoteReactions/NoteReactions';

interface DiaryListItemProps {
  letter: DiaryLetter;
  time: bigInt.BigInteger;
}

export default function DiaryListItem({ letter, time }: DiaryListItemProps) {
  const navigate = useNavigate();
  const chFlag = useChannelFlag();
  // pulling in the note here defeats the whole purpose of outlines.
  // we need to include feels in outlines to get ride of this call.
  const [_, note] = useNote(chFlag || '', time.toString());
  const essay = letter.type === 'outline' ? letter : letter.essay;
  const quippers =
    letter.type === 'outline'
      ? letter.quippers
      : sampleQuippers(letter.seal.quips);
  const quipCount =
    letter.type === 'outline' ? letter.quipCount : letter.seal.quips.size;

  return (
    <div
      className="cursor-pointer rounded-xl bg-white p-8"
      role="link"
      tabIndex={0}
    >
      <div onClick={() => navigate(`note/${time.toString()}`)}>
        <DiaryNoteHeadline
          quippers={quippers}
          quipCount={quipCount}
          essay={essay}
          time={time}
          isInList
        />
      </div>
      <NoteReactions
        whom={chFlag || ''}
        time={time.toString()}
        seal={note.seal}
      />
    </div>
  );
}
