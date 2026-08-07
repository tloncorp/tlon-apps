import { useIsWindowNarrow } from '@tloncorp/ui';
import { Platform } from 'react-native';

/**
 * Whether a settings screen must draw its own back control.
 *
 * Mirrors `useNestedSettings` in navigation/utils, which is the condition
 * navigation actually routes on: only web at a wide window nests these
 * screens inside the settings drawer, where the drawer is the way back.
 * Everywhere else they are flat RootStack routes, and that stack sets
 * `headerBackVisible: false` and disables gestures on them — so the
 * screen's own header is the only exit there is.
 *
 * Gating on window width alone therefore stranded native tablets: wide
 * enough to skip the back button, with no drawer to go back to and no
 * swipe to fall back on.
 */
export function useShowSettingsBackAction(): boolean {
  const isWindowNarrow = useIsWindowNarrow();
  return isWindowNarrow || Platform.OS !== 'web';
}
