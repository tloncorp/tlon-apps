import { Platform } from 'react-native';

import { useIsDarkMode } from '../../../hooks/useDarkMode';
import { supportsNativeScrollEdgeChrome } from '../../../navigation/nativeHeaderOptions';
import { supportsLiquidGlass } from '../GlassSurface';

/**
 * The colors a native settings list sits on. Grouped cards read as raised
 * above the page, as in the platforms' own settings: in a light theme they
 * are the brighter primary background on a tinted page; in a dark theme the
 * secondary background is the lighter of the two, so the roles swap.
 */
export function useSettingsListSurfaces() {
  const isDark = useIsDarkMode();
  return isDark
    ? ({ page: '$background', card: '$secondaryBackground' } as const)
    : ({ page: '$secondaryBackground', card: '$background' } as const);
}

/**
 * The header color for a screen hosting a settings list. An opaque header
 * takes the page color so it doesn't show as a band. The iOS 26 header is
 * see-through, and filling it would hide the soft edge the list fades into.
 */
export function useSettingsListHeaderColor() {
  const { page } = useSettingsListSurfaces();
  return supportsNativeScrollEdgeChrome(
    Platform.OS,
    Platform.Version,
    supportsLiquidGlass()
  )
    ? undefined
    : page;
}
