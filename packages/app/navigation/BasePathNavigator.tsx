import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';

import { BrowserCredentialHandoffScreen } from '../features/browser/BrowserCredentialHandoffScreen';
import { useRenderCount } from '../hooks/useRenderCount';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import { RootDrawerParamList, RootStackParamList } from './types';

export type BrowserCredentialHandoffParams = { viewerUrl: string };

export type MobileBasePathStackParamList = {
  Root: NavigatorScreenParams<RootStackParamList>;
  BrowserCredentialHandoff: BrowserCredentialHandoffParams;
};

export type DesktopBasePathStackParamList = {
  Root: NavigatorScreenParams<RootDrawerParamList>;
  BrowserCredentialHandoff: BrowserCredentialHandoffParams;
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
      return RootStack;
    }
    return TopLevelDrawer;
  }, [isMobile]);

  useRenderCount('BasePathNavigator');

  return (
    <Navigator.Navigator screenOptions={{ headerShown: false }}>
      <Navigator.Screen name="Root" component={component} />
      <Navigator.Screen
        name="BrowserCredentialHandoff"
        component={BrowserCredentialHandoffScreen}
        options={{ presentation: 'modal' }}
      />
    </Navigator.Navigator>
  );
});

BasePathNavigator.displayName = 'BasePathNavigator';
