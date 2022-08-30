import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { GroupChannel } from '@/types/groups';
import EditChannelModal from '@/groups/GroupAdmin/AdminChannels/EditChannelModal';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useGroupState, useRouteGroup } from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { getPrivacyFromChannel, nestToFlag } from '@/logic/utils';
import { Chat } from '@/types/chat';
import { Heap } from '@/types/heap';
import { useDiaryState } from '@/state/diary';
import ChannelIcon from '@/channels/ChannelIcon';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import DeleteChannelModal from './DeleteChannelModal';
import { PRIVACY_TYPE } from './ChannelPermsSelector';

interface AdminChannelListItemProps {
  nest: string;
  channel: GroupChannel;
  sectionKey: string;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

function getChannel(app: string, flag: string): Chat | Heap {
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

export default function AdminChannelListItem({
  nest,
  channel,
  provided,
  snapshot,
  sectionKey,
  onChannelDelete,
}: AdminChannelListItemProps) {
  const flag = useRouteGroup();
  const { meta } = channel;
  const [app, channelFlag] = nestToFlag(nest);
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const privacy = getPrivacyFromChannel(channel, getChannel(app, channelFlag));
  const permissionText = PRIVACY_TYPE[privacy].title;

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteChannelIsOpen(!deleteChannelIsOpen);
    await useGroupState.getState().deleteChannel(flag, nest);
    onChannelDelete(nest, sectionKey);
  }, [nest, deleteChannelIsOpen, onChannelDelete, sectionKey, flag]);

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
              <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
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
        nest={nest}
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
