import React, {
  PropsWithChildren,
  useCallback,
  useState,
  useEffect,
} from 'react';
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
  useGroupState,
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
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import { useNotifications } from '@/notifications/useNotifications';
import useHarkState from '@/state/hark';
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
      await leave(flag);
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
      await useGroupState.getState().deleteChannel(groupFlag, nest);
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
  }, [deleteChannelIsOpen, groupFlag, isMobile, name, navigate, nest, ship]);

  return (
    <>
      <Dropdown.Root open={dropdownIsOpen} onOpenChange={setDropdownIsOpen}>
        <Dropdown.Trigger asChild>
          <button
            className="flex h-6 w-6 items-center justify-center rounded  text-gray-400 hover:bg-gray-50"
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
                className="dropdown-item text-red"
                onClick={() => setDeleteChannelIsOpen(!deleteChannelIsOpen)}
              >
                Delete {prettyAppName()}
              </Dropdown.Item>
            </>
          )}
          {!isChannelHost && (
            <Dropdown.Item
              className="dropdown-item text-red"
              onClick={leaveChannel}
            >
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
        <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-400 hover:bg-gray-50 ">
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
          <span className="font-semibold">Time</span>
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'alpha' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('alpha') : null)}
        >
          <span className="font-semibold">Alphabetical</span>
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
        <button className="flex h-6 w-6 items-center justify-center rounded  text-gray-400 hover:bg-gray-50 ">
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
          <span className="font-semibold">New Posts First</span>
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'time-asc' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => (setSortMode ? setSortMode('time-asc') : null)}
        >
          <span className="font-semibold">Old Posts First</span>
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'quip-asc' && 'bg-gray-100 hover:bg-gray-100'
          )}
        >
          <span className="font-semibold text-gray-400">
            New Comments First
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'quip-dsc' && 'bg-gray-100 hover:bg-gray-100'
          )}
        >
          <span className="font-semibold text-gray-400">
            Old Comments First
          </span>
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
  const { isGroupUnread } = useIsGroupUnread();
  const hasActivity = isGroupUnread(flag);
  const { notifications } = useNotifications(flag);

  useEffect(() => {
    if (hasActivity) {
      const unreadBins = notifications
        .filter((n) => n.bins.some((b) => b.unread === true))[0]
        ?.bins.filter((b) => b.unread === true);

      if (unreadBins) {
        const unreadsHere = unreadBins.filter((b) =>
          b.topYarn.wer.includes(nest)
        );

        unreadsHere.forEach((n, index) => {
          // update on the last call
          useHarkState
            .getState()
            .sawRope(n.topYarn.rope, index === unreadsHere.length - 1);
        });
      }
    }
  }, [hasActivity, notifications, nest]);

  function backTo() {
    if (isMobile && isTalk) {
      return '/';
    }
    return `/groups/${flag}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4'
      )}
    >
      <BackButton
        to={backTo()}
        className={cn(
          'default-focus ellipsis inline-flex appearance-none items-center pr-2 text-lg font-bold text-gray-800 sm:text-base sm:font-semibold',
          isMobile && ''
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
        ) : null}
        <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
          <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
        </div>
        <span className="ellipsis line-clamp-1">{channel?.meta.title}</span>
      </BackButton>
      <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
        {isMobile && <ReconnectingSpinner />}
        {showControls && displayMode && setDisplayMode && setSortMode ? (
          <>
            {children}
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <button className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-50 ">
                  {displayMode === 'grid' ? (
                    <GridIcon className="h-6 w-6 text-gray-400" />
                  ) : (
                    <ListIcon className="h-6 w-6 text-gray-400" />
                  )}
                </button>
              </Dropdown.Trigger>
              <Dropdown.Content className="dropdown">
                <Dropdown.Item
                  className={cn(
                    'dropdown-item-icon',
                    displayMode === 'list' && 'hover-bg-gray-100 bg-gray-100'
                  )}
                  onClick={() => setDisplayMode('list')}
                >
                  <div className="rounded bg-gray-50 p-1 mix-blend-multiply dark:mix-blend-screen">
                    <ListIcon className="-m-1 h-8 w-8" />
                  </div>
                  <span className="font-semibold">List</span>
                </Dropdown.Item>
                <Dropdown.Item
                  className={cn(
                    'dropdown-item-icon',
                    displayMode === 'grid' && 'bg-gray-100 hover:bg-gray-100'
                  )}
                  onClick={() => setDisplayMode('grid')}
                >
                  <div className="rounded bg-gray-50 p-1 mix-blend-multiply dark:mix-blend-screen">
                    <GridIcon className="-m-1 h-8 w-8" />
                  </div>
                  <span className="font-semibold">Grid</span>
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
