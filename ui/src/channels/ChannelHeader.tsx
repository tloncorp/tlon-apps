import cn from 'classnames';
import React from 'react';
import { useParams } from 'react-router';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import GridIcon from '@/components/icons/GridIcon';
import SortIcon from '@/components/icons/SortIcon';
import ShareIcon from '@/components/icons/ShareIcon';
import useNavStore from '@/components/Nav/useNavStore';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useChannel } from '@/state/groups';
import { Link } from 'react-router-dom';
import ListIcon from '@/components/icons/ListIcon';
import ChannelIcon from './ChannelIcon';

export interface ChannelHeaderProps {
  flag: string;
  nest: string;
  displayType?: 'grid' | 'list';
  setDisplayType?: (displayType: 'grid' | 'list') => void;
}

function ChannelHeaderButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-1 rounded-lg bg-transparent p-2 text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2"
    >
      {children}
    </button>
  );
}

export default function ChannelHeader({
  flag,
  nest,
  displayType,
  setDisplayType,
}: ChannelHeaderProps) {
  const group = useGroup(flag);
  const { app } = useParams();
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const channel = useChannel(flag, nest);
  const groupName = group?.meta.title;

  return (
    <div
      className={cn(
        'flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-2'
      )}
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
            <ChannelIcon nest={nest} className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium text-gray-600">
              {groupName}
            </span>
            <div className="text-md font-semibold">{channel?.meta.title}</div>
          </div>
        </div>
      </button>

      {app === 'heap' && displayType && setDisplayType ? (
        <div className="flex items-center space-x-12">
          <div className="flex items-center space-x-2">
            {displayType === 'grid' ? (
              <ChannelHeaderButton onClick={() => setDisplayType('list')}>
                <GridIcon className="-m-1 h-8 w-8" />
                <span className="font-semibold">Grid</span>
              </ChannelHeaderButton>
            ) : (
              <ChannelHeaderButton onClick={() => setDisplayType('grid')}>
                <ListIcon className="-m-1 h-8 w-8" />
                <span className="font-semibold">List</span>
              </ChannelHeaderButton>
            )}
            <ChannelHeaderButton onClick={() => console.log('toggle sort')}>
              <SortIcon className="h-6 w-6" />
              <span className="font-semibold">Sort</span>
            </ChannelHeaderButton>
          </div>
          <div className="flex items-center space-x-3">
            <ChannelHeaderButton onClick={() => console.log('share')}>
              <ShareIcon className="h-6 w-6" />
              <span className="font-semibold">Share</span>
            </ChannelHeaderButton>
            <Link
              className="icon-button h-8 w-8 bg-transparent"
              to={`/groups/${flag}/info/channels`}
            >
              <EllipsisIcon className="h-6 w-6" />
            </Link>
          </div>
        </div>
      ) : (
        <Link
          className="icon-button h-8 w-8 bg-transparent"
          to={`/groups/${flag}/info/channels`}
        >
          <EllipsisIcon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
