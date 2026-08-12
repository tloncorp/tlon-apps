import { NavigationContext } from '@react-navigation/native';
import { useContext, useMemo } from 'react';
import { Platform, type ScrollViewProps } from 'react-native';

import { useIsDarkMode } from '../../hooks/useDarkMode';
import {
  getNativeHeaderScrollOptions,
  nativeHeaderScrollResetOptions,
} from '../../navigation/nativeHeaderOptions';
import { useInstalledNavigationOptions } from '../../navigation/useInstalledNavigationOptions';

type ScreenScrollProps = Pick<
  ScrollViewProps,
  'contentInsetAdjustmentBehavior'
>;

interface UseScreenScrollPropsOptions {
  enabled?: boolean;
}

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
    enabled && Platform.OS === 'ios',
    nativeHeaderScrollResetOptions
  );

  return {
    contentInsetAdjustmentBehavior:
      enabled && Platform.OS === 'ios' ? 'automatic' : undefined,
  };
}
