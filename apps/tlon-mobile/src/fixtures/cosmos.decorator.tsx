import { TamaguiProvider } from '@tloncorp/ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { config as tamaguiConfig } from '../../tamagui.config';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => (
  <TamaguiProvider defaultTheme={'light'} config={tamaguiConfig}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </TamaguiProvider>
);
