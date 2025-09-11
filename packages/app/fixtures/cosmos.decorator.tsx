import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetDb } from '../lib/nativeDb';
import { PortalProvider, StoreProvider, TamaguiProvider, config } from '../ui';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // We should be using an in-memory DB, so we're safe to clear DB
    resetDb().catch((err) => {
      console.error('Failed to reset DB', err);
    });
  }, []);

  return (
    <TamaguiProvider defaultTheme={'light'} config={config}>
      <StoreProvider>
        <SafeAreaProvider>
          <PortalProvider>{children}</PortalProvider>
        </SafeAreaProvider>
      </StoreProvider>
    </TamaguiProvider>
  );
};
