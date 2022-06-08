import React, { useMemo } from 'react';
import { randInt } from '../../mocks/chat';
import BulletIcon from '../icons/BulletIcon';
import SidebarLink from './SidebarLink';

export default function NotificationLink() {
  // TODO: get notification count from hark store
  // const notificationCount = useMemo(() => randInt(100, 0), []);
  const notificationCount = 0;

  const notificationIcon = (
    <div>
      {notificationCount === 0 ? (
        <BulletIcon className="h-6 w-6 bg-gray-50 p-2" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center bg-gray-50">
          {notificationCount > 99 ? '99+' : notificationCount}
        </div>
      )}
    </div>
  );

  return (
    <SidebarLink icon={notificationIcon} to="/notifications">
      Notifications
    </SidebarLink>
  );
}
