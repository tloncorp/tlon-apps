import React, { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { isTalk } from '@/logic/utils';
import useKilnState, { usePike } from '@/state/kiln';

type UpdateStatus = 'none' | 'glob' | 'sw';

export default function UpdateNotice() {
  const appName = isTalk ? 'Talk' : 'Groups';
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const pike = usePike(appName.toLocaleLowerCase());
  const [baseHash, setBaseHash] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('none');

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
    if (needRefresh) {
      setUpdateStatus('sw');
    }
    if (
      pike &&
      pike.hash !== baseHash &&
      baseHash !== '' &&
      updateStatus === 'none'
    ) {
      setUpdateStatus('glob');
    }
  }, [pike, baseHash, updateStatus, needRefresh]);

  const onClick = useCallback(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  }, [needRefresh, updateServiceWorker]);

  if (updateStatus === 'none') {
    return null;
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        {updateStatus === 'glob' && (
          <span className="mr-1">
            {appName} has updated in the background. Please reload.
          </span>
        )}
        {updateStatus === 'sw' && (
          <span className="mr-1">{appName} has updates waiting.</span>
        )}
      </div>
      <button className="py-1 px-2" onClick={onClick}>
        {updateStatus === 'sw' ? 'Update' : 'Reload'}
      </button>
    </div>
  );
}
