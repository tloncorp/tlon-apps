import { createContext, useContext } from 'react';
import {
  type EdgeInsets,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/**
 * The window's safe-area insets, provided above any nested SafeAreaProvider
 * that measures only a part of the window, such as a split layout pane.
 */
export const WindowSafeAreaInsetsContext = createContext<EdgeInsets | null>(
  null
);

/**
 * Safe-area insets of the whole window, for UI that renders at the window
 * root (modals, portals) but is declared inside a pane that has its own
 * SafeAreaProvider.
 */
export function useWindowSafeAreaInsets(): EdgeInsets {
  const windowInsets = useContext(WindowSafeAreaInsetsContext);
  const insets = useSafeAreaInsets();
  return windowInsets ?? insets;
}
