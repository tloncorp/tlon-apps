import cn from 'classnames';
import React from 'react';
import BubbleIcon from '@/components/icons/BubbleIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import useNavStore from '@/components/Nav/useNavStore';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useChannel } from '@/state/groups';
import { Link } from 'react-router-dom';

export interface ChannelHeaderProps {
  flag: string;
  nest: string;
}

export default function ChannelHeader({ flag, nest }: ChannelHeaderProps) {
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const channel = useChannel(flag, nest)!;
  const groupName = group?.meta.title;

  return (
    <div
      className={cn('flex h-full items-center border-b-2 border-gray-50 p-2')}
    >
      <button
        className={cn(
          'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
          isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
        )}
        aria-label="Open Channels Menu"
        onClick={() => isMobile && navPrimary('group', flag)}
      >
        {isMobile ? (
          <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
        ) : null}
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-50">
            {/* TODO: Channel Type icons */}
            <BubbleIcon className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium text-gray-600">
              {groupName}
            </span>
            <div className="text-md font-semibold">{channel.meta.title}</div>
          </div>
        </div>
      </button>

      <Link
        className="icon-button ml-auto h-8 w-8 bg-transparent"
        to={`/groups/${flag}/info/channels`}
      >
        <EllipsisIcon className="h-6 w-6" />
      </Link>
    </div>
  );
}
