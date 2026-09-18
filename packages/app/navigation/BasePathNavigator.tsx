import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';

import { useRenderCount } from '../hooks/useRenderCount';
import { AppDrawer } from './AppDrawer';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import { AppDrawerParamList, RootDrawerParamList } from './types';

export type MobileBasePathStackParamList = {
  Root: NavigatorScreenParams<AppDrawerParamList>;
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
export const BasePathNavigator = memo(({ isMobile }: { isMobile: boolean }) => {
  const Navigator = isMobile
    ? MobileBasePathStackNavigator
    : DesktopBasePathStackNavigator;

  const component = useMemo(() => {
    if (isMobile) {
      return AppDrawer;
    }
    return TopLevelDrawer;
  }, [isMobile]);

  useRenderCount('BasePathNavigator');

  return (
    <Navigator.Navigator screenOptions={{ headerShown: false }}>
      <Navigator.Screen name="Root" component={component} />
    </Navigator.Navigator>
  );
});

BasePathNavigator.displayName = 'BasePathNavigator';
