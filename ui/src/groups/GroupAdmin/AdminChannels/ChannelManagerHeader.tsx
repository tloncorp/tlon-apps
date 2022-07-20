import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router';
import { useRouteGroup } from '@/state/groups';
import EditChannelModal from './EditChannelModal';

interface ChannelManagerHeaderProps {
  addSection: () => void;
  // setEditIsOpen: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  const flag = useRouteGroup();
  const location = useLocation();
  const [editIsOpen, setEditIsOpen] = useState(false);
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
