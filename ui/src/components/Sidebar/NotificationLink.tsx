import React from 'react';
import { To } from 'react-router-dom';
import BulletIcon from '../icons/BulletIcon';
import SidebarLink from './SidebarLink';

interface NotificationLinkProps {
  count: number;
  title: string;
  to: To;
}

export default function NotificationLink({
  count,
  title,
  to,
}: NotificationLinkProps) {
  const notificationIcon = (
    <div>
      {count === 0 ? (
        <BulletIcon className="h-6 w-6 bg-gray-50 p-2" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-50">
          {count > 99 ? '99+' : count}
        </div>
      )}
    </div>
  );

  return (
    <SidebarLink icon={notificationIcon} to={to}>
      {title}
    </SidebarLink>
  );
}
