import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Channel } from '../../types/groups';
import PencilIcon from '../../components/icons/PencilIcon';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import SixDotIcon from '../../components/icons/SixDotIcon';

interface AdminChannelListItemProps {
  channel: Channel;
}

export default function AdminChannelListItem({
  channel,
}: AdminChannelListItemProps) {
  const { meta } = channel;
  return (
    <div className="my-5 flex items-center justify-between">
      <div className="flex items-center">
        <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
        <div>
          <div className="flex items-center">
            <h2 className="font-semibold">{meta.title}</h2>
            <PencilIcon className="mx-3 h-3 w-3 fill-gray-500" />
          </div>
          <div className="text-sm font-semibold text-gray-400">Chat</div>
        </div>
      </div>
      <AdminChannelListDropdown />
      <div className="flex items-center text-gray-800">
        Default
        <Switch.Root className="switch">
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
    </div>
  );
}
