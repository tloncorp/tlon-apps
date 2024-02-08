import { PropsWithChildren } from 'react';
import cn from 'classnames';
import { useIsMobile } from '@/logic/useMedia';
import { useGroupChannel, useAmAdmin } from '@/state/groups';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import ChannelActions, { ChannelActionsProps } from './ChannelActions';
import ChannelTitleButton from './ChannelTitleButton';
import ChannelIcon from './ChannelIcon';
import ChannelHostConnection from './ChannelHostConnection';

export type ChannelHeaderProps = PropsWithChildren<{
  groupFlag: string;
  nest: string;
  prettyAppName: string;
  leave: ({ nest }: { nest: string }) => Promise<void>;
}>;

export default function ChannelHeader({
  groupFlag,
  nest,
  prettyAppName,
  leave,
  children,
}: ChannelHeaderProps) {
  const isMobile = useIsMobile();
  const channel = useGroupChannel(groupFlag, nest);
  const isAdmin = useAmAdmin(groupFlag);

  const actionProps: ChannelActionsProps = {
    nest,
    prettyAppName,
    channel,
    isAdmin,
    leave,
  };

  if (isMobile) {
    return (
      <MobileHeader
        title={
          <ChannelActions
            {...actionProps}
            className="flex max-w-full items-center justify-center"
          >
            <ChannelIcon
              nest={nest}
              className="h-6 w-6 flex-none text-gray-600"
            />
            <h1 className="ml-2 flex flex-1 items-center overflow-hidden text-[17px] leading-5 text-gray-800">
              <span className="truncate">{channel?.meta.title}</span>
            </h1>
            <ChannelHostConnection
              className="ml-1 inline-flex flex-none"
              nest={nest}
            />
          </ChannelActions>
        }
        action={
          <div className="flex h-12 flex-row items-center justify-end space-x-2">
            <ReconnectingSpinner />
            {children}
          </div>
        }
        pathBack={`/groups/${groupFlag}`}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
      )}
    >
      <ChannelTitleButton flag={groupFlag} nest={nest} />
      <div className="flex shrink-0 flex-row items-center space-x-3">
        {isMobile && <ReconnectingSpinner />}
        {children}
        <ChannelActions {...actionProps} />
      </div>
    </div>
  );
}
