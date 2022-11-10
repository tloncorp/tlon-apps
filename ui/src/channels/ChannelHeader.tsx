import cn from 'classnames';
import React, { PropsWithChildren, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import GridIcon from '@/components/icons/GridIcon';
import SortIcon from '@/components/icons/SortIcon';
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
  sortMode?:
    | 'time-dsc'
    | 'quip-dsc'
    | 'time-asc'
    | 'quip-asc'
    | 'alpha'
    | 'time';
  setSortMode?: (sortType: any) => void;
  isDiary?: boolean;
  showControls?: boolean;
}>;

interface ChannelHeaderSortControlsProps {
  setSortMode?: (sortType: any) => void;
}

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
  const isMobile = useIsMobile();

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
      navigate(
        isMobile
          ? `/groups/${ship}/${name}`
          : `/groups/${ship}/${name}/channels`
      );
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:LeaveError] ${error}`);
      }
    }
  }, [flag, ship, name, navigate, leave, isMobile]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="icon-button h-8 w-8 bg-transparent">
          <EllipsisIcon className="h-6 w-6" />
        </button>
      </Popover.Trigger>
      <Popover.Content>
        <div className="flex flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
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

function HeapSortControls({ setSortMode }: ChannelHeaderSortControlsProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
          <SortIcon className="h-6 w-6" />
        </ChannelHeaderButton>
      </Popover.Trigger>
      <Popover.Content>
        <div className="flex w-[126px] flex-col rounded-lg bg-white leading-5 drop-shadow-lg">
          <ChannelHeaderMenuButton
            onClick={() => (setSortMode ? setSortMode('time') : null)}
          >
            <span className="font-semibold">Time</span>
          </ChannelHeaderMenuButton>
          <ChannelHeaderMenuButton
            onClick={() => (setSortMode ? setSortMode('alpha') : null)}
          >
            <span className="font-semibold">Alphabetical</span>
          </ChannelHeaderMenuButton>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

function DiarySortControls({ setSortMode }: ChannelHeaderSortControlsProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ChannelHeaderButton className="icon-button h-8 w-8 bg-transparent">
          <SortIcon className="h-6 w-6" />
        </ChannelHeaderButton>
      </Popover.Trigger>
      <Popover.Content>
        <div className="flex max-w-sm flex-col rounded-lg bg-white p-2 leading-5 drop-shadow-lg">
          <ChannelHeaderMenuButton
            onClick={() => (setSortMode ? setSortMode('time-dsc') : null)}
          >
            <span className="font-semibold">New Posts First</span>
          </ChannelHeaderMenuButton>
          <ChannelHeaderMenuButton
            onClick={() => (setSortMode ? setSortMode('time-asc') : null)}
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
  isDiary = false,
  showControls = false,
}: ChannelHeaderProps) {
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const channel = useChannel(flag, nest);
  const groupName = group?.meta.title;
  const BackButton = isMobile ? Link : 'div';

  return (
    <div
      className={cn(
        'flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-2'
      )}
    >
      <BackButton
        to="../.."
        className={cn(
          'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
          isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
        )}
        aria-label="Open Channels Menu"
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
      </BackButton>

      {showControls && displayMode && setDisplayMode && setSortMode ? (
        <div className="flex items-center space-x-3">
          {children}
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
          {isDiary ? (
            <DiarySortControls setSortMode={setSortMode} />
          ) : (
            <HeapSortControls setSortMode={setSortMode} />
          )}

          <ChannelActions {...{ nest }} />
        </div>
      ) : (
        <ChannelActions {...{ nest }} />
      )}
    </div>
  );
}
