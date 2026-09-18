import {
  createDrawerNavigator,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { View } from 'tamagui';

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
 * The root stack, and — while the drawer is open — the app held out of focus
 * behind it.
 *
 * `slide` moves the app aside rather than covering it, so a strip of it stays
 * on screen with nothing between it and the panel to say which one is being
 * read. This blurs that strip, travelling with the app because it sits inside
 * the screen the drawer is sliding. It takes no touches: the drawer's own
 * overlay is above this and still catches the tap that closes it.
 *
 * Deliberately not the shared `Overlay`, which washes what it covers in a
 * light or dark tint to push a modal forward. Nothing here is modal — the app
 * is beside the drawer, not behind it — so the blur alone carries the focus,
 * and the thinnest system material is the one that adds least colour of its
 * own.
 */
function DrawerHostedStack() {
  const drawerOpen = useDrawerStatus() === 'open';

  return (
    <View flex={1}>
      <RootStack />
      {drawerOpen ? (
        <BlurView
          intensity={24}
          tint="systemUltraThinMaterial"
          // Android renders a semi-transparent view rather than a blur unless
          // a method is named. The SDK 31+ one falls back to exactly that on
          // older versions, where the library's own blur costs more than it is
          // worth.
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

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
      <Drawer.Screen name="Main" component={DrawerHostedStack} />
    </Drawer.Navigator>
  );
}
