import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useContacts } from '@tloncorp/shared/dist';
import { AppDataContextProvider } from '@tloncorp/ui';

import { useScreenOptions } from '../hooks/useScreenOptions';
import { FeatureFlagScreen } from '../screens/FeatureFlagScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { RootStackParamList, SettingsStackParamList } from '../types';

// import type { SettingsStackParamList, TabParamList } from '../types';

type Props = BottomTabScreenProps<RootStackParamList, 'Profile'>;
const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStack = ({ navigation }: Props) => {
  const screenOptions = useScreenOptions({
    overrides: {
      headerShown: false,
    },
  });

  const { data: contacts } = useContacts();

  return (
    <AppDataContextProvider contacts={contacts ?? []}>
      <Stack.Navigator
        initialRouteName="Settings"
        screenOptions={screenOptions}
      >
        <Stack.Screen name="Settings" component={ProfileScreen} />
        <Stack.Screen name="FeatureFlags" component={FeatureFlagScreen} />
      </Stack.Navigator>
    </AppDataContextProvider>
  );
};
