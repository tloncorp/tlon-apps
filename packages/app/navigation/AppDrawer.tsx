import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import { useNavigationState } from '@react-navigation/native';
import { useEffect } from 'react';

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
 * The root stack, plus the one option that has to follow what is showing
 * inside it.
 *
 * `swipeEnabled` cannot come from the navigator's `screenOptions`: the route
 * handed to those is the drawer's own `Main` route, and its `state` is never
 * populated — reading the stack's position off it silently yielded "at the
 * root" wherever the user actually was, which left the edge claimed by both
 * gestures at once and which of them answered a swipe down to arbitration.
 * The drawer's *state* does carry the stack, as the panel's own marking of the
 * chat it is standing in relies on, so the option is set from in here where
 * that state can be subscribed to.
 */
function DrawerMainScreen({
  navigation,
}: DrawerScreenProps<AppDrawerParamList, 'Main'>) {
  // Selecting any other section would carry the user out of the locked
  // onboarding conversation, so the gesture that opens the drawer is off for
  // as long as the lock holds, and its rows are disabled to match.
  const onboardingLock = useAnyAgentGroupOnboardingLock();
  const stackState = useNavigationState(
    (state) =>
      state.routes[state.index]?.state as
        | { index?: number; routes?: ReadonlyArray<object> }
        | undefined
  );
  const swipeEnabled =
    !onboardingLock.locked && isTopLevelDrawerSwipeTarget(stackState);

  useEffect(() => {
    navigation.setOptions({ swipeEnabled });
  }, [navigation, swipeEnabled]);

  return <RootStack />;
}

/**
 * The mobile tree's outermost navigator. The whole root stack is its one
 * screen, so opening the drawer insets the app — native navigation bar and
 * all — instead of drawing over it. A drawer nested any deeper could only
 * cover the screens below that bar, since the bar belongs to the stack.
 */
export function AppDrawer() {
  const screenOptions = useTopLevelDrawerScreenOptions();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <TopLevelDrawerContent {...props} />}
      screenOptions={screenOptions}
    >
      <Drawer.Screen name="Main" component={DrawerMainScreen} />
    </Drawer.Navigator>
  );
}
