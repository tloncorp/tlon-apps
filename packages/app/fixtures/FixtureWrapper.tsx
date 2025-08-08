// tamagui-ignore
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import { internalConfigureClient } from '@tloncorp/shared/api';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSettingsNavigation } from '../hooks/useChatSettingsNavigation';
import type { ColorProp } from '../ui';
import {
  AppDataContextProvider,
  ChatOptionsProvider,
  StoreProvider,
  Theme,
  ToastProvider,
  View,
} from '../ui';
import { initialContacts } from './fakeData';
import * as baseStore from '@tloncorp/shared/store';

// Create a fixture-specific store mock that returns proper React Query objects
function createFixtureStore() {
  return new Proxy(baseStore, {
    get: (target, prop) => {
      const propName = prop.toString();
      
      // Handle React Query hooks that should return query result objects
      if (propName.startsWith('use') && !['usePostDraftCallbacks'].includes(propName)) {
        return () => ({
          data: undefined,
          isLoading: false,
          error: null,
          isSuccess: false,
          isError: false,
          refetch: () => Promise.resolve(),
          queryKey: [],
          enabled: true,
        });
      }
      
      // For non-hook functions, return no-op functions
      return () => {};
    },
  });
}

type FixtureWrapperProps = PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  backgroundColor?: ColorProp;
  innerBackgroundColor?: ColorProp;
  safeArea?: boolean;
}>;

function MockedUrbitClientProvider({ children }: PropsWithChildren<object>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    internalConfigureClient({
      shipName: 'zod',
      shipUrl: 'whitehouse.com',
    });
    setReady(true);
  }, []);

  return <>{ready ? children : null}</>;
}

export const FixtureWrapper = (props: FixtureWrapperProps) => {
  return (
    <ToastProvider>
      <NavigationContainer>
        <MockedUrbitClientProvider>
          <InnerWrapper {...props} />
        </MockedUrbitClientProvider>
      </NavigationContainer>
    </ToastProvider>
  );
};

FixtureWrapper.displayName = 'FixtureWrapper';

const InnerWrapper = ({
  fillWidth,
  fillHeight,
  verticalAlign,
  horizontalAlign,
  backgroundColor,
  innerBackgroundColor,
  safeArea,
  children,
}: FixtureWrapperProps) => {
  const insets = useSafeAreaInsets();

  const [theme] = useFixtureSelect('themeName', {
    options: ['light', 'dark'],
  });

  const fixtureStore = useMemo(() => createFixtureStore(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StoreProvider stub={fixtureStore}>
          <AppDataContextProvider
            currentUserId="~zod"
            contacts={[...initialContacts]}
            branchDomain="test"
            branchKey="test"
            calmSettings={{
              disableRemoteContent: false,
              disableAvatars: false,
              disableNicknames: false,
            }}
          >
            <ChatOptionsProvider {...useChatSettingsNavigation()}>
              <Theme name={theme}>
                <View
                  flex={1}
                  paddingBottom={safeArea ? insets.bottom : 0}
                  paddingTop={safeArea ? insets.top : 0}
                >
                  <View
                    backgroundColor={backgroundColor ?? '$secondaryBackground'}
                    flex={1}
                    flexDirection="column"
                    width={fillWidth ? '100%' : 'unset'}
                    height={fillHeight ? '100%' : 'unset'}
                    justifyContent={
                      verticalAlign === 'top'
                        ? 'flex-start'
                        : verticalAlign === 'bottom'
                          ? 'flex-end'
                          : 'center'
                    }
                    alignItems={
                      horizontalAlign === 'left'
                        ? 'flex-start'
                        : horizontalAlign === 'right'
                          ? 'flex-end'
                          : 'center'
                    }
                  >
                    <View
                      backgroundColor={innerBackgroundColor ?? '$background'}
                      width={fillWidth ? '100%' : 'unset'}
                      height={fillHeight ? '100%' : 'unset'}
                    >
                      {children}
                    </View>
                  </View>
                </View>
              </Theme>
            </ChatOptionsProvider>
          </AppDataContextProvider>
        </StoreProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
};
