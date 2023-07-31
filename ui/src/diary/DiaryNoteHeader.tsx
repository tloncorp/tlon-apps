import cn from 'classnames';
import React from 'react';
import ChannelIcon from '@/channels/ChannelIcon';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/logic/useMedia';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { useChannel as useChannelSpecific } from '@/logic/channel';

export interface DiaryNoteHeaderProps {
  title: string;
  time: string;
  canEdit: boolean;
  nest: string;
}

export default function DiaryNoteHeader({
  title,
  time,
  canEdit,
  nest,
}: DiaryNoteHeaderProps) {
  const isMobile = useIsMobile();

  const chan = useChannelSpecific(nest);
  const saga = chan?.saga || null;

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <Link
        to=".."
        className={cn(
          'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
        )}
        aria-label="Open Channels Menu"
      >
        <div className="flex h-6 w-6 items-center justify-center">
          <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
        </div>

        <ChannelIcon nest="diary" className="h-6 w-6 shrink-0 text-gray-600" />
        <div className="flex w-full flex-col justify-center">
          <span
            className={cn(
              'ellipsis text-lg font-bold line-clamp-1 sm:text-sm sm:font-semibold'
            )}
          >
            {title}
          </span>
        </div>
      </Link>

      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        {canEdit && saga && 'synced' in saga ? (
          <Link to={`../edit/${time}`} className="small-button">
            Edit
          </Link>
        ) : null}
      </div>
    </div>
  );
}
