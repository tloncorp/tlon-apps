import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

const IOS_TAB_BAR_HEIGHT = 49;
const ANDROID_TAB_BAR_HEIGHT = 80;

export function useTopLevelTabBarContentInset() {
  const { bottom } = useSafeAreaInsets();
  const contentSpacing = getTokenValue('$l', 'space');

  switch (Platform.OS) {
    case 'ios':
      return IOS_TAB_BAR_HEIGHT + bottom + contentSpacing;
    case 'android':
      return ANDROID_TAB_BAR_HEIGHT + bottom;
    default:
      return contentSpacing;
  }
}
