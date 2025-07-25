import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortalProvider, StoreProvider, TamaguiProvider, config } from '../ui';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <TamaguiProvider defaultTheme={'light'} config={config}>
    <StoreProvider stub>
      <SafeAreaProvider>
        <PortalProvider>{children}</PortalProvider>
      </SafeAreaProvider>
    </StoreProvider>
  </TamaguiProvider>
);
