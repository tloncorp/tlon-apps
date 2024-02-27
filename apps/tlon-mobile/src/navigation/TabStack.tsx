import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import { View, ZStack } from 'tamagui';

import { SingletonWebview } from '../components/SingletonWebview';
import {
  WebviewPositionProvider,
  useWebviewPositionContext,
} from '../contexts/webview/position';
import { WebviewProvider } from '../contexts/webview/webview';
import { getInitialPath } from '../lib/WebAppHelpers';
import type { TabParamList } from '../types';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => (
  <WebviewPositionProvider>
    <WebviewProvider>
      <ZStack flex={1}>
        <Tab.Navigator
          id="TabBar"
          initialRouteName="Groups"
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen
            name="Groups"
            component={WebViewStack}
            initialParams={{ initialPath: getInitialPath('Groups') }}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  type={'Home'}
                  activeType={'HomeFilled'}
                  isActive={focused}
                />
              ),
              tabBarShowLabel: false,
            }}
          />
          <Tab.Screen
            name="Messages"
            component={WebViewStack}
            initialParams={{ initialPath: getInitialPath('Messages') }}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  type={'Messages'}
                  activeType={'MessagesFilled'}
                  isActive={focused}
                />
              ),
              tabBarShowLabel: false,
            }}
          />
          <Tab.Screen
            name="Activity"
            component={WebViewStack}
            initialParams={{ initialPath: getInitialPath('Activity') }}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  type={'Notifications'}
                  activeType={'NotificationsFilled'}
                  isActive={focused}
                />
              ),
              tabBarShowLabel: false,
            }}
          />
          <Tab.Screen
            name="Profile"
            component={WebViewStack}
            initialParams={{ initialPath: getInitialPath('Profile') }}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon type="Profile" isActive={focused} />
              ),
              tabBarShowLabel: false,
            }}
          />
        </Tab.Navigator>

        <WebviewOverlay />
      </ZStack>
    </WebviewProvider>
  </WebviewPositionProvider>
);

function TabIcon({
  type,
  activeType,
  isActive,
}: {
  type: IconType;
  activeType?: IconType;
  isActive: boolean;
}) {
  const resolvedType = isActive && activeType ? activeType : type;
  return (
    <Icon
      type={resolvedType}
      color={isActive ? '$primaryText' : '$activeBorder'}
    />
  );
}

function WebviewOverlay() {
  const { position, visible } = useWebviewPositionContext();
  return (
    <View
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: position.width,
        height: position.height,
        opacity: !visible ? 0 : undefined,
        pointerEvents: !visible ? 'none' : undefined,
      }}
    >
      <SingletonWebview />
    </View>
  );
}
