import { useAmAdmin, useRouteGroup } from '@/state/groups';
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

  return (
    <div className="my-3 flex items-center justify-between">
      <div>
        {isAdmin ? (
          <>
            <button
              className="button mx-2 bg-blue bg-blend-multiply"
              onClick={() => addSection()}
            >
              New Section
            </button>
            <Link
              to={`/groups/${flag}/channels/new`}
              state={{ backgroundLocation: location }}
              className="button bg-blue"
            >
              New Channel
            </Link>
          </>
        ) : null}
      </div>
      <ChannelsListSearch />
    </div>
  );
}
