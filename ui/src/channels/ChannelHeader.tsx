import React, { PropsWithChildren, useEffect } from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { isTalk } from '@/logic/utils';
import { useChannel, useAmAdmin } from '@/state/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ChannelIcon from '@/channels/ChannelIcon';
import { useNotifications } from '@/notifications/useNotifications';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { useSawRopeMutation } from '@/state/hark';
import ChannelActions from './ChannelActions';

export type ChannelHeaderProps = PropsWithChildren<{
  flag: string;
  nest: string;
  prettyAppName: string;
  leave: (flag: string) => Promise<void>;
}>;

export default function ChannelHeader({
  flag,
  nest,
  prettyAppName,
  leave,
  children,
}: ChannelHeaderProps) {
  const isMobile = useIsMobile();
  const channel = useChannel(flag, nest);
  const BackButton = isMobile ? Link : 'div';
  const isAdmin = useAmAdmin(flag);
  const { notifications, count } = useNotifications(flag);
  const { mutate: sawRopeMutation } = useSawRopeMutation();
  useEffect(() => {
    if (count > 0) {
      const unreadBins = notifications
        .filter((n) => n.skeins.some((b) => b.unread === true))[0]
        ?.skeins.filter((b) => b.unread === true);

      if (unreadBins) {
        const unreadsHere = unreadBins.filter((b) => b.top.wer.includes(nest));

        unreadsHere.forEach((n, index) => {
          // update on the last call
          sawRopeMutation({
            rope: n.top.rope,
            update: index === unreadsHere.length - 1,
          });
        });
      }
    }
  }, [count, notifications, nest, sawRopeMutation]);

  function backTo() {
    if (isMobile && isTalk) {
      return '/';
    }
    return `/groups/${flag}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4'
      )}
    >
      <BackButton
        to={backTo()}
        className={cn(
          'default-focus ellipsis inline-flex appearance-none items-center pr-2 text-lg font-bold text-gray-800 sm:text-base sm:font-semibold',
          isMobile && ''
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
        ) : null}
        <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
          <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
        </div>
        <span className="ellipsis line-clamp-1">{channel?.meta.title}</span>
      </BackButton>
      <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
        {isMobile && <ReconnectingSpinner />}
        {children}
        <ChannelActions {...{ nest, prettyAppName, channel, isAdmin, leave }} />
      </div>
    </div>
  );
}
