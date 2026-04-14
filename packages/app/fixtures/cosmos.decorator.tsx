import { spyOn } from '@tloncorp/shared';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  PortalProvider,
  StoreProvider,
  TamaguiProvider,
  config,
  createNoOpStore,
} from '../ui';
import { ChannelProvider } from '../ui/contexts/channel';
import { ComponentsKitProvider } from '../ui/contexts/componentsKits/ComponentsKitProvider';
import { group, tlonLocalIntros } from './fakeData';

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => {
  const store = useMemo(() => {
    const noOpStore = createNoOpStore();
    const mockUseGroup = () => ({
      data: group,
      isLoading: false,
      error: null,
    });

    // @ts-expect-error - fixture mock
    return spyOn(noOpStore, 'useGroup', mockUseGroup);
  }, []);

  return (
    <TamaguiProvider defaultTheme={'light'} config={config}>
      <StoreProvider stub={store}>
        <SafeAreaProvider>
          <ChannelProvider value={{ channel: tlonLocalIntros }}>
            <ComponentsKitProvider>
              <PortalProvider>{children}</PortalProvider>
            </ComponentsKitProvider>
          </ChannelProvider>
        </SafeAreaProvider>
      </StoreProvider>
    </TamaguiProvider>
  );
};
