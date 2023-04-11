import React, { useCallback, useEffect } from 'react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { useLocalState, useSubscriptionStatus } from '@/state/local';
import bootstrap from '@/state/bootstrap';

export default function DisconnectNotice() {
  const { subscription, errorCount, airLockErrorCount } =
    useSubscriptionStatus();

  const onClick = useCallback(() => {
    if (errorCount < 3) {
      useLocalState.setState({ subscription: 'reconnecting' });
      bootstrap('reset');
    } else {
      window.location.reload();
    }
  }, [errorCount]);

  if (subscription === 'disconnected') {
    return (
      <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
        <div className="flex items-center">
          <AsteriskIcon className="mr-3 h-4 w-4" />
          <span className="mr-1">You are currently offline.</span>
        </div>
        <button className="py-1 px-2" onClick={onClick}>
          Reconnect
        </button>
      </div>
    );
  }

  return null;
}
