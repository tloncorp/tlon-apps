import { NavigationContext } from '@react-navigation/native';
import { useContext, useLayoutEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import {
  getNativeHeaderScrollOptions,
  nativeHeaderScrollResetOptions,
} from '../../navigation/nativeHeaderOptions';
import { useActiveTheme } from '../../provider';
import { getNativeColorScheme } from '../utils/themeUtils';
import type {
  ScreenScrollProps,
  UseScreenScrollPropsOptions,
} from './useScreenScrollProps.types';

export function useScreenScrollProps({
  enabled = true,
}: UseScreenScrollPropsOptions = {}): ScreenScrollProps {
  const navigation = useContext(NavigationContext);
  const activeTheme = useActiveTheme();
  const isDarkMode = getNativeColorScheme(activeTheme) === 'dark';
  const options = useMemo(
    () => getNativeHeaderScrollOptions({ isDarkMode }),
    [isDarkMode]
  );

  useLayoutEffect(() => {
    if (!enabled || Platform.OS !== 'ios' || !navigation) {
      return;
    }

    navigation.setOptions(options);
    return () => {
      if (navigation.isFocused == null || navigation.isFocused()) {
        navigation.setOptions(nativeHeaderScrollResetOptions);
      }
    };
  }, [enabled, navigation, options]);

  return {
    contentInsetAdjustmentBehavior:
      enabled && Platform.OS === 'ios' ? 'automatic' : undefined,
  };
}
