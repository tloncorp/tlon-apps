import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ColorTokens, View } from 'tamagui';

/**
 * Keeps its content out of the left and right safe-area insets, where iOS
 * places side chrome such as the iPhone Duo status cluster and side tab bar.
 * Screens rendered through a navigator get this from `sideInsetScreenLayout`.
 */
export function SideInsetView({
  children,
  backgroundColor,
}: {
  children: ReactNode;
  backgroundColor?: ColorTokens;
}) {
  const { left, right } = useSafeAreaInsets();
  return (
    <View
      flex={1}
      paddingLeft={left}
      paddingRight={right}
      backgroundColor={backgroundColor}
    >
      {children}
    </View>
  );
}

/** Navigator `screenLayout` that wraps every screen in `SideInsetView`. */
export function sideInsetScreenLayout({ children }: { children: ReactNode }) {
  return <SideInsetView>{children}</SideInsetView>;
}
