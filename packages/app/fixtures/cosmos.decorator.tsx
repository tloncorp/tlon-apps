import { NavigationContainer } from '@react-navigation/native';
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
    </TamaguiProvider>
  );
};
