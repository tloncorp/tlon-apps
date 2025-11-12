import { group } from '@tloncorp/app/fixtures/fakeData';
import { StoreProvider, TamaguiProvider, config } from '@tloncorp/app/ui';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function spyOn<T extends object, MethodName extends keyof T>(
  base: T,
  method: MethodName,
  fn: T[MethodName]
) {
  return new Proxy(base, {
    get(target, prop) {
      if (prop === method) {
        return fn;
      }
      return target[prop as keyof T];
    },
  });
}

// eslint-disable-next-line
export default ({ children }: { children: React.ReactNode }) => {
  const store = useMemo(() => {
    const mockUseGroup = () => ({
      data: group,
      isLoading: false,
      error: null,
    });

    // @ts-expect-error - fixture mock
    return spyOn(baseStore, 'useGroup', mockUseGroup);
  }, []);

  return (
    <TamaguiProvider defaultTheme={'light'} config={config}>
      <StoreProvider stub={store}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </StoreProvider>
    </TamaguiProvider>
  );
};
