import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipSelector from '@/components/ShipSelector';
import useMessageSelector from '@/logic/useMessageSelector';
import { useIsMobile } from '@/logic/useMedia';
import useAppName from '@/logic/useAppName';

export default function MessageSelector() {
  const { action, onEnter, setShips, ships, validShips } = useMessageSelector();
  const isMobile = useIsMobile();
  const appName = useAppName();

  const navigate = useNavigate();

  const onCancel = useCallback(() => {
    setShips([]);
    if (appName === 'Groups' && isMobile) {
      navigate('/messages');
    } else {
      navigate('/');
    }
  }, [navigate, setShips, appName, isMobile]);

  return (
    <div className="relative z-50 flex w-full flex-col items-center py-3 px-4 sm:flex-row sm:space-x-2">
      <ShipSelector
        ships={ships}
        setShips={setShips}
        onEnter={onEnter}
        isMulti={true}
        containerClassName="w-full grow"
      />
      <div className="my-2.5 flex w-full flex-row justify-evenly sm:w-auto">
        {isMobile ? (
          <button
            className="secondary-button mr-1 w-1/2 py-2.5 sm:mr-auto sm:w-auto"
            disabled={!validShips}
            onClick={() => onEnter(ships)}
          >
            {action}
          </button>
        ) : null}
        <button
          className="secondary-button ml-1 w-1/2 py-2.5 sm:ml-auto sm:w-auto"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
