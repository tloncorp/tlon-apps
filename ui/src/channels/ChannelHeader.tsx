import React, { PropsWithChildren } from 'react';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { useChannel, useAmAdmin } from '@/state/groups';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ChannelActions from './ChannelActions';
import ChannelTitleButton from './ChannelTitleButton';
import ChannelVersionStatus from './ChannelVersionStatus';

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

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <ChannelTitleButton flag={flag} nest={nest} />
      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        <ChannelVersionStatus saga={{ ahead: 'test' }} />
        {children}
        <ChannelActions {...{ nest, prettyAppName, channel, isAdmin, leave }} />
      </div>
    </div>
  );
}
