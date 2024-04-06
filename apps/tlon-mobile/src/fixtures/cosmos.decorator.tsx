import { TamaguiProvider, View } from '@tloncorp/ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <TamaguiProvider>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </TamaguiProvider>
);
