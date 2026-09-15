import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { Platform } from 'react-native';
import { useTheme } from 'tamagui';

import SettingsScreen from '../features/settings/SettingsScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { useHomeGroupTab } from '../hooks/useHomeGroupTab';
import { HomeGroupNavigator } from './HomeGroupNavigator';
import { TOP_LEVEL_TABS, trackTopLevelTabSelection } from './topLevelTabs';
import type { TopLevelTabParamList } from './types';

const Tabs = createNativeBottomTabNavigator<TopLevelTabParamList>();

type TabIconName = 'home' | 'workspaces' | 'settings';

const tabIcons = {
  home: {
    regular: require('./assets/tab-home.png'),
    selected: require('./assets/tab-home-filled.png'),
  },
  workspaces: {
    regular: require('./assets/tab-messages.png'),
    selected: require('./assets/tab-messages-filled.png'),
  },
  settings: {
    regular: require('./assets/tab-settings.png'),
    selected: require('./assets/tab-settings.png'),
  },
} as const;

function tabIcon(name: TabIconName, focused: boolean) {
  return {
    type: 'image' as const,
    source: focused ? tabIcons[name].selected : tabIcons[name].regular,
  };
}

export function TopLevelTabNavigator() {
  const theme = useTheme();
  const homeGroup = useHomeGroupTab();

  return (
    <Tabs.Navigator
      initialRouteName={homeGroup.enabled ? 'HomeGroup' : 'ChatList'}
      backBehavior="history"
      screenListeners={({ navigation, route }) => ({
        tabPress: () => {
          // Match the web nav bar: track selections, not re-presses of the
          // active tab.
          if (!navigation.isFocused()) {
            trackTopLevelTabSelection(route.name);
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryText?.val,
        tabBarInactiveTintColor: theme.secondaryText?.val,
        tabBarActiveIndicatorColor: theme.secondaryBackground?.val,
        tabBarLabelVisibilityMode: 'unlabeled',
        tabBarLabel: Platform.OS === 'ios' ? '' : undefined,
        tabBarControllerMode: Platform.OS === 'ios' ? 'tabBar' : undefined,
        tabBarMinimizeBehavior:
          Platform.OS === 'ios' ? 'onScrollDown' : undefined,
      }}
    >
      {homeGroup.enabled ? (
        <Tabs.Screen
          name="HomeGroup"
          component={HomeGroupNavigator}
          options={{
            title: TOP_LEVEL_TABS.HomeGroup.title,
            tabBarIcon: ({ focused }) => tabIcon('home', focused),
          }}
        />
      ) : null}
      <Tabs.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: TOP_LEVEL_TABS.ChatList.title,
          tabBarIcon: ({ focused }) => tabIcon('workspaces', focused),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: TOP_LEVEL_TABS.Settings.title,
          tabBarIcon: ({ focused }) => tabIcon('settings', focused),
        }}
      />
    </Tabs.Navigator>
  );
}
