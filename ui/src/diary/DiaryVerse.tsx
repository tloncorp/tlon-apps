import { InlineContent } from '@/chat/ChatContent/ChatContent';
import { Verse } from '@/types/diary';
import React from 'react';

export interface DiaryVerseProps {
  verse: Verse;
  onClick?: () => void;
}

export function DiaryVerse(props: DiaryVerseProps) {
  const { verse, onClick } = props;

  if ('inline' in verse) {
    return (
      <div onClick={onClick}>
        {verse.inline.map((s) => (
          <InlineContent story={s} />
        ))}
      </div>
    );
  }
  return <div>TODO: block nodes</div>;
}
