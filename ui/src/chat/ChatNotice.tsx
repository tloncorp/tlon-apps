import React from 'react';
import PersonIcon from '../components/icons/PersonIcon';
import ShipName from '../components/ShipName';
import { ChatWrit } from '../types/chat';

const nbsp = '\u00A0';
export default function ChatNotice(props: { writ: ChatWrit }) {
  const { writ } = props;

  if (!('notice' in writ.memo.content)) {
    return null;
  }
  const { notice } = writ.memo.content;

  return (
    <div className="flex items-center space-x-3 py-2">
      <PersonIcon className="h-6 w-6" />
      <div className="flex italic">
        {notice.pfix.length > 0 ? (
          <>
            {notice.pfix}
            {nbsp}
          </>
        ) : null}
        <ShipName name={writ.memo.author} showAlias />
        {notice.sfix.length > 0 ? (
          <>
            {nbsp}
            {notice.sfix}
          </>
        ) : null}
      </div>
    </div>
  );
}
