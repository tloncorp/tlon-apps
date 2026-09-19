import { DrawerActions, NavigationContext } from '@react-navigation/native';
import { useContext, useMemo } from 'react';

import type { ScreenHeaderAction } from '../ui/components/ScreenHeader';

/**
 * The header button that opens the top-level drawer, for the top-level
 * sections. Null everywhere else — a screen pushed onto the root stack shows
 * its back button in that slot instead, and the sections are the only tab
 * screens in either tree.
 *
 * `onPushedScreen` is for the exception: a conversation the app enters in its
 * own right has nothing behind it worth a caret, so it claims the slot despite
 * being pushed.
 *
 * The drawer sits above the whole root stack, so the action is dispatched
 * rather than called on a drawer navigation object: it travels up from the
 * screen to the navigator that owns the drawer.
 */
export function useTopLevelDrawerToggleAction({
  onPushedScreen = false,
}: { onPushedScreen?: boolean } = {}): ScreenHeaderAction | null {
  const navigation = useContext(NavigationContext);
  const isTopLevelSection = navigation?.getState().type === 'tab';

  return useMemo(() => {
    if ((!isTopLevelSection && !onPushedScreen) || !navigation) {
      return null;
    }
    return {
      id: 'open-navigation',
      icon: 'LeftSidebar',
      label: 'Open navigation',
      testID: 'TopLevelDrawerToggle',
      onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
    };
  }, [isTopLevelSection, navigation, onPushedScreen]);
}
