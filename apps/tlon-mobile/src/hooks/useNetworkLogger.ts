import NetInfo from '@react-native-community/netinfo';
import { createDevLogger } from '@tloncorp/shared/dist';
import { useEffect, useState } from 'react';

import { toNetworkTypeDisplay } from '../lib/platformHelpers';

const logger = createDevLogger('network', false);

export function useNetworkLogger() {
  const [previous, setPrevious] = useState({ connected: true });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected && previous.connected) {
        logger.crumb('disconnected');
        setPrevious({ connected: false });
      }

      if (state.isConnected && !previous.connected) {
        logger.crumb(`reconnected ${toNetworkTypeDisplay(state)}`);
        setPrevious({ connected: true });
      }
    });

    // Cleanup function to unsubscribe when component unmounts
    return () => unsubscribe();
  }, [previous.connected]);
}
