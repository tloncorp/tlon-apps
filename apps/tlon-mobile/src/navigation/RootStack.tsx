import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StatusBar } from 'react-native';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import type { RootStackParamList } from '../types';
import { GroupSettingsStack } from './GroupSettingsStack';
import { TabStack } from './TabStack';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const isDarkMode = useIsDarkMode();

  // Android status bar has a solid color by default, so we clear it
  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    }
  });

  return (
    <Root.Navigator
      initialRouteName="Tabs"
      screenOptions={{ headerShown: false }}
    >
      <Root.Screen name="Tabs" component={TabStack} />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ animation: 'fade' }}
      />
      <Root.Screen name="GroupSettings" component={GroupSettingsStack} />
    </Root.Navigator>
  );
}
