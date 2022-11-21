import { useRouteGroup } from '@/state/groups';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface ChannelManagerHeaderProps {
  addSection: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  const location = useLocation();
  const flag = useRouteGroup();

  return (
    <div className="my-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">Channels</h2>
      <div>
        <button
          className="small-secondary-button mx-2 bg-blend-multiply"
          onClick={() => addSection()}
        >
          New Section
        </button>
        <Link
          to={`/groups/${flag}/channels/new`}
          state={{ backgroundLocation: location }}
          className="small-button"
        >
          New Channel
        </Link>
      </div>
    </div>
  );
}
