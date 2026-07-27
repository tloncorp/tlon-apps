import { NavigationContext } from '@react-navigation/native';
import { type ReactNode, useContext, useLayoutEffect } from 'react';
import { Platform, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SizeTokens } from 'tamagui';
import { ScrollView } from 'tamagui';

import { getNativeHeaderUnderlayOptions } from '../../navigation/nativeHeaderOptions';
import { useActiveTheme } from '../../provider';
import { getNativeColorScheme } from '../utils/themeUtils';

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
}: SettingsContentScrollViewProps) {
  const insets = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);
  const activeTheme = useActiveTheme();
  const bottomPadding =
    safeAreaBottomOffset == null
      ? paddingBottom
      : insets.bottom + safeAreaBottomOffset;

  useLayoutEffect(() => {
    if (Platform.OS !== 'ios' || !navigation) {
      return;
    }

    navigation.setOptions(
      getNativeHeaderUnderlayOptions({
        isDarkMode: getNativeColorScheme(activeTheme) === 'dark',
      })
    );

    return () => {
      if (navigation.isFocused()) {
        navigation.setOptions({
          headerTransparent: false,
          headerBlurEffect: undefined,
          scrollEdgeEffects: undefined,
        });
      }
    };
  }, [activeTheme, navigation]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior={
        contentInsetAdjustmentBehavior ??
        (Platform.OS === 'ios' ? 'automatic' : undefined)
      }
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
