import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useScreenOptions } from '../hooks/useScreenOptions';
import { FeatureFlagScreen } from '../screens/FeatureFlagScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { SettingsStackParamList, TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Settings'>;
const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStack = ({ navigation }: Props) => {
  const screenOptions = useScreenOptions({
    overrides: {
      headerShown: false,
    },
  });

  return (
    <Stack.Navigator initialRouteName="Profile" screenOptions={screenOptions}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="FeatureFlags" component={FeatureFlagScreen} />
    </Stack.Navigator>
  );
};
