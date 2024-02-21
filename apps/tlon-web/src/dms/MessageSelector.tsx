import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import ShipSelector from '@/components/ShipSelector';
import { useSafeAreaInsets } from '@/logic/native';
import { useIsMobile } from '@/logic/useMedia';
import useMessageSelector from '@/logic/useMessageSelector';
import { dmListPath } from '@/logic/utils';

export default function MessageSelector() {
  const { onEnter, setShips, ships } = useMessageSelector();
  const isMobile = useIsMobile();
  const safeAreaInsets = useSafeAreaInsets();

  const navigate = useNavigate();

  const onCancel = useCallback(() => {
    setShips([]);
    navigate(dmListPath);
  }, [navigate, setShips]);

  return (
    <div
      style={{
        paddingTop: safeAreaInsets.top,
      }}
      className="relative z-50 flex w-full flex-col items-center px-4 py-3 sm:flex-row sm:space-x-2"
    >
      <ShipSelector
        ships={ships}
        setShips={setShips}
        onEnter={onEnter}
        isMulti={true}
        containerClassName="w-full grow"
      />
      <div className="my-2.5 flex w-full flex-row justify-evenly sm:w-auto">
        {!isMobile ? (
          <button
            className="secondary-button ml-1 w-1/2 py-2.5 sm:ml-auto sm:w-auto"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
