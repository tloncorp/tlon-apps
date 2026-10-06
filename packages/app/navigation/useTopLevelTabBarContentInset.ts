import { NavigationContext } from '@react-navigation/native';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { supportsLiquidGlass } from '../ui/components/GlassSurface';
import { supportsNativeScrollEdgeChrome } from './nativeHeaderOptions';
import { getTopLevelTabBarClearance } from './topLevelTabBarClearance';

/**
 * Height of the band the top-level tab bar occludes, measured up from the
 * screen's bottom edge. Zero off the tab screens.
 *
 * Use this to place floating chrome — anything positioned against the screen
 * edge that the bar would otherwise cover. Content laid out in normal flow
 * wants `useTopLevelTabBarContentInset` instead.
 */
export function useTopLevelTabBarClearance() {
  const { bottom } = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);

  if (navigation?.getState().type !== 'tab') {
    return 0;
  }

  return getTopLevelTabBarClearance({
    platform: Platform.OS,
    floatingTabBar: supportsNativeScrollEdgeChrome(
      Platform.OS,
      Platform.Version,
      supportsLiquidGlass()
    ),
    bottomInset: bottom,
  });
}

/**
 * Bottom inset for content that the top-level tab bar would otherwise cover.
 *
 * The native tab bar floats over screen content, so only screens hosted by the
 * tab navigator need to reserve room for it; anything pushed onto the root
 * stack renders above the bar and gets ordinary content spacing instead.
 */
export function useTopLevelTabBarContentInset() {
  const clearance = useTopLevelTabBarClearance();
  const contentSpacing = getTokenValue('$l', 'space');

  return clearance === 0 ? contentSpacing : clearance + contentSpacing;
}
