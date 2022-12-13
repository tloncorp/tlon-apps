import React from 'react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import {
  useErrorCount,
  useLocalState,
  useSubscriptionStatus,
} from '@/state/local';
import bootstrap from '@/state/bootstrap';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';

export default function DisconnectNotice() {
  const errorCount = useErrorCount();
  const subscription = useSubscriptionStatus();

  function onClick() {
    if (errorCount < 3) {
      useLocalState.setState({ subscription: 'reconnecting' });
      bootstrap();
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        {subscription === 'reconnecting' ? (
          <LoadingSpinner className="mr-3 h-4 w-4" />
        ) : (
          <AsteriskIcon className="mr-3 h-4 w-4" />
        )}
        {subscription === 'reconnecting' ? (
          <span>Reconnecting...</span>
        ) : (
          <span className="mr-1">You are currently offline.</span>
        )}
      </div>
      {subscription === 'reconnecting' ? null : (
        <button className="py-1 px-2" onClick={onClick}>
          Reconnect
        </button>
      )}
    </div>
  );
}
