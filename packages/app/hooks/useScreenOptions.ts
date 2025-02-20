import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { useStyle } from '../ui';

type Props = {
  overrides?: NativeStackNavigationOptions;
};

export const useScreenOptions = (
  props?: Props
): NativeStackNavigationOptions => {
  const contentStyle = useStyle({
    backgroundColor: '$background',
  });
  return {
    headerTitle: '',
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    gestureEnabled: true,
    headerStyle: contentStyle,
    contentStyle,
    headerTintColor: contentStyle.backgroundColor,
    ...props?.overrides,
  };
};
