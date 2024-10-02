import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FeatureFlagScreen } from '../features/settings/FeatureFlagScreen';
import ProfileScreen from '../features/settings/ProfileScreen';
import { useScreenOptions } from '../hooks/useScreenOptions';
import { RootStackParamList, SettingsStackParamList } from './types';

type Props = BottomTabScreenProps<RootStackParamList, 'Profile'>;
const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStack = ({ navigation }: Props) => {
  const screenOptions = useScreenOptions({
    overrides: {
      headerShown: false,
    },
  });

  return (
    <Stack.Navigator initialRouteName="Settings" screenOptions={screenOptions}>
      <Stack.Screen name="Settings" component={ProfileScreen} />
      <Stack.Screen name="FeatureFlags" component={FeatureFlagScreen} />
    </Stack.Navigator>
  );
};
