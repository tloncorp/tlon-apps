import React from 'react';
import AddPersonIcon from '@/components/icons/AddPersonIcon';
import ShipName from '@/components/ShipName';
import { ChatWrit } from '@/types/chat';
import DateDivider from './ChatMessage/DateDivider';

interface ChatNoticeProps {
  writ: ChatWrit;
  newDay?: Date;
}

const sp = '\u0020';
export default function ChatNotice({ writ, newDay }: ChatNoticeProps) {
  if (!('notice' in writ.memo.content)) {
    return null;
  }

  const { notice } = writ.memo.content;

  return (
    <div>
      {newDay ? <DateDivider date={newDay} /> : null}
      <div className="flex items-center space-x-3 py-2 pl-10 pr-2">
        <div className="flex items-center justify-center rounded bg-gray-50 p-0.5">
          <AddPersonIcon className="h-6 w-6 text-gray-600" />
        </div>
        <p className="font-semibold text-gray-400">
          {notice.pfix.length > 0 ? (
            <>
              {notice.pfix}
              {sp}
            </>
          ) : null}
          <ShipName name={writ.memo.author} showAlias />
          {notice.sfix.length > 0 ? (
            <>
              {sp}
              {notice.sfix}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
