import { useIsWindowNarrow } from '@tloncorp/ui';
import { Platform } from 'react-native';

/**
 * True where `ActionSheet` presents as a native modal sheet by default: off
 * web, on a narrow window. Wide native windows get a dialog instead.
 */
export function useIsNativeSheet() {
  const isWindowNarrow = useIsWindowNarrow();
  return Platform.OS !== 'web' && isWindowNarrow;
}
