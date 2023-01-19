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
  useGroup,
  useChannel,
  useAmAdmin,
  useRouteGroup,
  useGroupState,
} from '@/state/groups';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import EditChannelModal from '@/groups/GroupAdmin/AdminChannels/EditChannelModal';
import DeleteChannelModal from '@/groups/GroupAdmin/AdminChannels/DeleteChannelModal';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import ChannelIcon from '@/channels/ChannelIcon';
import Divider from '@/components/Divider';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import GridIcon from '@/components/icons/GridIcon';
import ListIcon from '@/components/icons/ListIcon';
import SortIcon from '@/components/icons/SortIcon';
import { Status } from '@/logic/status';
import useIsGroupUnread from '@/logic/useIsGroupUnread';
import { useNotifications } from '@/notifications/useNotifications';
import useHarkState from '@/state/hark';

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
      console.error(error);
    }
  }, [deleteChannelIsOpen, groupFlag, isMobile, name, navigate, nest, ship]);

  return (
    <>
      <Dropdown.Root open={dropdownIsOpen} onOpenChange={setDropdownIsOpen}>
        <Dropdown.Trigger asChild>
          <button className="icon-button h-8 w-8 bg-transparent">
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
        <button className="icon-button h-8 w-8 bg-transparent">
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
        <button className="icon-button h-8 w-8 bg-transparent">
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
        <Divider />
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            sortMode === 'quip-asc' && 'bg-gray-100 hover:bg-gray-100'
          )}
          // onClick={() => setSortMode('quip-asc')}
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
          // onClick={() => setSortMode('quip-dsc')}
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
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const channel = useChannel(flag, nest);
  const groupName = group?.meta.title;
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
        unreadBins
          .filter((b) => b.topYarn.wer.includes(nest))
          .forEach((n) => {
            useHarkState.getState().sawRope(n.topYarn.rope);
          });
      }
    }
  }, [hasActivity, notifications, nest]);

  return (
    <div
      className={cn(
        'flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-2'
      )}
    >
      <BackButton
        to={isMobile && isTalk ? '/' : '../..'}
        className={cn(
          'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
          isMobile && '-ml-2 flex items-center rounded-lg pr-0 hover:bg-gray-50'
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <CaretLeftIcon className="mr-1 h-5 w-5 shrink-0 text-gray-500" />
        ) : null}
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50">
            <ChannelIcon nest={nest} className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex shrink flex-col items-start text-left">
            <div className="text-md font-semibold line-clamp-1">
              {channel?.meta.title}
            </div>
            <span className="text-sm font-medium text-gray-600 line-clamp-1">
              {groupName}
            </span>
          </div>
        </div>
      </BackButton>

      {showControls && displayMode && setDisplayMode && setSortMode ? (
        <div
          className={cn(
            'flex items-center',
            isMobile ? 'shrink space-x-2' : 'space-x-3'
          )}
        >
          {children}
          {/* TODO: Switch the popovers to dropdowns */}
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button className="icon-button h-8 w-8 bg-transparent">
                {displayMode === 'grid' ? (
                  <GridIcon className="-m-1 h-8 w-8" />
                ) : (
                  <ListIcon className="-m-1 h-8 w-8" />
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
            <DiarySortControls setSortMode={setSortMode} sortMode={sortMode} />
          ) : (
            <HeapSortControls setSortMode={setSortMode} sortMode={sortMode} />
          )}

          <ChannelActions {...{ nest, channel, isAdmin }} />
        </div>
      ) : (
        <ChannelActions {...{ nest, channel, isAdmin }} />
      )}
    </div>
  );
}
