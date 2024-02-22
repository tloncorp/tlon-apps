import React, { useState } from 'react';

import FavoriteGroup from './FavoriteGroup';

interface FavoriteGroupGridProps {
  groupFlags: string[];
}

export default function FavoriteGroupGrid({
  groupFlags,
}: FavoriteGroupGridProps) {
  const [showAllGroups, setShowAllGroups] = useState(false);

  const showButton = groupFlags.length > 12;

  const handleButtonClick = () => {
    setShowAllGroups(!showAllGroups);
  };

  return (
    <>
      <div className="flex flex-wrap place-content-start gap-3">
        {groupFlags
          .slice(0, showAllGroups ? groupFlags.length : 11)
          .map((groupFlag) => (
            <FavoriteGroup groupFlag={groupFlag} key={groupFlag} />
          ))}
      </div>
      {showButton && (
        <button
          onClick={handleButtonClick}
          className="small-secondary-button mt-2"
        >
          {showAllGroups ? 'Collapse Groups' : 'Expand Groups'}
        </button>
      )}
    </>
  );
}
