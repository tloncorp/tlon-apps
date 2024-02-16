import React from 'react';

import Avatar from '@/components/Avatar';
import { useMultiDm } from '@/state/chat';
import { Skein, isYarnShip } from '@/types/hark';

import Notification from './Notification';

interface DMNotificationProps {
  bin: Skein;
}

export default function DMNotification({ bin }: DMNotificationProps) {
  const ship = bin.top?.con.find(isYarnShip);
  const [, whom] = bin.top?.wer.slice(1).split('/') || undefined;
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
