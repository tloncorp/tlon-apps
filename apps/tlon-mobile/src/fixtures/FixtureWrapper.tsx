import { View } from '@tloncorp/ui';
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
}: PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  innerBackgroundColor?: string;
}>) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        //@ts-expect-error chill
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
          //@ts-expect-error chill
          backgroundColor={innerBackgroundColor ?? '$background'}
          width={fillWidth ? '100%' : 'unset'}
          height={fillHeight ? '100%' : 'unset'}
        >
          {children}
        </View>
      </View>
    </GestureHandlerRootView>
  );
};
