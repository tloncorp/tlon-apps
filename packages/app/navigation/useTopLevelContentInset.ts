import { NavigationContext } from '@react-navigation/native';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

/**
 * Bottom inset for content on one of the top-level sections.
 *
 * Nothing is pinned across the bottom of the window any more, so these screens
 * run to its edge and have to reserve the safe area themselves. Anything
 * pushed onto the root stack renders above them and gets ordinary content
 * spacing instead.
 */
export function useTopLevelContentInset() {
  const { bottom } = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);
  const contentSpacing = getTokenValue('$l', 'space');

  return navigation?.getState().type === 'tab'
    ? bottom + contentSpacing
    : contentSpacing;
}

/**
 * The same, for a section whose content scrolls through `ScreenScrollView`.
 *
 * On iOS that restores UIKit's automatic safe-area adjustment, which reserves
 * the band itself — reserving it again here leaves a second one's worth of
 * dead space under the last row. Everywhere else the scroll view does nothing
 * of the kind, and on Android's edge-to-edge layout the band it would leave
 * uncovered is the system navigation area.
 */
export function useTopLevelScrollViewContentInset() {
  const inset = useTopLevelContentInset();
  const contentSpacing = getTokenValue('$l', 'space');

  return Platform.OS === 'ios' ? contentSpacing : inset;
}
