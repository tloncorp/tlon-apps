import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text, UrbitSigil, View, ZStack, useStyle } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import type { ViewStyle } from 'react-native';

import { SingletonWebview } from '../components/SingletonWebview';
import { useShip } from '../contexts/ship';
import {
  WebviewPositionProvider,
  useWebviewPositionContext,
} from '../contexts/webview/position';
import { WebviewProvider } from '../contexts/webview/webview';
import { getInitialPath } from '../lib/WebAppHelpers';
import type { TabParamList } from '../types';
import { HomeStack } from './HomeStack';
import { WebViewStack } from './WebViewStack';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabStack = () => {
  const headerStyle = useStyle({
    paddingHorizontal: '$xl',
  }) as ViewStyle;
  const { ship } = useShip();
  const shipIsPlanetOrLarger = ship && ship.length <= 14;
  return (
    <WebviewPositionProvider>
      <WebviewProvider>
        <ZStack flex={1}>
          <Tab.Navigator
            id="TabBar"
            initialRouteName="Groups"
            screenOptions={{
              headerShown: false,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              headerTitle({ style, ...props }) {
                return (
                  <Text
                    fontSize="$m"
                    fontWeight="$s"
                    lineHeight="$s"
                    {...props}
                  />
                );
              },
              headerLeftContainerStyle: headerStyle,
              headerRightContainerStyle: headerStyle,
              tabBarShowLabel: false,
            }}
          >
            <Tab.Screen
              name="Groups"
              component={HomeStack}
              initialParams={{ initialPath: '/' }}
              options={{
                headerShown: true,
                tabBarIcon: ({ focused }) => (
                  <TabIcon
                    type={'Home'}
                    activeType={'HomeFilled'}
                    isActive={focused}
                  />
                ),
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
                tabBarIcon: ({ focused }) =>
                  ship && shipIsPlanetOrLarger ? (
                    <UrbitSigil ship={ship} />
                  ) : (
                    <TabIcon
                      type={'Profile'}
                      activeType={'Profile'}
                      isActive={focused}
                    />
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
};

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
