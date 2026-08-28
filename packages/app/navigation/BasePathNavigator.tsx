import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';

import { BrowserCredentialHandoffCompletionProvider } from '../features/browser/BrowserCredentialHandoffCompletion';
import { BrowserCredentialHandoffScreen } from '../features/browser/BrowserCredentialHandoffScreen';
import { useRenderCount } from '../hooks/useRenderCount';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import {
  DesktopBasePathStackParamList,
  MobileBasePathStackParamList,
} from './types';

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
    <BrowserCredentialHandoffCompletionProvider>
      <Navigator.Navigator screenOptions={{ headerShown: false }}>
        <Navigator.Screen name="Root" component={component} />
        <Navigator.Screen
          name="BrowserCredentialHandoff"
          component={BrowserCredentialHandoffScreen}
          options={{ presentation: 'modal' }}
        />
      </Navigator.Navigator>
    </BrowserCredentialHandoffCompletionProvider>
  );
});

BasePathNavigator.displayName = 'BasePathNavigator';
