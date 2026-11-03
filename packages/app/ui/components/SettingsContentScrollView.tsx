import { type ComponentProps, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SizeTokens } from 'tamagui';

import { ScreenScrollView } from './ScreenScrollView';

type SpacingValue = number | SizeTokens;

interface SettingsContentScrollViewProps {
  children: ReactNode;
  gap?: SpacingValue;
  maxWidth?: number;
  paddingBottom?: SpacingValue;
  paddingHorizontal?: SpacingValue;
  paddingTop?: SpacingValue;
  safeAreaBottomOffset?: number;
  style?: ComponentProps<typeof ScreenScrollView>['style'];
  keyboardShouldPersistTaps?: ComponentProps<
    typeof ScreenScrollView
  >['keyboardShouldPersistTaps'];
}

export function SettingsContentScrollView({
  children,
  gap,
  maxWidth = 600,
  paddingBottom,
  paddingHorizontal,
  paddingTop,
  safeAreaBottomOffset,
  style,
  keyboardShouldPersistTaps,
}: SettingsContentScrollViewProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding =
    safeAreaBottomOffset == null
      ? paddingBottom
      : insets.bottom + safeAreaBottomOffset;

  return (
    <ScreenScrollView
      style={[{ flex: 1, width: '100%' }, style]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
    </ScreenScrollView>
  );
}
