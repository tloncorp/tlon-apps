import React, { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { isTalk } from '@/logic/utils';
import useKilnState, { usePike } from '@/state/kiln';

export default function UpdateNotice() {
  const appName = isTalk ? 'Talk' : 'Groups';
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const pike = usePike(appName.toLocaleLowerCase());
  const [baseHash, setBaseHash] = useState('');
  const [needsUpdate, setNeedsUpdate] = useState(false);

  const fetchPikes = useCallback(async () => {
    try {
      await useKilnState.getState().fetchPikes();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (pike && baseHash === '') {
      setBaseHash(pike.hash);
    }
  }, [pike, baseHash]);

  useEffect(() => {
    setInterval(fetchPikes, 1000 * 60 * 5);
  }, [fetchPikes]);

  useEffect(() => {
    if (pike && pike.hash !== baseHash && baseHash !== '' && !needsUpdate) {
      setNeedsUpdate(true);
    }
    if (needRefresh && !needsUpdate) {
      setNeedsUpdate(true);
    }
  }, [pike, baseHash, needsUpdate, needRefresh]);

  const onClick = useCallback(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  }, [needRefresh, updateServiceWorker]);

  if (!needsUpdate) {
    return null;
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        <span className="mr-1">
          {appName} has updated in the background. Please reload.
        </span>
      </div>
      <button className="py-1 px-2" onClick={onClick}>
        Reload
      </button>
    </div>
  );
}
