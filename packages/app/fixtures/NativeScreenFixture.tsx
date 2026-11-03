import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';

import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import { AppDataContextProvider } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { danContact, initialContacts } from './fakeData';

const FixtureStack = createNativeStackNavigator<{ Surface: undefined }>();

/**
 * A whole screen as the app pushes it: inside a native stack, so the screen
 * can install its own navigation bar.
 */
export function NativeScreenFixture({ children }: { children: ReactNode }) {
  return (
    <FixtureWrapper fillHeight fillWidth verticalAlign="top">
      <FixtureStack.Navigator
        screenOptions={{
          ...nativeHeaderPresentationOptions,
          headerShown: true,
          headerBackVisible: false,
        }}
      >
        <FixtureStack.Screen name="Surface">
          {() => (
            <AppDataContextProvider
              currentUserId={danContact.id}
              contacts={initialContacts}
            >
              {children}
            </AppDataContextProvider>
          )}
        </FixtureStack.Screen>
      </FixtureStack.Navigator>
    </FixtureWrapper>
  );
}
