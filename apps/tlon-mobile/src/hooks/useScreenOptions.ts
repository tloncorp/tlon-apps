import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { useIsDarkMode } from './useIsDarkMode';

export const useScreenOptions = (): NativeStackNavigationOptions => {
  const isDarkMode = useIsDarkMode();
  return {
    headerTitle: '',
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: isDarkMode ? '#000' : '#fff',
    },
    headerTintColor: isDarkMode ? '#fff' : '#333',
  };
};
