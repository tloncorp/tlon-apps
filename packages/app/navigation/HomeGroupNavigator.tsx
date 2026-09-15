import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChannelScreen from '../features/top/ChannelScreen';
import { useHomeGroupTab } from '../hooks/useHomeGroupTab';
import type { HomeGroupStackParamList } from './types';

const HomeGroupStack = createNativeStackNavigator<HomeGroupStackParamList>();

/**
 * The home-group tab renders the user's bot chat directly. It gets its own
 * stack so ChannelScreen has the stack navigation object it expects
 * (`push`/`setParams`); everything the channel opens that isn't registered
 * here — Post, MediaViewer, GroupSettings — falls through to the root stack.
 */
export function HomeGroupNavigator() {
  const homeGroup = useHomeGroupTab();

  if (!homeGroup.enabled) {
    return null;
  }

  return (
    <HomeGroupStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeGroupStack.Screen
        // `initialParams` is only read on mount, so a different home group
        // (e.g. after a re-login) has to remount rather than reuse the screen.
        key={homeGroup.channelId}
        name="HomeGroupChannel"
        component={ChannelScreen}
        initialParams={{
          channelId: homeGroup.channelId,
          groupId: homeGroup.groupId,
        }}
      />
    </HomeGroupStack.Navigator>
  );
}
