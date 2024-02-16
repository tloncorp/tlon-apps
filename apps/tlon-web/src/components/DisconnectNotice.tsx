import Asterisk16Icon from '@/components/icons/Asterisk16Icon';
import bootstrap from '@/state/bootstrap';
import { useLocalState, useSubscriptionStatus } from '@/state/local';
import { useCallback } from 'react';

export default function DisconnectNotice() {
  const { subscription, errorCount } = useSubscriptionStatus();

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
      <div className="z-50 flex items-center justify-between bg-yellow px-2 py-1 text-sm font-medium text-black dark:text-white">
        <div className="flex items-center">
          <Asterisk16Icon className="mr-3 h-4 w-4" />
          <span className="mr-1">You are currently offline.</span>
        </div>
        <button className="px-2 py-1" onClick={onClick}>
          Reconnect
        </button>
      </div>
    );
  }

  return null;
}
