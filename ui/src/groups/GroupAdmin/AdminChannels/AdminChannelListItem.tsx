import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import EditChannelModal from '@/groups/GroupAdmin/AdminChannels/EditChannelModal';
import { useGroupState, useRouteGroup } from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import BubbleIcon from '@/components/icons/BubbleIcon';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import DeleteChannelModal from './DeleteChannelModal';

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
  const { meta, readers } = channel;
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);

  const permissionText = readers.includes('admin')
    ? 'Admin Only'
    : 'Open To All';

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteChannelIsOpen(!deleteChannelIsOpen);
    await useGroupState.getState().deleteChannel(flag, channelFlag);
    onChannelDelete(channelFlag, sectionKey);
  }, [channelFlag, deleteChannelIsOpen, onChannelDelete, sectionKey, flag]);

  return (
    <>
      <div ref={provided.innerRef} {...provided.draggableProps}>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg py-5 px-6',
            snapshot.isDragging ? 'bg-gray-50' : 'bg-white'
          )}
        >
          <div className="flex items-center">
            <div {...provided.dragHandleProps}>
              <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
            </div>
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded bg-gray-400">
              <BubbleIcon className="h-5 w-5 fill-gray-600" />
            </div>
            <div>
              <div className="flex items-center">
                <h2 className="font-semibold">{meta.title}</h2>
              </div>
              <div className="text-sm font-semibold text-gray-400">
                {permissionText}
              </div>
            </div>
          </div>
          <AdminChannelListDropdown
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
        flag={channelFlag}
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
