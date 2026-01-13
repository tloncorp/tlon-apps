import { group } from '@tloncorp/app/fixtures/fakeData';
import {
  StoreProvider,
  TamaguiProvider,
  config,
  createNoOpStore,
} from '@tloncorp/app/ui';
import { spyOn } from '@tloncorp/shared';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </StoreProvider>
    </TamaguiProvider>
  );
};
