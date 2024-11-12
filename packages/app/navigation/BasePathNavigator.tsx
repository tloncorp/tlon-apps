import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import { RootDrawerParamList, RootStackParamList } from './types';

export type MobileBasePathStackParamList = {
  Root: NavigatorScreenParams<RootStackParamList>;
};

export type DesktopBasePathStackParamList = {
  Root: NavigatorScreenParams<RootDrawerParamList>;
};

const MobileBasePathStackNavigator =
  createNativeStackNavigator<MobileBasePathStackParamList>();
const DesktopBasePathStackNavigator =
  createNativeStackNavigator<DesktopBasePathStackParamList>();

/**
 * On web, this is necessary for navigation to work properly when the base URL
 * is something other than `/`, eg `/apps/groups/`
 */
export function BasePathNavigator({ isMobile }: { isMobile: boolean }) {
  const Navigator = isMobile
    ? MobileBasePathStackNavigator
    : DesktopBasePathStackNavigator;

  return (
    <Navigator.Navigator screenOptions={{ headerShown: false }}>
      <Navigator.Screen
        name="Root"
        component={isMobile ? RootStack : TopLevelDrawer}
      />
    </Navigator.Navigator>
  );
}
