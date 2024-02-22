import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import branch from 'react-native-branch';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetTelemetry'>;

export const SetTelemetryScreen = ({
  navigation,
  route: {
    params: { user, signUpExtras },
  },
}: Props) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const tailwind = useTailwind();
  const postHog = usePostHog();

  const handleNext = useCallback(() => {
    if (!isEnabled) {
      postHog?.optOut();
      branch.disableTracking(true);
    }

    navigation.push('ReserveShip', {
      user,
      signUpExtras: { ...signUpExtras, telemetry: isEnabled },
    });
  }, [isEnabled, user, postHog]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButton title="Next" onPress={handleNext} />,
    });
  }, [navigation, handleNext]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'mb-8 text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        We're trying to make this thing great, and knowing how people use the
        app really helps.
      </Text>
      <View
        style={tailwind(
          'px-6 py-3 flex flex-row items-center justify-between border border-tlon-black-10 dark:border-tlon-black-90 rounded-xl'
        )}
      >
        <Text
          style={tailwind(
            'text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Enable Telemetry
        </Text>
        <Switch value={isEnabled} onValueChange={setIsEnabled} />
      </View>
    </View>
  );
};
