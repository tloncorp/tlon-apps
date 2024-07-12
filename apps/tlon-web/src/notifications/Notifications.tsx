import { ActivityBundle, ActivitySummary } from '@tloncorp/shared/dist/urbit';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import { ComponentType, PropsWithChildren, useCallback } from 'react';
import { Helmet } from 'react-helmet';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import WelcomeCard from '@/components/WelcomeCard';
import { useBottomPadding } from '@/logic/position';
import { useIsMobile } from '@/logic/useMedia';
import { randomElement, randomIntInRange } from '@/logic/utils';
import { useMarkReadMutation } from '@/state/activity';

import { useNotifications } from './useNotifications';

export interface NotificationsProps {
  child: ComponentType<{ bundle: ActivityBundle; summary: ActivitySummary }>;
  title?: ViewProps['title'];
}

export function MainWrapper({
  isMobile,
  title,
  children,
}: PropsWithChildren<{ title: string; isMobile: boolean }>) {
  if (!isMobile) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return (
    <>
      <header className="flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4">
        <h1 className="text-lg font-bold text-gray-800">{title}</h1>
      </header>
      <nav className="h-full flex-1 overflow-y-auto">{children}</nav>
    </>
  );
}

function NotificationPlaceholder() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;
  const isMobile = useIsMobile();
  return (
    <div className="flex w-full animate-pulse flex-col rounded-lg">
      <div className="flex w-full flex-1 space-x-3 rounded-lg p-2">
        <div className="flex h-6 w-24 justify-center rounded-md bg-gray-100 text-sm" />
      </div>
      <div className="flex w-full flex-1 space-x-3 rounded-lg p-2">
        <div
          className={cn(background, 'h-12 w-full rounded-md')}
          style={{
            width: `${randomIntInRange(300, isMobile ? 300 : 900)}px`,
          }}
        />
      </div>
    </div>
  );
}

export default function Notifications({
  child: Notification,
  title,
}: NotificationsProps) {
  const isMobile = useIsMobile();
  const { paddingBottom } = useBottomPadding();
  const { loaded, notifications, activity } = useNotifications();
  const { mutate, isLoading } = useMarkReadMutation();
  const isMarkReadPending = isLoading;
  const hasUnreads = activity['notify-count'] > 0;

  const markAllRead = useCallback(async () => {
    mutate({ source: { base: null } });
  }, []);

  const MarkAsRead = (
    <button
      disabled={isMarkReadPending || !hasUnreads}
      className={cn('small-button whitespace-nowrap text-sm', {
        'bg-gray-400 text-gray-800': isMarkReadPending || !hasUnreads,
      })}
      onClick={markAllRead}
    >
      {isMarkReadPending ? (
        <LoadingSpinner className="h-4 w-4" />
      ) : (
        `Mark All as Read`
      )}
    </button>
  );

  const MobileMarkAsRead = (
    <button
      disabled={isMarkReadPending || !hasUnreads}
      className="whitespace-nowrap text-[17px] font-normal text-gray-800"
      onClick={markAllRead}
    >
      Read All
    </button>
  );

  return (
    <>
      {isMobile && (
        <MobileHeader
          title="Activity"
          action={
            <div className="flex h-12 items-center justify-end space-x-2">
              <ReconnectingSpinner />
              {hasUnreads && MobileMarkAsRead}
            </div>
          }
        />
      )}
      <section
        className="relative flex h-full w-full flex-col space-y-6 overflow-y-scroll bg-white p-2 sm:bg-gray-50 sm:p-6"
        style={{
          paddingBottom,
        }}
        data-testid="notifications-screen"
      >
        <Helmet>
          <title>{title}</title>
        </Helmet>

        <div className="card pt-6">
          {!isMobile && (
            <div>
              <WelcomeCard />
              <div className="mb-6 flex w-full items-center justify-between">
                <h2 className="text-lg font-bold">Activity</h2>
                {hasUnreads && MarkAsRead}
              </div>
            </div>
          )}
          {loaded ? (
            notifications.length === 0 ? (
              <div className="mt-3 flex w-full items-center justify-center">
                <span className="text-base font-semibold text-gray-400">
                  No notifications
                </span>
              </div>
            ) : (
              notifications.map((grouping) => (
                <div key={grouping.date}>
                  <h2 className="mb-4 font-sans text-[17px] font-normal leading-[22px] text-gray-400">
                    {grouping.date}
                  </h2>
                  <ul className="mb-4 space-y-2">
                    {grouping.bundles.map((b) => (
                      <li key={b.latest}>
                        <Notification bundle={b} summary={activity} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )
          ) : (
            new Array(30)
              .fill(true)
              .map((_, i) => <NotificationPlaceholder key={i} />)
          )}
        </div>
      </section>
    </>
  );
}
