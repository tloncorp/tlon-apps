import React, { useState } from 'react';
import { DraggableProvided } from 'react-beautiful-dnd';
import * as Switch from '@radix-ui/react-switch';
import { Channel } from '@/types/groups';
import EditChannelNameModal from '@/groups/GroupAdmin/EditChannelNameModal';
import PencilIcon from '@/components/icons/PencilIcon';
import { useGroupState, useRouteGroup } from '@/state/groups';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import SixDotIcon from '../../components/icons/SixDotIcon';

interface AdminChannelListItemProps {
  channel: Channel;
  index: number;
  channelFlag: string;
  provided: DraggableProvided;
}

export default function AdminChannelListItem({
  channel,
  index,
  channelFlag,
  provided,
}: AdminChannelListItemProps) {
  const flag = useRouteGroup();
  const { meta } = channel;
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [defaultIsChecked, setDefaultIsChecked] = useState(
    channel?.join || false
  );

  const onDefaultCheckedChange = () => {
    useGroupState
      .getState()
      .setChannelJoin(flag, channelFlag, !defaultIsChecked);
    setDefaultIsChecked(!defaultIsChecked);
  };

  return (
    <>
      <div ref={provided.innerRef} {...provided.draggableProps}>
        <div
          className={
            ' flex items-center justify-between rounded-lg bg-white py-5'
          }
        >
          <div className="flex items-center">
            <div {...provided.dragHandleProps}>
              <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
            </div>
            <div>
              <div className="flex items-center">
                <h2 className="font-semibold">{meta.title}</h2>
                <div onClick={() => setEditIsOpen(!editIsOpen)}>
                  <PencilIcon className="mx-3 h-3 w-3 cursor-pointer fill-gray-500" />
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-400">Chat</div>
            </div>
          </div>
          <AdminChannelListDropdown channelFlag={channelFlag} />
          <div className="flex items-center text-gray-800">
            Default
            <Switch.Root
              checked={defaultIsChecked}
              onCheckedChange={onDefaultCheckedChange}
              className="switch"
            >
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </div>
      </div>
      <EditChannelNameModal
        editIsOpen={editIsOpen}
        setEditIsOpen={setEditIsOpen}
        channel={channel}
      />
    </>
  );
}
