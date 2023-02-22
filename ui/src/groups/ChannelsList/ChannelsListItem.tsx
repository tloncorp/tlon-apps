import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { GroupChannel } from '@/types/groups';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useAmAdmin, useGroupState, useRouteGroup } from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import {
  getPrivacyFromChannel,
  isChannelJoined,
  nestToFlag,
  WritePermissions,
} from '@/logic/utils';
import { useDiaryState } from '@/state/diary';
import ChannelIcon from '@/channels/ChannelIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import { PRIVACY_TYPE } from '@/groups/ChannelsList/ChannelPermsSelector';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import useRequestState from '@/logic/useRequestState';
import { useIsMobile } from '@/logic/useMedia';
import useAllBriefs from '@/logic/useAllBriefs';

interface ChannelsListItemProps {
  nest: string;
  channel: GroupChannel;
  sectionKey: string;
  provided?: DraggableProvided;
  snapshot?: DraggableStateSnapshot;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

function getChannel(app: string, flag: string): WritePermissions {
  const { chats } = useChatState.getState();
  const { stash } = useHeapState.getState();
  const { shelf } = useDiaryState.getState();

  switch (app) {
    case 'chat':
      return chats[flag];
    case 'heap':
      return stash[flag];
    case 'diary':
      return shelf[flag];
    default:
      return { perms: { writers: [] } };
  }
}

export default function ChannelsListItem({
  nest,
  channel,
  provided,
  snapshot,
  sectionKey,
  onChannelDelete,
}: ChannelsListItemProps) {
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const isMobile = useIsMobile();
  const isChannelHost = nest.includes(window.ship);
  const { meta } = channel;
  const [app, channelFlag] = nestToFlag(nest);
  const briefs = useAllBriefs();
  const joined = isChannelJoined(nest, briefs);
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const { isFailed, isPending, isReady, setFailed, setPending, setReady } =
    useRequestState();
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  const privacy = getPrivacyFromChannel(channel, getChannel(app, channelFlag));
  const permissionText = PRIVACY_TYPE[privacy].title;

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteStatus('loading');
    try {
      await useGroupState.getState().deleteChannel(groupFlag, nest);
      onChannelDelete(nest, sectionKey);
      setDeleteStatus('success');
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (e) {
      setDeleteStatus('error');
      console.log(e);
    }
  }, [nest, deleteChannelIsOpen, onChannelDelete, sectionKey, groupFlag]);

  const join = useCallback(
    async (chFlag: string) => {
      const joiner =
        app === 'chat'
          ? useChatState.getState().joinChat
          : app === 'heap'
          ? useHeapState.getState().joinHeap
          : useDiaryState.getState().joinDiary;

      await joiner(groupFlag, chFlag);
    },
    [groupFlag, app]
  );
  const leave = useCallback(
    async (chFlag: string) => {
      const leaver =
        app === 'chat'
          ? useChatState.getState().leaveChat
          : app === 'heap'
          ? useHeapState.getState().leaveHeap
          : useDiaryState.getState().leaveDiary;

      await leaver(chFlag);
    },
    [app]
  );

  const joinChannel = useCallback(async () => {
    try {
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      setPending();
      await join(channelFlag);
      setReady();
    } catch (error) {
      if (error) {
        console.error(`[ChannelsListItem:JoinError] ${error}`);
      }
      setFailed();
      setTimer(
        setTimeout(() => {
          setReady();
          setTimer(null);
        }, 10 * 1000)
      );
    }
  }, [channelFlag, join, setFailed, setPending, setReady, timer]);

  const leaveChannel = useCallback(async () => {
    try {
      leave(channelFlag);
    } catch (error) {
      if (error) {
        console.error(`[ChannelsListItem:LeaveError] ${error}`);
      }
    }
  }, [channelFlag, leave]);

  return (
    <>
      <div ref={provided?.innerRef} {...provided?.draggableProps}>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg py-5 px-6',
            snapshot?.isDragging ? 'bg-gray-50' : 'bg-white'
          )}
        >
          <div className="flex items-center">
            {isAdmin && (
              <div {...provided?.dragHandleProps}>
                <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
              </div>
            )}
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50">
              <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-md font-semibold line-clamp-1">
                  {meta.title}
                </h2>
                {channel.join && isAdmin ? (
                  <div className="rounded-md border-2 border-gray-600 px-1 text-sm font-bold text-gray-600">
                    Default
                  </div>
                ) : null}
              </div>
              {isAdmin && (
                <div className="text-sm font-semibold text-gray-400">
                  {permissionText}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <button
                className="small-secondary-button"
                onClick={() => setEditIsOpen(true)}
              >
                Edit
              </button>
            )}
            {!joined ? (
              <button
                disabled={isPending}
                onClick={joinChannel}
                className={cn(
                  'small-secondary-button mix-blend-multiply disabled:bg-gray-50 dark:mix-blend-screen',
                  {
                    'bg-blue-soft text-blue': isReady || isPending,
                    'bg-red-soft': isFailed,
                    'text-red': isFailed,
                  },
                  isMobile ? 'text-sm' : ''
                )}
              >
                {isPending ? (
                  <span className="center-items flex">
                    <LoadingSpinner />
                    <span className="ml-2">Joining...</span>
                  </span>
                ) : isFailed ? (
                  'Retry'
                ) : (
                  'Join'
                )}
              </button>
            ) : (
              <button
                className="small-secondary-button mix-blend-multiply disabled:bg-gray-50 dark:mix-blend-screen"
                onClick={leaveChannel}
                disabled={isChannelHost}
                title={
                  isChannelHost ? 'You cannot leave a channel you host' : ''
                }
              >
                Leave
              </button>
            )}
          </div>
        </div>
      </div>
      <EditChannelModal
        editIsOpen={editIsOpen}
        setEditIsOpen={setEditIsOpen}
        nest={nest}
        channel={channel}
        app={app}
      />
      <DeleteChannelModal
        deleteChannelIsOpen={deleteChannelIsOpen}
        onDeleteChannelConfirm={onDeleteChannelConfirm}
        setDeleteChannelIsOpen={setDeleteChannelIsOpen}
        channel={channel}
        deleteStatus={deleteStatus}
      />
    </>
  );
}
