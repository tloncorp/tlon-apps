import cn from 'classnames';
import React, {
  ComponentType,
  PropsWithChildren,
  useCallback,
  useState,
} from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useRouteGroup, useGroup } from '@/state/groups';
import { ViewProps } from '@/types/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import useHarkState from '@/state/hark';
import useRequestState from '@/logic/useRequestState';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsDark, useIsMobile } from '@/logic/useMedia';
import {
  Bin,
  getAllMentions,
  isMention,
  useNotifications,
} from './useNotifications';

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
  const mentions = getAllMentions(notifications);
  const unreadMentions = mentions.filter((m) => m.unread);
  const hasUnreads = count > 0;
  const { isPending, setPending, setReady } = useRequestState();
  const [showMentionsOnly, setShowMentionsOnly] = useState(false);
  const isDarkMode = useIsDark();
  const isMobile = useIsMobile();

  const markAllRead = useCallback(async () => {
    setPending();
    if (showMentionsOnly) {
      await Promise.all(
        unreadMentions.map(async (m) => {
          await useHarkState.getState().sawRope(m.topYarn.rope);
        })
      );
    } else {
      await useHarkState
        .getState()
        .sawSeam(flag ? { group: flag } : { desk: 'groups' });
    }
    setReady();
  }, [setPending, setReady, unreadMentions, showMentionsOnly, flag]);

  return (
    <section className="h-full w-full overflow-y-auto bg-gray-50 p-6">
      <Helmet>
        <title>
          {group
            ? `All Notifications for ${group?.meta?.title} ${title}`
            : title}
        </title>
      </Helmet>
      <div className="flex w-full items-center justify-between">
        <div
          className={cn('flex flex-row', {
            'w-full justify-center': isMobile,
          })}
        >
          <button
            onClick={() => setShowMentionsOnly(false)}
            className={cn('small-button rounded-r-none', {
              'bg-gray-800 text-white': !showMentionsOnly,
              'bg-white text-gray-800 ': showMentionsOnly,
              'grow whitespace-nowrap': isMobile,
            })}
          >
            All Notifications{hasUnreads ? ` • ${count} New` : null}
          </button>
          <button
            onClick={() => setShowMentionsOnly(true)}
            className={cn('small-button rounded-l-none', {
              'bg-gray-800 text-white': showMentionsOnly,
              'bg-white text-gray-800': !showMentionsOnly,
              'grow whitespace-nowrap': isMobile,
            })}
          >
            Mentions Only
            {unreadMentions.length ? ` • ${unreadMentions.length} New` : null}
          </button>
        </div>

        {!isMobile && hasUnreads && !showMentionsOnly && (
          <button
            disabled={isPending}
            className={cn('small-button bg-blue text-white', {
              'bg-gray-400 text-gray-800': isPending,
            })}
            onClick={markAllRead}
          >
            {isPending ? (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            ) : (
              'Mark All as Read'
            )}
          </button>
        )}
        {!isMobile && showMentionsOnly && unreadMentions.length > 0 && (
          <button
            disabled={isPending}
            className={cn('small-button bg-blue text-white', {
              'bg-gray-400 text-gray-800': isPending,
            })}
            onClick={markAllRead}
          >
            {isPending ? (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            ) : (
              'Mark Mentions as Read'
            )}
          </button>
        )}
      </div>
      <div className="flex flex-row justify-end pt-2">
        {isMobile && !showMentionsOnly && (
          <button
            disabled={isPending || !hasUnreads}
            className={cn('small-button whitespace-nowrap', {
              'bg-gray-400 text-gray-800': isPending || !hasUnreads,
              'text-text-white bg-blue': !isPending && hasUnreads,
            })}
            onClick={markAllRead}
          >
            {isPending ? (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            ) : (
              'Mark All as Read'
            )}
          </button>
        )}
        {isMobile && showMentionsOnly && (
          <button
            disabled={isPending || unreadMentions.length === 0}
            className={cn('small-button whitespace-nowrap', {
              'bg-blue text-white': unreadMentions.length > 0 && !isPending,
              'bg-gray-400 text-gray-800':
                isPending || unreadMentions.length === 0,
            })}
            onClick={markAllRead}
          >
            {isPending ? (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            ) : (
              'Mark Mentions as Read'
            )}
          </button>
        )}
      </div>
      {showMentionsOnly
        ? notifications
            .filter(
              (n) => n.bins.filter((b) => isMention(b.topYarn)).length > 0
            )
            .map((n) => (
              <div key={n.date}>
                <h2 className="my-4 text-lg font-bold text-gray-400">
                  {n.date}
                </h2>
                <ul className="space-y-2">
                  {n.bins
                    .filter((b) => isMention(b.topYarn))
                    .map((bin) => (
                      <li key={bin.time}>
                        <Notification bin={bin} />
                      </li>
                    ))}
                </ul>
              </div>
            ))
        : notifications.map((grouping) => (
            <div key={grouping.date}>
              <h2 className="my-4 text-lg font-bold text-gray-400">
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
