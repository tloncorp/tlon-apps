import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The bottom safe-area inset that sheet content still has to add itself.
 * Native sheets already keep their content clear of the navigation bar or
 * home indicator, so adding the window inset again leaves a band of dead space.
 */
export function useSheetBottomInset() {
  const { bottom } = useSafeAreaInsets();
  return Platform.OS === 'web' ? bottom : 0;
}
