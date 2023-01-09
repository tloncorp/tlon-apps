import { useRouteGroup, useGroup } from '@/state/groups';
import React, {
  ComponentType,
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ViewProps } from '@/types/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import useHarkState from '@/state/hark';
import { Bin, useNotifications } from './useNotifications';

export interface NotificationsProps {
  child: ComponentType<{ bin: Bin }>;
  title?: ViewProps['title'];
}

export function MainWrapper({
  isMobile,
  children,
}: PropsWithChildren<{ isMobile: boolean }>) {
  if (!isMobile) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between px-5 py-4">
        <h1 className="text-base font-bold">Notifications</h1>
      </header>
      <nav className="h-full flex-1 overflow-y-auto">{children}</nav>
    </>
  );
}

export function GroupWrapper({
  isMobile,
  children,
}: PropsWithChildren<{ isMobile: boolean }>) {
  if (!isMobile) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return (
    <>
      <header className="flex-none px-2 py-1">
        <Link
          to="../"
          className="default-focus inline-flex items-center rounded-lg p-2 text-base font-semibold text-gray-800 hover:bg-gray-50"
        >
          <CaretLeft16Icon className="mr-1 h-4 w-4 text-gray-400" />
          Activity
        </Link>
      </header>
      <div className="h-full w-full flex-1 overflow-y-scroll p-2 pr-0">
        {children}
      </div>
    </>
  );
}

export default function Notifications({
  child: Notification,
  title,
}: NotificationsProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { notifications, count } = useNotifications(flag);
  const hasUnreads = count > 0;

  const markAllRead = useCallback(() => {
    useHarkState.getState().sawSeam({ desk: 'groups' });
  }, []);

  return (
    <section className="h-full w-full overflow-y-auto bg-white p-6">
      <Helmet>
        <title>
          {group
            ? `All Notifications for ${group?.meta?.title} ${title}`
            : title}
        </title>
      </Helmet>
      <div className="flex w-full items-center justify-end">
        {hasUnreads && (
          <button className="small-button bg-blue" onClick={markAllRead}>
            Mark All as Read
          </button>
        )}
      </div>
      {notifications.map((grouping) => (
        <div key={grouping.date}>
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
        </div>
      ))}
    </section>
  );
}
