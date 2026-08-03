import { type ReactNode } from 'react';
import { type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SizeTokens } from 'tamagui';

import { ScreenScrollView } from './ScreenScrollView';

type SpacingValue = number | SizeTokens;

interface SettingsContentScrollViewProps {
  children: ReactNode;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  gap?: SpacingValue;
  maxWidth?: number;
  paddingBottom?: SpacingValue;
  paddingHorizontal?: SpacingValue;
  paddingTop?: SpacingValue;
  safeAreaBottomOffset?: number;
  useScreenChrome?: boolean;
}

export function SettingsContentScrollView({
  children,
  contentInsetAdjustmentBehavior,
  gap,
  maxWidth = 600,
  paddingBottom,
  paddingHorizontal,
  paddingTop,
  safeAreaBottomOffset,
  useScreenChrome = false,
}: SettingsContentScrollViewProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding =
    safeAreaBottomOffset == null
      ? paddingBottom
      : insets.bottom + safeAreaBottomOffset;

  return (
    <ScreenScrollView
      useScreenChrome={useScreenChrome}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
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
    </ScreenScrollView>
  );
}
