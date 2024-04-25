import { View } from '@tloncorp/ui';
import type { PropsWithChildren } from 'react';

export const FixtureWrapper = ({
  fillWidth,
  fillHeight,
  children,
  backgroundColor,
  innerBackgroundColor,
}: PropsWithChildren<{
  fillWidth?: boolean;
  fillHeight?: boolean;
  backgroundColor?: string;
  innerBackgroundColor?: string;
}>) => {
  return (
    <View
      //@ts-expect-error chill
      backgroundColor={backgroundColor ?? '$secondaryBackground'}
      flex={1}
      flexDirection="column"
      alignItems={fillWidth ? 'stretch' : 'center'}
      justifyContent={fillHeight ? 'unset' : 'center'}
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
  );
};
