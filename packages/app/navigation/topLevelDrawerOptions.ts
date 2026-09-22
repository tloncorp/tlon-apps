import type { DrawerNavigationOptions } from '@react-navigation/drawer';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTheme } from 'tamagui';

import { drawerOwnsEdge } from './drawerDestination';

// The panel is the app's navigation, and its rows now carry a caret, a glyph
// and a timestamp around the name — plus a second indent for the channels of
// an unfurled workspace — so it takes as much of the screen as it can while
// still leaving a strip of the app beside it. That strip is what says the app
// is still there and gives the tap that closes the panel somewhere to land, so
// the fraction stops short of the whole width rather than at a round number.
const MAX_DRAWER_WIDTH = 400;
const DRAWER_WIDTH_FRACTION = 0.88;
// A wider edge than the default 32, so the swipe is findable without a hunt,
// but short of the iOS interactive-pop gesture's own reach.
const DRAWER_SWIPE_EDGE_WIDTH = 44;

/**
 * Whether the edge swipe should open the drawer, given the stack's state.
 *
 * At the stack's root, and on a conversation sitting directly on it — see
 * `drawerOwnsEdge`, which is the same question asked of one route. Those
 * screens carry the drawer button instead of a back caret, and the gesture has
 * to agree with the button above it: swiping where the header offers no way
 * back was popping to the section behind, which is a screen the user never
 * chose to return to.
 *
 * Anywhere else the same edge belongs to the back gesture — iOS's interactive
 * pop, Android's system back — and a drawer that also claimed it would leave
 * which one you get down to gesture arbitration. `useDrawerEdgeGesture` turns
 * the pop gesture off on exactly the routes this claims, so only ever one of
 * the two is listening.
 */
export function isTopLevelDrawerSwipeTarget(
  stackState: { index?: number; routes?: ReadonlyArray<object> } | undefined
) {
  // Index 0 is the stack sitting on `MainTabs` with nothing pushed above it;
  // an absent state is a stack that has not built itself yet, which is the
  // same position.
  const index = stackState?.index ?? 0;
  if (index === 0) {
    return true;
  }
  return drawerOwnsEdge(stackState);
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
 * transparent, to catch the tap that closes it. The panel's own right edge is
 * what separates the two.
 */
export function useTopLevelDrawerScreenOptions(): DrawerNavigationOptions {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const background = theme.background?.val;
  const border = theme.border?.val;
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
        // `slide` leaves a strip of the app beside the panel, and both are the
        // same colour. This is the only thing that says where one ends.
        borderRightWidth: 1,
        borderRightColor: border,
      },
    }),
    [background, border, drawerWidth]
  );
}
