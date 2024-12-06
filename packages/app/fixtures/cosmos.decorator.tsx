import { TamaguiProvider, config } from '@tloncorp/ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <TamaguiProvider defaultTheme={'light'} config={config}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </TamaguiProvider>
);
