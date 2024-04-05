import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { useIsDarkMode } from './useIsDarkMode';

type Props = {
  overrides?: NativeStackNavigationOptions;
};

export const useScreenOptions = (
  props?: Props
): NativeStackNavigationOptions => {
  const isDarkMode = useIsDarkMode();
  return {
    headerTitle: '',
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: isDarkMode ? '#000' : '#fff',
    },
    headerTintColor: isDarkMode ? '#fff' : '#333',
    ...props?.overrides,
  };
};
