import React from 'react';
import Avatar from '@/components/Avatar';
import { useGroup } from '@/state/groups';
import { isYarnShip } from '@/types/hark';
import GroupAvatar from '@/groups/GroupAvatar';
import { Bin } from './useNotifications';
import Notification from './Notification';

interface GroupNotificationProps {
  bin: Bin;
}

export default function GroupNotification({ bin }: GroupNotificationProps) {
  const rope = bin.topYarn?.rope;
  const group = useGroup(rope?.group || '');
  const groupTitle = group?.meta.title;
  const channelTitle = group?.channels[rope?.channel || '']?.meta.title;
  const ship = bin.topYarn?.con.find(isYarnShip);

  return (
    <Notification
      bin={bin}
      avatar={
        <>
          <GroupAvatar size="w-12 h-12" {...group?.meta} />
          {ship ? (
            <div className="absolute -bottom-2 -right-2">
              <Avatar size="xs" ship={ship.ship} />
            </div>
          ) : null}
        </>
      }
      topLine={
        <p className="text-sm font-semibold">
          {groupTitle}
          {': '}
          {channelTitle}
        </p>
      }
    />
  );
}
