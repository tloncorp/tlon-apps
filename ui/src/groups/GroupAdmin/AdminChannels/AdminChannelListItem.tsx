import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { GroupChannel } from '@/types/groups';
import EditChannelModal from '@/groups/GroupAdmin/AdminChannels/EditChannelModal';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useGroupState, useRouteGroup } from '@/state/groups';
import SixDotIcon from '@/components/icons/SixDotIcon';
import {
  getPrivacyFromChannel,
  nestToFlag,
  WritePermissions,
} from '@/logic/utils';
import { useDiaryState } from '@/state/diary';
import ChannelIcon from '@/channels/ChannelIcon';
import AdminChannelListDropdown from '@/groups/GroupAdmin/AdminChannels/AdminChannelListDropdown';
import DeleteChannelModal from '@/groups/GroupAdmin/AdminChannels/DeleteChannelModal';
import { PRIVACY_TYPE } from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import { Status } from '@/logic/status';

interface AdminChannelListItemProps {
  nest: string;
  channel: GroupChannel;
  sectionKey: string;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
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
  const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  const privacy = getPrivacyFromChannel(channel, getChannel(app, channelFlag));
  const permissionText = PRIVACY_TYPE[privacy].title;

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteStatus('loading');
    try {
      await useGroupState.getState().deleteChannel(flag, nest);
      onChannelDelete(nest, sectionKey);
      setDeleteStatus('success');
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (e) {
      setDeleteStatus('error');
      console.log(e);
    }
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
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50">
              <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-md font-semibold line-clamp-1">
                  {meta.title}
                </h2>
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
        deleteStatus={deleteStatus}
      />
    </>
  );
}
