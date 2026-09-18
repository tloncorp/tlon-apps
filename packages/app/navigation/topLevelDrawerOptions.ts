import type { DrawerNavigationOptions } from '@react-navigation/drawer';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from 'tamagui';

// Wide enough for a section label at a comfortable reading size, narrow enough
// to leave a strip of the app visible beside it.
const MAX_DRAWER_WIDTH = 320;
const DRAWER_WIDTH_FRACTION = 0.82;
// A wider edge than the default 32, so the swipe is findable without a hunt,
// but short of the iOS interactive-pop gesture's own reach.
const DRAWER_SWIPE_EDGE_WIDTH = 44;

/**
 * Whether the edge swipe should open the drawer, given the stack's state.
 *
 * Only at the stack's root. Deeper than that the same edge belongs to the
 * back gesture — iOS's interactive pop, Android's system back — and a drawer
 * that also claimed it would leave which one you get down to gesture
 * arbitration.
 */
export function isTopLevelDrawerSwipeTarget(route: object | undefined) {
  // A route carries its child navigator's state at runtime, but `RouteProp`
  // does not declare it. Index 0 is the stack sitting on `MainTabs` with
  // nothing pushed above it; an absent state is a stack that has not built
  // itself yet, which is the same position.
  const stackState = (route as { state?: { index?: number } } | undefined)
    ?.state;
  return (stackState?.index ?? 0) === 0;
}

export function getTopLevelDrawerWidth(windowWidth: number) {
  return Math.min(
    MAX_DRAWER_WIDTH,
    Math.round(windowWidth * DRAWER_WIDTH_FRACTION)
  );
}

/**
 * Presentation for the top-level drawer.
 *
 * `slide` moves the app across as the panel comes in rather than covering it,
 * so the navigation bar travels with the screen it belongs to and none of the
 * app is left drawn on top of the panel. Nothing dims for the same reason —
 * the app is beside the drawer, not behind it — but the overlay stays there,
 * transparent, to catch the tap that closes it.
 */
export function useTopLevelDrawerScreenOptions(): DrawerNavigationOptions {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const background = theme.background?.val;
  const drawerWidth = getTopLevelDrawerWidth(width);

  return useMemo(
    () => ({
      headerShown: false,
      drawerType: 'slide',
      overlayColor: 'transparent',
      swipeEdgeWidth: DRAWER_SWIPE_EDGE_WIDTH,
      drawerStyle: {
        width: drawerWidth,
        backgroundColor: background,
      },
    }),
    [background, drawerWidth]
  );
}
