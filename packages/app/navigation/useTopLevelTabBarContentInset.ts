import { NavigationContext } from '@react-navigation/native';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

// iOS 26 draws the tab bar as a floating pill (~60pt) inset from the bottom
// edge, so the band it occludes subsumes the home indicator rather than
// stacking on top of it. Android's bar sits directly above the safe area.
const IOS_TAB_BAR_CLEARANCE = 84;
const ANDROID_TAB_BAR_HEIGHT = 80;

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

  switch (Platform.OS) {
    case 'ios':
      return IOS_TAB_BAR_CLEARANCE;
    case 'android':
      return ANDROID_TAB_BAR_HEIGHT + bottom;
    default:
      return 0;
  }
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
