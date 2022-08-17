import React from 'react';
import { Thread, Yarns } from '@/types/hark';
import _ from 'lodash';
import { useNotifications } from './useNotifications';
import Notification from './Notification';

export default function Notifications() {
  const { notifications } = useNotifications();

  return (
    <section className="w-full p-6">
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
