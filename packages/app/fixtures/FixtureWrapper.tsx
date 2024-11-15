// tamagui-ignore
import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import type { ColorProp } from '@tloncorp/ui';
import { AppDataContextProvider, Theme, View } from '@tloncorp/ui';
import type { PropsWithChildren } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initialContacts } from './fakeData';

export const FixtureWrapper = ({
  fillWidth,
  fillHeight,
  verticalAlign,
  horizontalAlign,
  children,
  backgroundColor,
  innerBackgroundColor,
  safeArea,
}: PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  backgroundColor?: ColorProp;
  innerBackgroundColor?: ColorProp;
  safeArea?: boolean;
}>) => {
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
        </AppDataContextProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
};

FixtureWrapper.displayName = 'FixtureWrapper';
