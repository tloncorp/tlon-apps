import { makePrettyTime } from '@tloncorp/shared/dist';
import { ActivityEvent } from '@tloncorp/shared/dist/urbit';
import { ReactNode } from 'react';

import Bullet16Icon from '@/components/icons/Bullet16Icon';
import useGroupJoin from '@/groups/useGroupJoin';
import { useGang, useGroup } from '@/state/groups';

import { NotificationContent } from './NotificationContent';

interface GroupInviteNotificationProps {
  top: ActivityEvent;
  flag: string;
  time: number;
  unread: boolean;
  avatar?: ReactNode;
  topLine?: ReactNode;
}

export function GroupInviteNotification({
  top,
  flag,
  time,
  unread,
  avatar,
  topLine,
}: GroupInviteNotificationProps) {
  const group = useGroup(flag);
  const gang = useGang(flag);
  const { open, reject } = useGroupJoin(flag, gang);

  return (
    <div className="relative flex space-x-3 rounded-xl bg-white p-2 text-gray-400">
      <div className="flex w-full min-w-0 flex-1 space-x-3">
        <div className="relative flex-none self-start">{avatar}</div>
        <div
          className="min-w-0 grow-0 break-words p-1"
          data-testid="group-invite"
        >
          {topLine}
          <div className="my-2 leading-5">
            <NotificationContent time={time} top={top} />
          </div>
          {gang && !group && (
            <div className="mt-2 flex space-x-2">
              <button
                onClick={open}
                className="small-button bg-blue-soft text-blue"
              >
                Accept
              </button>
              <button
                onClick={reject}
                className="small-button bg-gray-50 text-gray-800"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="absolute right-5 flex-none p-1">
        <div className="flex items-center space-x-1">
          {unread ? <Bullet16Icon className="h-4 w-4 text-blue" /> : null}
          <span className="text-sm font-semibold">
            {makePrettyTime(new Date(time))}
          </span>
        </div>
      </div>
    </div>
  );
}
