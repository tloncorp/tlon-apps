import { StoreProvider, TamaguiProvider, config } from '@tloncorp/app/ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <TamaguiProvider defaultTheme={'light'} config={config}>
    <StoreProvider stub>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </StoreProvider>
  </TamaguiProvider>
);
