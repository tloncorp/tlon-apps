import React from 'react';
import Avatar from '@/components/Avatar';
import { useGang, useGroup, useGroupFlag } from '@/state/groups';
import { isYarnShip } from '@/types/hark';
import GroupAvatar from '@/groups/GroupAvatar';
import DefaultGroupIcon from '@/components/icons/DefaultGroupIcon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import { Bin } from './useNotifications';
import Notification from './Notification';

interface GroupNotificationProps {
  bin: Bin;
}

interface GroupOrChannelIconProps {
  channelType?: string;
}

function GroupOrChannelIcon({ channelType }: GroupOrChannelIconProps) {
  switch (channelType) {
    case 'chat':
      return <ChatSmallIcon className="mr-1 h-4 w-4" />;
    case 'diary':
      return <NotebookIcon className="mr-1 h-4 w-4" />;
    case 'heap':
      return <ShapesIcon className="mr-1 h-4 w-4" />;
    default:
      return <DefaultGroupIcon className="mr-1 h-6 w-6" />;
  }
}

export default function GroupNotification({ bin }: GroupNotificationProps) {
  const rope = bin.topYarn?.rope;
  const group = useGroup(rope?.group || '');
  const groupFlag = useGroupFlag();
  const gang = useGang(rope?.group || '');
  const groupTitle = group?.meta.title || gang?.preview?.meta.title;
  const channelTitle = group?.channels[rope?.channel || '']?.meta.title;
  const channelType = rope?.channel?.split('/')[0];
  const ship = bin.topYarn?.con.find(isYarnShip);

  return (
    <Notification
      bin={bin}
      avatar={
        ship ? (
          <Avatar size="default" ship={ship.ship} />
        ) : (
          <GroupAvatar size="w-12 h-12" {...(group || gang?.preview)?.meta} />
        )
      }
      topLine={
        <div className="flex flex-row items-center space-x-1 text-sm font-semibold text-gray-400">
          {!groupFlag ? (
            <DefaultGroupIcon className="mr-1 h-6 w-6" />
          ) : (
            <GroupOrChannelIcon channelType={channelType} />
          )}
          <p>{groupTitle}</p>
          {channelTitle ? ': ' : null}
          <p>{channelTitle}</p>
        </div>
      }
    />
  );
}
