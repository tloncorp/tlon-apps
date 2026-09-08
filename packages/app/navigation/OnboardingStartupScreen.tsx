import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';

import type { RootStackParamList } from './types';

/**
 * Cold-start entry for a still-locked onboarding setup chat: immediately
 * rebuilds the stack as Home-under-Channel so the user wakes up in the
 * conversation with a normal stack beneath it.
 */
export function OnboardingStartupScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'OnboardingStartup'>) {
  useLayoutEffect(() => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'MainTabs' },
        {
          name: 'Channel',
          params: { ...route.params, disableTransition: true },
        },
      ],
    });
  }, [navigation, route.params]);

  return null;
}
