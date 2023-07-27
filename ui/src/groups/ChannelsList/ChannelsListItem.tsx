import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { GroupChannel } from '@/types/groups';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import {
  useAmAdmin,
  useDeleteChannelMutation,
  useGroupCompatibility,
  useRouteGroup,
} from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import {
  getPrivacyFromChannel,
  nestToFlag,
  WritePermissions,
} from '@/logic/utils';
import {
  useDiaries,
  useJoinDiaryMutation,
  useLeaveDiaryMutation,
} from '@/state/diary';
import ChannelIcon from '@/channels/ChannelIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import { PRIVACY_TYPE } from '@/groups/ChannelsList/ChannelPermsSelector';
import useRequestState from '@/logic/useRequestState';
import { useChannelCompatibility, useChannelIsJoined } from '@/logic/channel';
import Tooltip from '@/components/Tooltip';

interface ChannelsListItemProps {
  nest: string;
  channel: GroupChannel;
  sectionKey: string;
  groupCompatible: boolean;
  groupCompatibleText: string;
  provided?: DraggableProvided;
  snapshot?: DraggableStateSnapshot;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

function useGetChannel(app: string, flag: string): WritePermissions {
  const { chats } = useChatState.getState();
  const { stash } = useHeapState.getState();
  const shelf = useDiaries();

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
  groupCompatible,
  groupCompatibleText,
  onChannelDelete,
}: ChannelsListItemProps) {
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const isChannelHost = nest.includes(window.ship);
  const { meta } = channel;
  const [app, channelFlag] = nestToFlag(nest);
  const joined = useChannelIsJoined(nest);
  const { compatible: chanCompatible, text: chanText } =
    useChannelCompatibility(nest);
  const { mutateAsync: joinDiary } = useJoinDiaryMutation();
  const { mutateAsync: leaveDiary } = useLeaveDiaryMutation();
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const { isFailed, isPending, isReady, setFailed, setPending, setReady } =
    useRequestState();
  const compatible = chanCompatible && groupCompatible;
  const text = !groupCompatible ? groupCompatibleText : chanText;
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  const privacy = getPrivacyFromChannel(
    channel,
    useGetChannel(app, channelFlag)
  );
  const permissionText = PRIVACY_TYPE[privacy].title;
  const { mutate: deleteChannelMutation, status: deleteStatus } =
    useDeleteChannelMutation();

  const onDeleteChannelConfirm = useCallback(async () => {
    try {
      deleteChannelMutation({ flag: groupFlag, nest });
      onChannelDelete(nest, sectionKey);
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (e) {
      console.log(e);
    }
  }, [
    nest,
    deleteChannelIsOpen,
    onChannelDelete,
    sectionKey,
    groupFlag,
    deleteChannelMutation,
  ]);

  const join = useCallback(
    async (chFlag: string) => {
      if (app === 'diary') {
        await joinDiary({ group: groupFlag, chan: chFlag });
        return;
      }

      const joiner =
        app === 'chat'
          ? useChatState.getState().joinChat
          : useHeapState.getState().joinHeap;

      await joiner(groupFlag, chFlag);
    },
    [groupFlag, app, joinDiary]
  );
  const leave = useCallback(
    async (chFlag: string) => {
      if (app === 'diary') {
        await leaveDiary({ flag: chFlag });
        return;
      }

      const leaver =
        app === 'chat'
          ? useChatState.getState().leaveChat
          : useHeapState.getState().leaveHeap;

      await leaver(chFlag);
    },
    [app, leaveDiary]
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
      <div
        ref={provided?.innerRef}
        {...(compatible ? provided?.draggableProps : {})}
      >
        <div
          className={cn(
            'flex items-center justify-between rounded-lg py-2 px-2 md:py-5 md:px-8',
            {
              'bg-gray-50': snapshot?.isDragging,
              'bg-white': !snapshot?.isDragging,
            }
          )}
        >
          <div className="flex items-center">
            {isAdmin && (
              <div {...(compatible ? provided?.dragHandleProps : {})}>
                <SixDotIcon
                  className={cn(
                    'mr-3 h-5 w-5',
                    compatible
                      ? 'fill-gray-600'
                      : 'cursor-not-allowed fill-gray-200'
                  )}
                />
              </div>
            )}
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50">
              <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="mr-2 flex items-center space-x-2">
                <h2 className="text-md font-semibold line-clamp-1">
                  {meta.title}
                </h2>
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
              <Tooltip content={text} open={compatible ? false : undefined}>
                <button
                  className="small-secondary-button"
                  disabled={!compatible}
                  onClick={() => setEditIsOpen(true)}
                >
                  Edit
                </button>
              </Tooltip>
            )}
            {!joined ? (
              <Tooltip content={text} open={compatible ? false : undefined}>
                <button
                  disabled={isPending || !compatible}
                  onClick={joinChannel}
                  className={cn(
                    'small-secondary-button text-sm mix-blend-multiply dark:mix-blend-screen',
                    {
                      'bg-blue-soft text-blue': isReady || isPending,
                      'bg-yellow-soft text-gray-800': isFailed,
                    }
                  )}
                >
                  {isPending ? (
                    <span className="center-items flex">
                      <span className="ml-2">Joining...</span>
                    </span>
                  ) : isFailed ? (
                    'Retry'
                  ) : (
                    'Join'
                  )}
                </button>
              </Tooltip>
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
        setDeleteChannelIsOpen={setDeleteChannelIsOpen}
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
