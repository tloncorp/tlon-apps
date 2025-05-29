// tamagui-ignore
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import type { PropsWithChildren } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSettingsNavigation } from '../hooks/useChatSettingsNavigation';
import type { ColorProp } from '../ui';
import {
  AppDataContextProvider,
  ChatOptionsProvider,
  Theme,
  ToastProvider,
  View,
} from '../ui';
import { initialContacts } from './fakeData';

type FixtureWrapperProps = PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  backgroundColor?: ColorProp;
  innerBackgroundColor?: ColorProp;
  safeArea?: boolean;
}>;

export const FixtureWrapper = (props: FixtureWrapperProps) => {
  return (
    <ToastProvider>
      <NavigationContainer>
        <InnerWrapper {...props} />
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

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
};
