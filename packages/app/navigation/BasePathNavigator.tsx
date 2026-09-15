import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { memo } from 'react';

import { BrowserCredentialHandoffCompletionProvider } from '../features/browser/BrowserCredentialHandoffCompletion';
import { BrowserCredentialHandoffScreen } from '../features/browser/BrowserCredentialHandoffScreen';
import { useRenderCount } from '../hooks/useRenderCount';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import {
  DesktopBasePathStackParamList,
  MobileBasePathStackParamList,
} from './types';

export type {
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
  useRenderCount('BasePathNavigator');

  if (isMobile) {
    return (
      <MobileBasePathStackNavigator.Navigator
        screenOptions={{ headerShown: false }}
      >
        <MobileBasePathStackNavigator.Screen
          name="Root"
          component={RootStack}
        />
      </MobileBasePathStackNavigator.Navigator>
    );
  }

  return (
    <BrowserCredentialHandoffCompletionProvider>
      <DesktopBasePathStackNavigator.Navigator
        screenOptions={{ headerShown: false }}
      >
        <DesktopBasePathStackNavigator.Screen
          name="Root"
          component={TopLevelDrawer}
        />
        <DesktopBasePathStackNavigator.Screen
          name="BrowserCredentialHandoff"
          component={BrowserCredentialHandoffScreen}
          options={{ presentation: 'modal' }}
        />
      </DesktopBasePathStackNavigator.Navigator>
    </BrowserCredentialHandoffCompletionProvider>
  );
});

BasePathNavigator.displayName = 'BasePathNavigator';
