import { useIsMobile } from '@/logic/useMedia';
import { useAmAdmin, useRouteGroup } from '@/state/groups';
import cn from 'classnames';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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

  return (
    <div className="my-3 flex flex-col items-center justify-between md:flex-row">
      <div>
        {isAdmin ? (
          <div className="mb-2 md:mb-0">
            <button
              className={cn('mx-2 bg-blue', {
                button: !isMobile,
                'small-button text-center': isMobile,
              })}
              onClick={() => addSection()}
            >
              New Section
            </button>
            <Link
              to={`/groups/${flag}/channels/new`}
              state={{ backgroundLocation: location }}
              className={cn('bg-blue', {
                button: !isMobile,
                'small-button text-center': isMobile,
              })}
            >
              New Channel
            </Link>
          </div>
        ) : null}
      </div>
      <ChannelsListSearch />
    </div>
  );
}
