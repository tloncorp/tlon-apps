import React, { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { useChannel, useAmAdmin, useGroup } from '@/state/groups';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import { getFlagParts } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import ChannelActions from './ChannelActions';
import ChannelTitleButton from './ChannelTitleButton';
import HostConnection from './HostConnection';
import ChannelIcon from './ChannelIcon';

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
  const isAdmin = useAmAdmin(flag);
  const group = useGroup(flag);
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const saga = group?.saga || null;

  if (isMobile) {
    return (
      <MobileHeader
        title={
          <div className="flex flex-col items-center space-y-2">
            <ChannelIcon
              nest={nest}
              className="h-7 w-7 shrink-0 px-0.5 pb-0.5 pt-1 text-gray-600"
            />
            <div className="flex w-full items-center justify-center space-x-1">
              <h1 className="text-[18px] text-gray-800 line-clamp-1">
                {channel?.meta.title}
              </h1>
              <HostConnection ship={host} status={data?.status} saga={saga} />
            </div>
          </div>
        }
        action={
          <div className="flex flex-row space-x-3">
            <ReconnectingSpinner />
            <Link
              to="search/"
              className="flex h-8 w-8 rounded hover:bg-gray-50"
              aria-label="Search Chat"
            >
              <MagnifyingGlassMobileNavIcon className="h-8 w-8 p-1 text-gray-900" />
            </Link>
            <ChannelActions
              {...{ nest, prettyAppName, channel, isAdmin, leave }}
            />
          </div>
        }
        pathBack={`/groups/${flag}`}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <ChannelTitleButton flag={flag} nest={nest} />
      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        {children}
        <ChannelActions {...{ nest, prettyAppName, channel, isAdmin, leave }} />
      </div>
    </div>
  );
}
