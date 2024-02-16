import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useRouteGroup } from '@/state/groups';

interface EmptySectionToolsProps {
  sectionKey: string;
}

export default function EmptySectionTools({
  sectionKey,
}: EmptySectionToolsProps) {
  const flag = useRouteGroup();
  const location = useLocation();

  return (
    <div className="flex items-center px-5 py-4">
      <Link
        to={`/groups/${flag}/channels/new/${sectionKey}`}
        state={{ backgroundLocation: location }}
        className="small-button"
      >
        New Channel
      </Link>
      <h2 className="ml-2 font-semibold text-gray-600">
        or drag a Channel here
      </h2>
    </div>
  );
}
