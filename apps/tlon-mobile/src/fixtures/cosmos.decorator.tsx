import { CosmosDbProvider } from '@tloncorp/app/fixtures/cosmosDb';
import { TamaguiProvider, config } from '@tloncorp/app/ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider>
      <TamaguiProvider defaultTheme={'light'} config={config}>
        <CosmosDbProvider>{children}</CosmosDbProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
};
