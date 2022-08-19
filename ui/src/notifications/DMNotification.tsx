import React from 'react';
import Avatar from '@/components/Avatar';
import { isYarnShip } from '@/types/hark';
import { useMultiDm } from '@/state/chat';
import { Bin } from './useNotifications';
import Notification from './Notification';

interface DMNotificationProps {
  bin: Bin;
}

export default function DMNotification({ bin }: DMNotificationProps) {
  const ship = bin.topYarn?.con.find(isYarnShip);
  const [, whom] = bin.topYarn?.wer.slice(1).split('/') || undefined;
  const club = useMultiDm(whom);

  return (
    <Notification
      bin={bin}
      avatar={ship ? <Avatar size="default" ship={ship.ship} /> : null}
      topLine={
        club ? (
          <p className="text-sm font-semibold">
            {club.meta.title || club.team.concat(club.hive).join(', ')}
          </p>
        ) : null
      }
    />
  );
}
