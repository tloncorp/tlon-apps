import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import EditChannelModal from '@/groups/GroupAdmin/AdminChannels/EditChannelModal';
import { useChat } from '@/state/chat';
import { useGroupState, useRouteGroup } from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import BubbleIcon from '@/components/icons/BubbleIcon';
import { getPrivacyFromChannel } from '@/logic/utils';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import DeleteChannelModal from './DeleteChannelModal';
import { PRIVACY_TYPE } from './ChannelPermsSelector';

interface AdminChannelListItemProps {
  channel: Channel;
  channelFlag: string;
  sectionKey: string;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function AdminChannelListItem({
  channel,
  channelFlag,
  provided,
  snapshot,
  sectionKey,
  onChannelDelete,
}: AdminChannelListItemProps) {
  const flag = useRouteGroup();
  const { meta } = channel;
  const chat = useChat(channelFlag);
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const permissionText =
    PRIVACY_TYPE[getPrivacyFromChannel(channel, chat)].title;

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteChannelIsOpen(!deleteChannelIsOpen);
    await useGroupState.getState().deleteChannel(flag, channelFlag);
    onChannelDelete(channelFlag, sectionKey);
  }, [channelFlag, deleteChannelIsOpen, onChannelDelete, sectionKey, flag]);

  return (
    <>
      <div ref={provided.innerRef} {...provided.draggableProps}>
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex items-center justify-between rounded-lg py-5 px-6',
            snapshot.isDragging ? 'bg-gray-50' : 'bg-white'
          )}
        >
          <div className="flex items-center">
            <div {...provided.dragHandleProps}>
              <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
            </div>
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded bg-gray-50">
              <BubbleIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-md font-semibold">{meta.title}</h2>
                {channel.join ? (
                  <div className="rounded-md border-2 border-gray-600 px-1 text-sm font-bold text-gray-600">
                    Default
                  </div>
                ) : null}
              </div>
              <div className="text-sm font-semibold text-gray-400">
                {permissionText}
              </div>
            </div>
          </div>
          <AdminChannelListDropdown
            parentIsHovered={isHovered}
            editIsOpen={editIsOpen}
            setEditIsOpen={setEditIsOpen}
            setDeleteChannelIsOpen={setDeleteChannelIsOpen}
            deleteChannelIsOpen={deleteChannelIsOpen}
          />
        </div>
      </div>
      <EditChannelModal
        editIsOpen={editIsOpen}
        setEditIsOpen={setEditIsOpen}
        channelFlag={channelFlag}
        channel={channel}
      />
      <DeleteChannelModal
        deleteChannelIsOpen={deleteChannelIsOpen}
        onDeleteChannelConfirm={onDeleteChannelConfirm}
        setDeleteChannelIsOpen={setDeleteChannelIsOpen}
        channel={channel}
      />
    </>
  );
}
