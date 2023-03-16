import cn from 'classnames';
import React from 'react';
import ChannelIcon from '@/channels/ChannelIcon';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/logic/useMedia';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';

export interface DiaryNoteHeaderProps {
  title: string;
  time: string;
  canEdit: boolean;
}

export default function DiaryNoteHeader({
  title,
  time,
  canEdit,
}: DiaryNoteHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        'flex items-center justify-between bg-white',
        isMobile ? 'px-6 pt-10 pb-4' : 'border-b-2 border-gray-50 px-4 py-4'
      )}
    >
      <Link
        to=".."
        className={cn(
          'default-focus ellipsis -ml-2 -mt-2 -mb-2 inline-flex appearance-none items-center rounded-md p-2 pr-4 text-lg font-bold text-gray-800 hover:bg-gray-50 sm:text-base sm:font-semibold',
          isMobile && ''
        )}
        aria-label="Open Channels Menu"
      >
        <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />

        <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
          <ChannelIcon nest="diary" className="h-5 w-5 text-gray-400" />
        </div>
        <span className="ellipsis line-clamp-1">{title}</span>
      </Link>

      <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
        {isMobile && <ReconnectingSpinner />}
        {canEdit ? (
          <Link to={`../edit/${time}`} className="small-button">
            Edit
          </Link>
        ) : null}
      </div>
    </div>
  );
}
