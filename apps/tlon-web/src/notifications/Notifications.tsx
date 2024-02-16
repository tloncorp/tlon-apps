import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ToggleGroup from '@/components/ToggleGroup';
import WelcomeCard from '@/components/WelcomeCard';
import GroupSummary from '@/groups/GroupSummary';
import { useIsMobile } from '@/logic/useMedia';
import { randomElement, randomIntInRange } from '@/logic/utils';
import { useAmAdmin, useGroup, useRouteGroup } from '@/state/groups';
import { useSawRopeMutation, useSawSeamMutation } from '@/state/hark';
import { ViewProps } from '@/types/groups';
import { Skein } from '@/types/hark';
import cn from 'classnames';
import { ComponentType, PropsWithChildren, useCallback, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';

import { NotificationFilterType, useNotifications } from './useNotifications';

export interface NotificationsProps {
  child: ComponentType<{ bin: Skein }>;
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
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();
  const [notificationFilter, setNotificationFilter] =
    useState<NotificationFilterType>('all');
  const {
    loaded,
    notifications,
    unreadReplies,
    unreadInvites,
    count,
    inviteCount,
    replyCount,
  } = useNotifications(flag, notificationFilter);
  const { mutateAsync: sawRopeMutation, status: sawRopeStatus } =
    useSawRopeMutation();
  const { mutate: sawSeamMutation, status: sawSeamStatus } =
    useSawSeamMutation();
  const isMarkReadPending =
    sawRopeStatus === 'loading' || sawSeamStatus === 'loading';
  const hasUnreads = count > 0;

  const markAllRead = useCallback(async () => {
    if (notificationFilter === 'invites' && unreadInvites) {
      unreadInvites?.forEach((invite, index) => {
        sawRopeMutation({
          rope: invite.top.rope,
          update: index === unreadInvites.length - 1,
        });
      });
    } else if (notificationFilter === 'replies' && unreadReplies) {
      await Promise.all(
        unreadReplies.map(async (reply, index) =>
          sawRopeMutation({
            rope: reply.top.rope,
            update: index === unreadReplies.length - 1,
          })
        )
      );
    } else {
      sawSeamMutation({ seam: flag ? { group: flag } : { desk: 'groups' } });
    }
  }, [
    flag,
    sawSeamMutation,
    notificationFilter,
    sawRopeMutation,
    unreadInvites,
    unreadReplies,
  ]);

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
      <section className="relative flex h-full w-full flex-col space-y-6 overflow-y-scroll bg-white p-2 sm:bg-gray-50 sm:p-6">
        <Helmet>
          <title>{group ? `${group?.meta?.title} ${title}` : title}</title>
        </Helmet>

        {isMobile && (
          <div className="absolute inset-x-0 top-0 z-10 w-full py-2">
            <ToggleGroup
              value={notificationFilter}
              // @ts-expect-error NotificationFilterType is a string
              setValue={setNotificationFilter}
              options={[
                {
                  label: `All${count > 0 ? ` (${count})` : ''}`,
                  value: 'all',
                  ariaLabel: 'Show all notifications',
                },
                {
                  label: `Invites${
                    inviteCount && inviteCount > 0 ? ` (${inviteCount})` : ''
                  }`,
                  value: 'invites',
                  ariaLabel: 'Show only invites',
                },
                {
                  label: `Threads${
                    replyCount && replyCount > 0 ? ` (${replyCount})` : ''
                  } `,
                  value: 'replies',
                  ariaLabel: 'Show only threads',
                },
              ]}
              defaultOption="all"
            />
          </div>
        )}

        {group && (
          <div className="card">
            <div className="flex w-full items-center justify-between">
              <h2 className="mb-6 text-lg font-bold">Group Info</h2>
              {isAdmin && (
                <Link
                  to={`/groups/${flag}/edit`}
                  state={{ backgroundLocation: location }}
                  className="small-button"
                >
                  Edit Group Details
                </Link>
              )}
            </div>
            <GroupSummary flag={flag} preview={{ ...group, flag }} />
            <p className="prose-sm mt-4 leading-5 lg:max-w-sm">
              {group?.meta.description}
            </p>
          </div>
        )}

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
                    {grouping.skeins.map((b) => (
                      <li key={b.time}>
                        <Notification bin={b} />
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
