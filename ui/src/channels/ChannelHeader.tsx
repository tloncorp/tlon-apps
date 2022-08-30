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
import ChannelIcon from '@/channels/ChannelIcon';
import * as Popover from '@radix-ui/react-popover';

export interface ChannelHeaderProps {
  flag: string;
  nest: string;
  displayMode?: 'grid' | 'list';
  setDisplayMode?: (displayType: 'grid' | 'list') => void;
  sortMode?: 'time' | 'alpha';
  setSortMode?: (sortType: 'time' | 'alpha') => void;
  isHeap?: boolean;
}

function ChannelHeaderButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button onClick={onClick} className={cn('secondary-button', className)}>
      {children}
    </button>
  );
}

function ChannelHeaderMenuButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'default-focus text-md flex w-full items-center space-x-3 rounded-lg py-2 px-4 font-semibold font-semibold  leading-4 text-gray-600 hover:bg-gray-50',
        className
      )}
    >
      {children}
    </button>
  );
}

export default function ChannelHeader({
  flag,
  nest,
  displayMode,
  setDisplayMode,
  sortMode,
  setSortMode,
  isHeap = false,
}: ChannelHeaderProps) {
  const group = useGroup(flag);
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
            <div className="text-md font-semibold">{channel?.meta.title}</div>
            <span className="text-sm font-medium text-gray-600">
              {groupName}
            </span>
          </div>
        </div>
      </button>

      {isHeap && displayMode && setDisplayMode && setSortMode ? (
        <div className="flex items-center space-x-12">
          <div className="flex items-center space-x-2">
            <ChannelHeaderButton onClick={() => console.log('share')}>
              <span className="font-semibold">Share</span>
            </ChannelHeaderButton>
            <Popover.Root>
              <Popover.Anchor>
                <Popover.Trigger asChild>
                  <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
                    {displayMode === 'grid' ? (
                      <GridIcon className="-m-1 h-8 w-8" />
                    ) : (
                      <ListIcon className="-m-1 h-8 w-8" />
                    )}
                  </ChannelHeaderButton>
                </Popover.Trigger>
                <Popover.Content>
                  <div className="flex w-[126px] flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
                    <ChannelHeaderMenuButton
                      onClick={() => setDisplayMode('list')}
                    >
                      <ListIcon className="-m-1 h-8 w-8" />
                      <span className="font-semibold">List</span>
                    </ChannelHeaderMenuButton>
                    <ChannelHeaderMenuButton
                      onClick={() => setDisplayMode('grid')}
                    >
                      <GridIcon className="-m-1 h-8 w-8" />
                      <span className="font-semibold">Grid</span>
                    </ChannelHeaderMenuButton>
                  </div>
                </Popover.Content>
              </Popover.Anchor>
            </Popover.Root>
            <Popover.Root>
              <Popover.Anchor>
                <Popover.Trigger asChild>
                  <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
                    <SortIcon className="h-6 w-6" />
                  </ChannelHeaderButton>
                </Popover.Trigger>
              </Popover.Anchor>
              <Popover.Content>
                <div className="flex w-[126px] flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
                  <ChannelHeaderMenuButton onClick={() => setSortMode('time')}>
                    <span className="font-semibold">Time</span>
                  </ChannelHeaderMenuButton>
                  <ChannelHeaderMenuButton onClick={() => setSortMode('alpha')}>
                    <span className="font-semibold">Alphabetical</span>
                  </ChannelHeaderMenuButton>
                </div>
              </Popover.Content>
            </Popover.Root>
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
