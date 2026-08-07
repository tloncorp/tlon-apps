import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SizeTokens } from 'tamagui';
import { ScrollView } from 'tamagui';

type SpacingValue = number | SizeTokens;

interface SettingsContentScrollViewProps {
  children: ReactNode;
  gap?: SpacingValue;
  maxWidth?: number;
  paddingBottom?: SpacingValue;
  paddingHorizontal?: SpacingValue;
  paddingTop?: SpacingValue;
  safeAreaBottomOffset?: number;
}

export function SettingsContentScrollView({
  children,
  gap,
  maxWidth = 600,
  paddingBottom,
  paddingHorizontal,
  paddingTop,
  safeAreaBottomOffset,
}: SettingsContentScrollViewProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding =
    safeAreaBottomOffset == null
      ? paddingBottom
      : insets.bottom + safeAreaBottomOffset;

  return (
    <ScrollView
      style={{
        flex: 1,
        width: '100%',
      }}
      contentContainerStyle={{
        alignSelf: 'center',
        gap,
        maxWidth,
        paddingBottom: bottomPadding,
        paddingHorizontal,
        paddingTop,
        width: '100%',
      }}
    >
      {children}
    </ScrollView>
  );
}
