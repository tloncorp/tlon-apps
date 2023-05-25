import React, { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { isTalk } from '@/logic/utils';
import { useChannel, useAmAdmin } from '@/state/groups';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ChannelIcon from '@/channels/ChannelIcon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
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

  function backTo() {
    if (isMobile && isTalk) {
      return '/';
    }
    return `/groups/${flag}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <BackButton
        to={backTo()}
        className={cn(
          'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2'
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <div className="flex h-6 w-6 items-center justify-center">
            <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
          </div>
        ) : null}
        <ChannelIcon nest={nest} className="h-6 w-6 shrink-0 text-gray-600" />
        <div className="flex w-full flex-col justify-center">
          <span
            className={cn(
              'ellipsis font-bold line-clamp-1 sm:font-semibold',
              channel?.meta.description ? 'text-sm' : 'text-lg sm:text-sm'
            )}
          >
            {channel?.meta.title}
          </span>
          <span className="w-full break-all text-sm text-gray-400 line-clamp-1">
            {channel?.meta.description}
          </span>
        </div>
      </BackButton>
      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        {children}
        <ChannelActions {...{ nest, prettyAppName, channel, isAdmin, leave }} />
      </div>
    </div>
  );
}
