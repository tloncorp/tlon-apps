import { useRouteGroup, useGroup } from '@/state/groups';
import React, { ComponentType } from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { Bin, useNotifications } from './useNotifications';

interface NotificationsProps {
  child: ComponentType<{ bin: Bin }>;
  title?: ViewProps['title'];
}

export default function Notifications({
  child: Notification,
  title,
}: NotificationsProps) {
  const flag = useRouteGroup();
  const { notifications } = useNotifications(flag);

  const group = useGroup(flag);

  return (
    <section className="w-full bg-white p-6">
      <Helmet>
        <title>
          {group
            ? `All Notifications for ${group?.meta?.title} ${title}`
            : title}
        </title>
      </Helmet>
      {notifications.map((grouping) => (
        <>
          <h2 className="mt-8 mb-4 text-lg font-bold text-gray-400">
            {grouping.date}
          </h2>
          <ul className="space-y-2">
            {grouping.bins.map((b) => (
              <li key={b.time}>
                <Notification bin={b} />
              </li>
            ))}
          </ul>
        </>
      ))}
    </section>
  );
}
