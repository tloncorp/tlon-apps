import { createDrawerNavigator } from '@react-navigation/drawer';

import { useAnyAgentGroupOnboardingLock } from '../hooks/useAgentGroupOnboardingLock';
import { RootStack } from './RootStack';
import { TopLevelDrawerContent } from './TopLevelDrawerContent';
import {
  isTopLevelDrawerSwipeTarget,
  useTopLevelDrawerScreenOptions,
} from './topLevelDrawerOptions';
import type { AppDrawerParamList } from './types';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

/**
 * The mobile tree's outermost navigator. The whole root stack is its one
 * screen, so opening the drawer insets the app — native navigation bar and
 * all — instead of drawing over it. A drawer nested any deeper could only
 * cover the screens below that bar, since the bar belongs to the stack.
 */
export function AppDrawer() {
  // Selecting any other section would carry the user out of the locked
  // onboarding conversation, so the gesture that opens the drawer is off for
  // as long as the lock holds, and its rows are disabled to match.
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  const screenOptions = useTopLevelDrawerScreenOptions();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <TopLevelDrawerContent {...props} />}
      screenOptions={({ route }) => ({
        ...screenOptions,
        swipeEnabled:
          !onboardingLock.locked && isTopLevelDrawerSwipeTarget(route),
      })}
    >
      <Drawer.Screen name="Main" component={RootStack} />
    </Drawer.Navigator>
  );
}
