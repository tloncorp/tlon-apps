import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGroupFlag, useGroup } from '@/state/groups';
import GroupAvatar from '@/groups/GroupAvatar';
import CaretLeftIcon from '@/components/icons/CaretLeft16Icon';
import Notifications from '@/notifications/Notifications';
import GroupNotification from '@/notifications/GroupNotification';
import useHarkState from '@/state/hark';

export default function MobileGroupRoot() {
  const flag = useGroupFlag();
  const group = useGroup(flag);

  useEffect(() => {
    if (flag !== '') {
      useHarkState.getState().retrieveGroup(flag);
    }
    return () => {
      useHarkState.getState().releaseGroup(flag);
    };
  }, [flag]);

  return (
    <>
      <header className="flex items-center justify-between p-4 pt-3 pr-5">
        <div>
          <Link
            to="/"
            className="default-focus inline-flex items-center text-base font-semibold text-gray-800 hover:bg-gray-50"
          >
            <CaretLeftIcon className="mr-2 h-6 w-6 shrink-0 text-gray-400" />
            <GroupAvatar {...group?.meta} size="h-8 w-8" className="mr-3" />
            <h1 className="shrink text-base font-bold line-clamp-1">
              {group?.meta.title}
            </h1>
          </Link>
        </div>
      </header>
      <div className="h-full w-full flex-1 overflow-y-hidden p-0">
        <Notifications child={GroupNotification} />
      </div>
    </>
  );
}
