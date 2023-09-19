import React from 'react';
import AddPersonIcon from '@/components/icons/AddPersonIcon';
import { Note } from '@/types/channel';
import DateDivider from './ChatMessage/DateDivider';
import ChatContent from './ChatContent/ChatContent';

interface ChatNoticeProps {
  writ: Note;
  newDay?: Date;
}

export default function ChatNotice({ writ, newDay }: ChatNoticeProps) {
  if (!writ) {
    return null;
  }

  if (!('chat' in writ.essay['han-data'])) {
    return null;
  }

  if (!writ.essay['han-data'].chat) {
    return null;
  }

  if (!('notice' in writ.essay['han-data'].chat)) {
    return null;
  }

  return (
    <div>
      {newDay ? <DateDivider date={newDay} /> : null}
      <div className="flex items-center space-x-3 py-2 pl-10 pr-2">
        <div className="flex items-center justify-center rounded bg-gray-50 p-0.5">
          <AddPersonIcon className="h-6 w-6 text-gray-600" />
        </div>
        <p className="font-semibold text-gray-400">
          <ChatContent story={writ.essay.content} />
        </p>
      </div>
    </div>
  );
}
