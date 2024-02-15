import ChannelIcon from '@/channels/ChannelIcon';
import Tooltip from '@/components/Tooltip';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { PRIVACY_TYPE } from '@/groups/ChannelsList/ChannelPermsSelector';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { useChannelCompatibility, useChannelIsJoined } from '@/logic/channel';
import useRequestState from '@/logic/useRequestState';
import {
  WritePermissions,
  getPrivacyFromChannel,
  nestToFlag,
} from '@/logic/utils';
import {
  useChannels,
  useJoinMutation,
  useLeaveMutation,
} from '@/state/channel/channel';
import {
  useAmAdmin,
  useDeleteChannelMutation,
  useRouteGroup,
} from '@/state/groups';
import { GroupChannel } from '@/types/groups';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';

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
  const channels = useChannels();

  return channels[flag];
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
  const { mutateAsync: joinChannel } = useJoinMutation();
  const { mutateAsync: leaveChannel } = useLeaveMutation();
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

  const channelJoinHandler = useCallback(async () => {
    try {
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      setPending();
      await joinChannel({ group: groupFlag, chan: nest });
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
  }, [nest, groupFlag, joinChannel, setFailed, setPending, setReady, timer]);

  const channelLeaveHandler = useCallback(async () => {
    try {
      await leaveChannel({ nest });
    } catch (error) {
      if (error) {
        console.error(`[ChannelsListItem:LeaveError] ${error}`);
      }
    }
  }, [leaveChannel, nest]);

  return (
    <>
      <div
        ref={provided?.innerRef}
        {...(groupCompatible ? provided?.draggableProps : {})}
      >
        <div
          className={cn(
            'flex items-center justify-between rounded-lg px-2 py-2 md:px-8 md:py-5',
            {
              'bg-gray-50': snapshot?.isDragging,
              'bg-white': !snapshot?.isDragging,
            }
          )}
        >
          <div className="flex items-center">
            {isAdmin && (
              <div {...(groupCompatible ? provided?.dragHandleProps : {})}>
                <SixDotIcon
                  className={cn(
                    'mr-3 h-5 w-5',
                    groupCompatible
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
                <h2 className="text-md line-clamp-1 font-semibold">
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
                  onClick={channelJoinHandler}
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
                onClick={channelLeaveHandler}
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
