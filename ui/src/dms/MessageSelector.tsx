import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipSelector from '@/components/ShipSelector';
import useMessageSelector from '@/logic/useMessageSelector';

export default function MessageSelector() {
  const { onEnter, setShips, ships } = useMessageSelector();

  const navigate = useNavigate();

  const onCancel = useCallback(() => {
    setShips([]);
    navigate('/');
  }, [navigate, setShips]);

  return (
    <div className="flex w-full items-center space-x-2 py-3 px-4">
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
  );
}
