import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { Screen, ScreenContainer } from 'react-native-screens';

/** The native fixture uses the same real screen appearance owner as the app. */
export function ScrollStabilityScreenHost({ children }: PropsWithChildren) {
  if (Platform.OS !== 'ios') return <>{children}</>;

  return (
    <ScreenContainer enabled style={{ flex: 1 }}>
      <Screen
        enabled
        activityState={2}
        freezeOnBlur={false}
        style={{ flex: 1 }}
      >
        {children}
      </Screen>
    </ScreenContainer>
  );
}
