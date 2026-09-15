import { NavigationContext } from '@react-navigation/native';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

const IOS_TAB_BAR_HEIGHT = 49;
const ANDROID_TAB_BAR_HEIGHT = 80;

/**
 * Bottom inset for content that the top-level tab bar would otherwise cover.
 *
 * The native tab bar floats over screen content, so only screens hosted by the
 * tab navigator need to reserve room for it; anything pushed onto the root
 * stack renders above the bar and gets ordinary content spacing instead.
 */
export function useTopLevelTabBarContentInset() {
  const { bottom } = useSafeAreaInsets();
  const contentSpacing = getTokenValue('$l', 'space');
  const navigation = useContext(NavigationContext);

  if (navigation?.getState().type !== 'tab') {
    return contentSpacing;
  }

  switch (Platform.OS) {
    case 'ios':
      return IOS_TAB_BAR_HEIGHT + bottom + contentSpacing;
    case 'android':
      return ANDROID_TAB_BAR_HEIGHT + bottom;
    default:
      return contentSpacing;
  }
}
