import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortalProvider, TamaguiProvider, config } from '../ui';
import { ChannelProvider } from '../ui/contexts/channel';
import { ComponentsKitProvider } from '../ui/contexts/componentsKits/ComponentsKitProvider';
import { CosmosDbProvider } from './cosmosDb';
import { tlonLocalIntros } from './fakeData';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => {
  return (
    <TamaguiProvider defaultTheme={'light'} config={config}>
      <QueryClientProvider client={queryClient}>
        <CosmosDbProvider>
          <SafeAreaProvider>
            <ChannelProvider value={{ channel: tlonLocalIntros }}>
              <ComponentsKitProvider>
                <NavigationContainer>
                  <PortalProvider>{children}</PortalProvider>
                </NavigationContainer>
              </ComponentsKitProvider>
            </ChannelProvider>
          </SafeAreaProvider>
        </CosmosDbProvider>
      </QueryClientProvider>
    </TamaguiProvider>
  );
};
