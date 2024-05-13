import type { ColorProp } from '@tloncorp/ui';
import { Theme, View } from '@tloncorp/ui';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export const FixtureWrapper = ({
  fillWidth,
  fillHeight,
  verticalAlign,
  horizontalAlign,
  children,
  backgroundColor,
  innerBackgroundColor,
  theme = 'light',
}: PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  backgroundColor?: ColorProp;
  innerBackgroundColor?: ColorProp;
  theme?: 'light' | 'dark';
}>) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Theme name={theme}>
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
      </Theme>
    </GestureHandlerRootView>
  );
};
