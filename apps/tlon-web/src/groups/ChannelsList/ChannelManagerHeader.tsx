import cn from 'classnames';
import { Link, useLocation } from 'react-router-dom';

import Tooltip from '@/components/Tooltip';
import { useIsMobile } from '@/logic/useMedia';
import {
  useAmAdmin,
  useGroupCompatibility,
  useRouteGroup,
} from '@/state/groups';

import GroupHostConnection from '../GroupHostConnection';
import ChannelsListSearch from './ChannelsListSearch';

interface ChannelManagerHeaderProps {
  addSection: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  const location = useLocation();
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const isMobile = useIsMobile();
  const { text, compatible } = useGroupCompatibility(flag);

  return (
    <div className="my-4 flex w-full flex-col justify-between space-y-2 sm:flex-row sm:items-center sm:space-x-2">
      {isAdmin ? (
        <div className="mt-2 flex flex-row space-x-2 whitespace-nowrap">
          <Tooltip content={text} open={compatible ? false : undefined}>
            <button
              disabled={!compatible}
              className={cn(
                'bg-blue text-center',
                isMobile ? 'small-button' : 'button'
              )}
              onClick={() => addSection()}
            >
              New Section
            </button>
          </Tooltip>
          <Link
            to={`/groups/${flag}/channels/new`}
            state={{ backgroundLocation: location }}
            className={cn(
              'bg-blue-soft text-center text-blue',
              isMobile ? 'small-button' : 'button'
            )}
            data-testid="new-channel-button"
          >
            New Channel
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ChannelsListSearch className="w-full flex-1 md:w-[300px]" />
        <GroupHostConnection
          className={cn(isAdmin && 'order-first')}
          flag={flag}
          hideIfConnected
        />
      </div>
    </div>
  );
}
