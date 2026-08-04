import { NavigationContext } from '@react-navigation/native';
import { useContext, useMemo } from 'react';
import { Platform } from 'react-native';

import { useIsDarkMode } from '../../hooks/useDarkMode';
import {
  getNativeHeaderScrollOptions,
  nativeHeaderScrollResetOptions,
} from '../../navigation/nativeHeaderOptions';
import { useInstalledNavigationOptions } from '../../navigation/useInstalledNavigationOptions';
import type {
  ScreenScrollProps,
  UseScreenScrollPropsOptions,
} from './useScreenScrollProps.types';

export function useScreenScrollProps({
  enabled = true,
}: UseScreenScrollPropsOptions = {}): ScreenScrollProps {
  const navigation = useContext(NavigationContext);
  const isDarkMode = useIsDarkMode();
  const options = useMemo(
    () =>
      getNativeHeaderScrollOptions({
        isDarkMode,
        platform: Platform.OS,
        platformVersion: Platform.Version,
      }),
    [isDarkMode]
  );

  useInstalledNavigationOptions(
    navigation,
    options,
    nativeHeaderScrollResetOptions,
    enabled && Platform.OS === 'ios'
  );

  return {
    contentInsetAdjustmentBehavior:
      enabled && Platform.OS === 'ios' ? 'automatic' : undefined,
  };
}
