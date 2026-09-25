import { NavigationContext } from '@react-navigation/native';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useContext, useMemo } from 'react';
import { Platform, type ScrollViewProps } from 'react-native';

import {
  getNativeHeaderScrollOptions,
  nativeHeaderScrollResetOptions,
} from '../../navigation/nativeHeaderOptions';
import { useInstalledNavigationOptions } from '../../navigation/useInstalledNavigationOptions';
import { supportsLiquidGlass } from './GlassSurface';

type ScreenScrollProps = Pick<
  ScrollViewProps,
  'contentInsetAdjustmentBehavior'
>;

interface UseScreenScrollPropsOptions {
  enabled?: boolean;
  bottomEdgeEffect?: 'hidden' | 'soft';
}

export function useScreenScrollProps({
  enabled = true,
  bottomEdgeEffect = 'hidden',
}: UseScreenScrollPropsOptions = {}): ScreenScrollProps {
  const navigation = useContext(NavigationContext);
  // The split layout's navigators show no native headers.
  const isWindowNarrow = useIsWindowNarrow();
  const installsNativeOptions =
    enabled && Platform.OS === 'ios' && isWindowNarrow;
  const options = useMemo(
    () =>
      getNativeHeaderScrollOptions({
        platform: Platform.OS,
        platformVersion: Platform.Version,
        liquidGlassAvailable: supportsLiquidGlass(),
        bottomEdgeEffect,
      }),
    [bottomEdgeEffect]
  );

  useInstalledNavigationOptions(
    navigation,
    options,
    installsNativeOptions,
    nativeHeaderScrollResetOptions
  );

  return {
    contentInsetAdjustmentBehavior: installsNativeOptions
      ? 'automatic'
      : undefined,
  };
}
