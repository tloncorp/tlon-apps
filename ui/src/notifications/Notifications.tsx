import cn from 'classnames';
import React, {
  ComponentType,
  useCallback,
  useState,
  PropsWithChildren,
} from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { useRouteGroup, useGroup, useAmAdmin } from '@/state/groups';
import { ViewProps } from '@/types/groups';
import { useSawRopeMutation, useSawSeamMutation } from '@/state/hark';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import { randomElement, randomIntInRange } from '@/logic/utils';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { Skein } from '@/types/hark';
import GroupSummary from '@/groups/GroupSummary';
import MobileHeader from '@/components/MobileHeader';
import { useNotifications } from './useNotifications';

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
  const [showMentionsOnly, setShowMentionsOnly] = useState(false);
  const { loaded, notifications, mentions, count } = useNotifications(
    flag,
    showMentionsOnly
  );
  const { mutate: sawRopeMutation, status: sawRopeStatus } =
    useSawRopeMutation();
  const { mutate: sawSeamMutation, status: sawSeamStatus } =
    useSawSeamMutation();
  const isMarkReadPending =
    sawRopeStatus === 'loading' || sawSeamStatus === 'loading';
  const hasUnreads = count > 0;

  const markAllRead = useCallback(async () => {
    if (showMentionsOnly) {
      mentions.map(async (m, index) =>
        sawRopeMutation({
          rope: m.top.rope,
          update: index === mentions.length - 1,
        })
      );
    } else {
      sawSeamMutation({ seam: flag ? { group: flag } : { desk: 'groups' } });
    }
  }, [mentions, showMentionsOnly, flag, sawRopeMutation, sawSeamMutation]);

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
        `Mark ${showMentionsOnly ? 'Mentions' : 'All'} as Read`
      )}
    </button>
  );

  return (
    <>
      {isMobile && (
        <MobileHeader title="Activity" action={<ReconnectingSpinner />} />
      )}
      <section className="flex h-full w-full flex-col space-y-6 overflow-y-scroll bg-gray-50 p-6">
        <Helmet>
          <title>{group ? `${group?.meta?.title} ${title}` : title}</title>
        </Helmet>

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

        <div className="card">
          <div className="mb-6 flex w-full items-center justify-between">
            <h2 className="text-lg font-bold">
              {group && 'Group '}Activity{!group && ' in All Groups'}
            </h2>
            {hasUnreads && MarkAsRead}
          </div>

          {loaded ? (
            notifications.length === 0 ? (
              <div className="mt-3 flex w-full items-center justify-center">
                <span className="text-base font-semibold text-gray-400">
                  No notifications from {group ? 'this' : 'any'} group.
                </span>
              </div>
            ) : (
              notifications.map((grouping) => (
                <div key={grouping.date}>
                  {grouping.date !== 'Today' && (
                    <h2 className="mb-4 text-lg font-bold text-gray-400">
                      {grouping.date}
                    </h2>
                  )}
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
