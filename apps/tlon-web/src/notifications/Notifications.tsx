import { ActivityBundle, ActivitySummary } from '@tloncorp/shared/dist/urbit';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import { PropsWithChildren, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Virtuoso } from 'react-virtuoso';

import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import WelcomeCard from '@/components/WelcomeCard';
import { useBottomPadding } from '@/logic/position';
import { useIsMobile } from '@/logic/useMedia';
import { makePrettyDay, randomElement, randomIntInRange } from '@/logic/utils';
import {
  emptySummary,
  useActivity,
  useOptimisticMarkRead,
} from '@/state/activity';

import Notification from './Notification';
import { useNotifications } from './useNotifications';

export interface NotificationsProps {
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

interface NotificationItem {
  bundle: ActivityBundle;
  summary: ActivitySummary;
  newDay: boolean;
  date: Date;
}

function VirtualNotification(
  index: number,
  { bundle, summary, newDay, date }: NotificationItem
) {
  return (
    <div key={bundle.latest} className="py-2">
      {newDay && (
        <h2 className="mb-4 font-sans text-[17px] font-normal leading-[22px] text-gray-400">
          {makePrettyDay(date)}
        </h2>
      )}
      <Notification bundle={bundle} summary={summary} />
    </div>
  );
}

function getKey(i: number, { bundle }: NotificationItem): string {
  return bundle['source-key'] + bundle.latest;
}

export default function Notifications({ title }: NotificationsProps) {
  const isMobile = useIsMobile();
  const { paddingBottom } = useBottomPadding();
  const { loaded, notifications, fetchNextPage, hasNextPage } =
    useNotifications();
  const { activity, isLoading } = useActivity();
  const markRead = useOptimisticMarkRead('base');

  useEffect(() => {
    const hasActivity = Object.keys(activity).length > 0;
    const base = activity['base'] || emptySummary;
    const baseIsRead =
      base.count === 0 &&
      base.unread === null &&
      !base.notify &&
      base['notify-count'] === 0;
    if (hasActivity && !baseIsRead && !isLoading) {
      markRead();
    }
  }, [activity, isLoading]);

  const getMore = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage]);

  return (
    <>
      {isMobile && (
        <MobileHeader
          title="Activity"
          action={
            <div className="flex h-12 items-center justify-end space-x-2">
              <ReconnectingSpinner />
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

        <div className="flex flex-col card h-full p-2 pr-0 sm:p-6 sm:mb-6">
          {!isMobile && (
            <div className="flex-none">
              <WelcomeCard />
              <div className="mb-6 flex w-full items-center justify-between">
                <h2 className="text-lg font-bold">Activity</h2>
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
              <div className="flex-1">
                <Virtuoso
                  data={notifications}
                  endReached={getMore}
                  computeItemKey={getKey}
                  itemContent={VirtualNotification}
                />
              </div>
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
