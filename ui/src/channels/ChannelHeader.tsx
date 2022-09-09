import cn from 'classnames';
import React, { PropsWithChildren, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import GridIcon from '@/components/icons/GridIcon';
import SortIcon from '@/components/icons/SortIcon';
import useNavStore from '@/components/Nav/useNavStore';
import { useIsMobile } from '@/logic/useMedia';
import {
  useGroup,
  useChannel,
  useAmAdmin,
  useRouteGroup,
} from '@/state/groups';
import ListIcon from '@/components/icons/ListIcon';
import ChannelIcon from '@/channels/ChannelIcon';
import * as Popover from '@radix-ui/react-popover';
import Divider from '@/components/Divider';
import BulletIcon from '@/components/icons/BulletIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import SlidersIcon from '@/components/icons/SlidersIcon';
import useIsChannelHost from '@/logic/useIsChannelHost';
import { nestToFlag, getFlagParts } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';

export type ChannelHeaderProps = PropsWithChildren<{
  flag: string;
  nest: string;
  displayMode?: 'grid' | 'list';
  setDisplayMode?: (displayType: 'grid' | 'list') => void;
  sortMode?: 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc';
  setSortMode?: (
    sortType: 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc'
  ) => void;
  showControls?: boolean;
}>;

const ChannelHeaderButton = React.forwardRef<
  HTMLButtonElement,
  React.HTMLProps<HTMLButtonElement>
>((props, ref) => {
  const { children, className, onClick } = props;
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn('secondary-button', className)}
    >
      {children}
    </button>
  );
});

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
        'dropdown-item flex w-full items-center space-x-2 pr-4',
        className
      )}
    >
      {children}
    </button>
  );
}

function ChannelActions({ nest }: { nest: string }) {
  const [_app, flag] = nestToFlag(nest);
  const isAdmin = useAmAdmin(flag);
  const isChannelHost = useIsChannelHost(flag);
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const { ship, name } = getFlagParts(groupFlag);

  const leave = useCallback(
    (chFlag: string) => {
      const leaver =
        _app === 'chat'
          ? useChatState.getState().leaveChat
          : _app === 'heap'
          ? useHeapState.getState().leaveHeap
          : useDiaryState.getState().leaveDiary;

      leaver(chFlag);
    },
    [_app]
  );

  const leaveChannel = useCallback(async () => {
    try {
      leave(flag);
      navigate(`/groups/${ship}/${name}/channels`);
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:LeaveError] ${error}`);
      }
    }
  }, [flag, ship, name, navigate, leave]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="icon-button h-8 w-8 bg-transparent">
          <EllipsisIcon className="h-6 w-6" />
        </button>
      </Popover.Trigger>
      <Popover.Content>
        <div className="flex flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
          {/* TODO: Will need channel functionality for all these items
              <ChannelHeaderMenuButton>
                <BulletIcon className="h-5 w-5 text-blue-300" />
                <span className="font-semibold text-blue">Invite to Channel</span>
              </ChannelHeaderMenuButton>
              <ChannelHeaderMenuButton>
                <BulletIcon className="h-5 w-5 text-blue-300" />
                <span className="font-semibold text-blue">Copy Channel Link</span>
              </ChannelHeaderMenuButton>
              <ChannelHeaderMenuButton>
                <BulletIcon className="h-5 w-5 text-gray-400" />
                <span className="font-semibold">Subscribed Members...</span>
              </ChannelHeaderMenuButton>
            */}
          {/* TODO: Un-disable this once we have mute controls */}
          <ChannelHeaderMenuButton className="hover:bg-transparent">
            <BulletIcon className="h-6 w-6 text-gray-400" />
            <span className="font-semibold text-gray-400">Mute Channel</span>
          </ChannelHeaderMenuButton>
          {/* TODO: Un-disable this once we have mentions and mutes */}
          <ChannelHeaderMenuButton className="hover:bg-transparent">
            <BulletIcon className="h-6 w-6 text-gray-400" />
            <span className="font-semibold text-gray-400">Mute Mentions</span>
          </ChannelHeaderMenuButton>
          {!isChannelHost ? (
            <ChannelHeaderMenuButton
              className="hover:bg-red-soft"
              onClick={leaveChannel}
            >
              <LeaveIcon className="h-6 w-6 text-red-400" />
              <span className="font-semibold text-red">Leave Channel</span>
            </ChannelHeaderMenuButton>
          ) : null}
          {isAdmin ? (
            <>
              <Divider>Admin</Divider>
              <Link
                to={`/groups/${flag}/info/channels`}
                className="block no-underline"
              >
                <ChannelHeaderMenuButton>
                  <SlidersIcon className="h-6 w-6 text-gray-400" />
                  <span className="font-semibold">Edit Channels</span>
                </ChannelHeaderMenuButton>
              </Link>
            </>
          ) : null}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

export default function ChannelHeader({
  flag,
  nest,
  children,
  displayMode,
  setDisplayMode,
  sortMode,
  setSortMode,
  showControls = false,
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

      {showControls && displayMode && setDisplayMode && setSortMode ? (
        <div className="flex items-center space-x-3">
          {children}
          <ChannelHeaderButton onClick={() => console.log('share')}>
            <span className="font-semibold">Share</span>
          </ChannelHeaderButton>
          {/* TODO: Switch the popovers to dropdowns */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
                {displayMode === 'grid' ? (
                  <GridIcon className="-m-1 h-8 w-8" />
                ) : (
                  <ListIcon className="-m-1 h-8 w-8" />
                )}
              </ChannelHeaderButton>
            </Popover.Trigger>
            <Popover.Content asChild>
              <div className="flex w-[126px] flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
                <ChannelHeaderMenuButton onClick={() => setDisplayMode('list')}>
                  <ListIcon className="-m-1 h-8 w-8" />
                  <span className="font-semibold">List</span>
                </ChannelHeaderMenuButton>
                <ChannelHeaderMenuButton onClick={() => setDisplayMode('grid')}>
                  <GridIcon className="-m-1 h-8 w-8" />
                  <span className="font-semibold">Grid</span>
                </ChannelHeaderMenuButton>
              </div>
            </Popover.Content>
          </Popover.Root>
          <Popover.Root>
            <Popover.Trigger asChild>
              <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
                <SortIcon className="h-6 w-6" />
              </ChannelHeaderButton>
            </Popover.Trigger>
            <Popover.Content asChild>
              <div className="flex max-w-sm flex-col rounded-lg bg-white p-2 leading-5 drop-shadow-lg">
                <ChannelHeaderMenuButton
                  onClick={() => setSortMode('time-dsc')}
                >
                  <span className="font-semibold">New Posts First</span>
                </ChannelHeaderMenuButton>
                <ChannelHeaderMenuButton
                  onClick={() => setSortMode('time-asc')}
                >
                  <span className="font-semibold">Old Posts First</span>
                </ChannelHeaderMenuButton>
                <Divider />
                <ChannelHeaderMenuButton
                // onClick={() => setSortMode('quip-asc')}
                >
                  <span className="font-semibold text-gray-400">
                    New Comments First
                  </span>
                </ChannelHeaderMenuButton>
                <ChannelHeaderMenuButton
                // onClick={() => setSortMode('quip-dsc')}
                >
                  <span className="font-semibold text-gray-400">
                    Old Comments First
                  </span>
                </ChannelHeaderMenuButton>
              </div>
            </Popover.Content>
          </Popover.Root>
          <ChannelActions {...{ nest }} />
        </div>
      ) : (
        <ChannelActions {...{ nest }} />
      )}
    </div>
  );
}
