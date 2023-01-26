import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipSelector from '@/components/ShipSelector';
import useMessageSelector from '@/logic/useMessageSelector';
import { useIsMobile } from '@/logic/useMedia';

export default function MessageSelector() {
  const { action, onEnter, setShips, ships, validShips } = useMessageSelector();
  const isMobile = useIsMobile();

  const navigate = useNavigate();

  const onCancel = useCallback(() => {
    setShips([]);
    navigate('/');
  }, [navigate, setShips]);

  return (
    <>
      <div className="relative z-50 flex w-full items-center space-x-2 py-3 px-4">
        <div className="w-full">
          <ShipSelector
            ships={ships}
            setShips={setShips}
            onEnter={onEnter}
            isMulti={true}
          />
        </div>
        <button className="secondary-button py-2.5" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {validShips ? (
        <div className="absolute inset-0 z-40 flex h-full flex-1 flex-col items-center justify-center bg-gray-100/50">
          <div className="flex w-fit flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-100/90 p-8">
            {isMobile ? (
              <div className="flex flex-col items-center space-y-2">
                <button
                  className="small-button m-2"
                  onClick={() => onEnter(ships)}
                >
                  {action}
                </button>
              </div>
            ) : (
              <div className="text-lg text-gray-500">
                Press Enter to {action}
              </div>
            )}
            <div className="text-lg text-gray-300">or</div>
            <div className="text-lg text-gray-500">Add More Ships</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
