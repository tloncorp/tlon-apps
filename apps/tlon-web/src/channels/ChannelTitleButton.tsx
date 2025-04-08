import cn from 'classnames';
import { Link } from 'react-router-dom';

import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { useChatTitle } from '@/logic/channelUtils';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useGroupChannel } from '@/state/groups';

import ChannelHostConnection from './ChannelHostConnection';
import ChannelIcon from './ChannelIcon';

interface ChannelTitleButtonProps {
  flag: string;
  nest: string;
}

export default function ChannelTitleButton({
  flag,
  nest,
}: ChannelTitleButtonProps) {
  const isMobile = useIsMobile();
  const channel = useGroupChannel(flag, nest);
  const group = useGroup(flag);
  const chatTitle = useChatTitle(channel, group);
  const BackButton = isMobile ? Link : 'div';

  function backTo() {
    return `/groups/${flag}`;
  }

  return (
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
        <div
          className={cn(
            'ellipsis flex flex-row items-center space-x-1 font-bold  sm:font-semibold',
            channel?.meta.description ? 'text-sm' : 'text-lg sm:text-sm'
          )}
        >
          <span className="line-clamp-1">
            {chatTitle ?? channel?.meta.title}
          </span>
          <ChannelHostConnection nest={nest} />
        </div>
        <span className="line-clamp-1 w-full break-all text-sm text-gray-400">
          {channel?.meta.description}
        </span>
      </div>
    </BackButton>
  );
}
