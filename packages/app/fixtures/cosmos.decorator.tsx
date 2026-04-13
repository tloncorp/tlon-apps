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
import { ComponentsKitProvider } from '../ui/contexts/componentsKits/ComponentsKitProvider';
import { group } from './fakeData';

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
          <ComponentsKitProvider>
            <PortalProvider>{children}</PortalProvider>
          </ComponentsKitProvider>
        </SafeAreaProvider>
      </StoreProvider>
    </TamaguiProvider>
  );
};
