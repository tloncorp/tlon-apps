import React from 'react';
import Avatar from '@/components/Avatar';
import { useGang, useGroup } from '@/state/groups';
import { isYarnShip } from '@/types/hark';
import GroupAvatar from '@/groups/GroupAvatar';
import DefaultGroupIcon from '@/components/icons/DefaultGroupIcon';
import { Bin } from './useNotifications';
import Notification from './Notification';

interface GroupNotificationProps {
  bin: Bin;
}

export default function GroupNotification({ bin }: GroupNotificationProps) {
  const rope = bin.topYarn?.rope;
  const group = useGroup(rope?.group || '');
  const gang = useGang(rope?.group || '');
  const groupTitle = group?.meta.title || gang?.preview?.meta.title;
  const channelTitle = group?.channels[rope?.channel || '']?.meta.title;
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
          {ship ? (
            <GroupAvatar
              size="mr-1 w-6 h-6"
              {...(group || gang?.preview)?.meta}
            />
          ) : (
            <DefaultGroupIcon className="mr-1 h-6 w-6" />
          )}
          <p>{groupTitle}</p>
          {channelTitle ? ': ' : null}
          <p>{channelTitle}</p>
        </div>
      }
    />
  );
}
