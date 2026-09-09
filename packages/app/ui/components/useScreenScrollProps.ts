import { NavigationContext } from '@react-navigation/native';
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
    enabled && Platform.OS === 'ios',
    nativeHeaderScrollResetOptions
  );

  return {
    contentInsetAdjustmentBehavior:
      enabled && Platform.OS === 'ios' ? 'automatic' : undefined,
  };
}
