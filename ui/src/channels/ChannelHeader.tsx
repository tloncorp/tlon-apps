import React, { PropsWithChildren, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { GroupChannel } from '@/types/groups';
import { useIsMobile } from '@/logic/useMedia';
import useIsChannelHost from '@/logic/useIsChannelHost';
import { nestToFlag, getFlagParts, isTalk } from '@/logic/utils';
import {
  useChannel,
  useAmAdmin,
  useRouteGroup,
  useDeleteChannelMutation,
} from '@/state/groups';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ChannelIcon from '@/channels/ChannelIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import GridIcon from '@/components/icons/GridIcon';
import ListIcon from '@/components/icons/ListIcon';
import SortIcon from '@/components/icons/SortIcon';
import { Status } from '@/logic/status';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSortMode?: (sortType: any) => void;
  isDiary?: boolean;
  showControls?: boolean;
}>;

interface ChannelHeaderSortControlsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSortMode?: (sortType: any) => void;
  sortMode:
    | 'time-dsc'
    | 'quip-dsc'
    | 'time-asc'
    | 'quip-asc'
    | 'alpha'
    | 'time'
    | undefined;
}

function ChannelActions({
  nest,
  channel,
  isAdmin,
}: {
  nest: string;
  channel: GroupChannel | undefined;
  isAdmin: boolean | undefined;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [_app, flag] = nestToFlag(nest);
  const groupFlag = useRouteGroup();
  const { ship, name } = getFlagParts(groupFlag);
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  const isChannelHost = useIsChannelHost(flag);
  const { mutate: deleteChannelMutate } = useDeleteChannelMutation();

  function prettyAppName() {
    switch (_app) {
      case 'diary':
        return 'Notebook';
      case 'chat':
        return 'Chat';
      case 'heap':
        return 'Gallery';
      default:
        return 'Channel';
    }
  }

  const leave = useCallback(
    async (chFlag: string) => {
      const leaver =
        _app === 'chat'
          ? useChatState.getState().leaveChat
          : _app === 'heap'
          ? useHeapState.getState().leaveHeap
          : useDiaryState.getState().leaveDiary;

      await leaver(chFlag);
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
        // eslint-disable-next-line no-console
        console.error(`[ChannelHeader:LeaveError] ${error}`);
      }
    }
  }, [flag, ship, name, navigate, leave, isMobile]);

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteStatus('loading');
    try {
      deleteChannelMutate({ flag: groupFlag, nest });
      navigate(
        isMobile
          ? `/groups/${ship}/${name}`
          : `/groups/${ship}/${name}/channels`
      );
      setDeleteStatus('success');
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (error) {
      setDeleteStatus('error');
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [
    deleteChannelIsOpen,
    groupFlag,
    nest,
    deleteChannelMutate,
    isMobile,
    name,
    navigate,
    ship,
  ]);

  return (
    <>
      <Dropdown.Root open={dropdownIsOpen} onOpenChange={setDropdownIsOpen}>
        <Dropdown.Trigger asChild>
          <button
            className="flex h-6 w-6 items-center justify-center rounded  text-gray-600 hover:bg-gray-50"
            aria-label="Channel Options"
          >
            <EllipsisIcon className="h-6 w-6" />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Content className="dropdown">
          {isAdmin && (
            <>
              <Dropdown.Item
                className="dropdown-item"
                onClick={() => setEditIsOpen(!editIsOpen)}
              >
                Edit {prettyAppName()}
              </Dropdown.Item>
              <Dropdown.Item
                className="dropdown-item-red"
                onClick={() => setDeleteChannelIsOpen(!deleteChannelIsOpen)}
              >
                Delete {prettyAppName()}
              </Dropdown.Item>
            </>
          )}
          {!isChannelHost && (
            <Dropdown.Item className="dropdown-item-red" onClick={leaveChannel}>
              Leave {prettyAppName()}
            </Dropdown.Item>
          )}
        </Dropdown.Content>
      </Dropdown.Root>
      {channel && (
        <>
          <EditChannelModal
            editIsOpen={editIsOpen}
            setEditIsOpen={setEditIsOpen}
            nest={nest}
            channel={channel}
            setDeleteChannelIsOpen={setDeleteChannelIsOpen}
            app={_app}
          />
          <DeleteChannelModal
            deleteChannelIsOpen={deleteChannelIsOpen}
            onDeleteChannelConfirm={onDeleteChannelConfirm}
            setDeleteChannelIsOpen={setDeleteChannelIsOpen}
            channel={channel}
            deleteStatus={deleteStatus}
          />
        </>
      )}
    </>
  );
}

function HeapSortControls({
  setSortMode,
  sortMode,
}: ChannelHeaderSortControlsProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-600 hover:bg-gray-50 ">
          <SortIcon className="h-6 w-6" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'time' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('time') : null)}
        >
          Time
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'alpha' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('alpha') : null)}
        >
          Alphabetical
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

function DiarySortControls({
  setSortMode,
  sortMode,
}: ChannelHeaderSortControlsProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-600 hover:bg-gray-50 ">
          <SortIcon className="h-6 w-6" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'time-dsc' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('time-dsc') : null)}
        >
          New Posts First
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'time-asc' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('time-asc') : null)}
        >
          Old Posts First
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'quip-asc' && 'bg-gray-100 hover:bg-gray-100'
          )}
        >
          New Comments First
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'quip-dsc' && 'bg-gray-100 hover:bg-gray-100'
          )}
        >
          Old Comments First
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
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
  const isMobile = useIsMobile();
  const channel = useChannel(flag, nest);
  const BackButton = isMobile ? Link : 'div';
  const isAdmin = useAmAdmin(flag);

  function backTo() {
    if (isMobile && isTalk) {
      return '/';
    }
    return `/groups/${flag}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <BackButton
        to={backTo()}
        className={cn(
          'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <div className="flex h-6 w-6 items-center justify-center">
            <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
          </div>
        ) : null}
        <ChannelIcon nest={nest} className="h-6 w-6 shrink-0 text-gray-600" />
        <div className="flex w-full flex-col justify-center">
          <span
            className={cn(
              'ellipsis font-bold line-clamp-1 sm:font-semibold',
              channel?.meta.description ? 'text-sm' : 'text-lg sm:text-sm'
            )}
          >
            {channel?.meta.title}
          </span>
          <span className="w-full break-all text-sm text-gray-400 line-clamp-1">
            {channel?.meta.description}
          </span>
        </div>
      </BackButton>
      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        {showControls && displayMode && setDisplayMode && setSortMode ? (
          <>
            {children}
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <button className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-50 ">
                  {displayMode === 'grid' ? (
                    <GridIcon className="h-6 w-6" />
                  ) : (
                    <ListIcon className="h-6 w-6" />
                  )}
                </button>
              </Dropdown.Trigger>
              <Dropdown.Content className="dropdown">
                <Dropdown.Item
                  className={cn(
                    'dropdown-item',
                    displayMode === 'list' && 'hover-bg-gray-100 bg-gray-100'
                  )}
                  onClick={() => setDisplayMode('list')}
                >
                  List
                </Dropdown.Item>
                <Dropdown.Item
                  className={cn(
                    'dropdown-item-icon',
                    displayMode === 'grid' && 'bg-gray-100 hover:bg-gray-100'
                  )}
                  onClick={() => setDisplayMode('grid')}
                >
                  Grid
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>

            {isDiary ? (
              <DiarySortControls
                setSortMode={setSortMode}
                sortMode={sortMode}
              />
            ) : (
              <HeapSortControls setSortMode={setSortMode} sortMode={sortMode} />
            )}
            <ChannelActions {...{ nest, channel, isAdmin }} />
          </>
        ) : (
          <ChannelActions {...{ nest, channel, isAdmin }} />
        )}
      </div>
    </div>
  );
}
