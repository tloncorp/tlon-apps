import { Platform } from 'react-native';

import { supportsNativeScrollEdgeChrome } from '../../../navigation/nativeHeaderOptions';
import { supportsLiquidGlass } from '../GlassSurface';
import { settingsListPageColor } from './settingsListPageColor';

/**
 * The header color for a screen hosting a settings list. An opaque header
 * takes the page color so it doesn't show as a band. The iOS 26 header is
 * see-through, and filling it would hide the soft edge the list fades into.
 */
export function getSettingsListHeaderColor() {
  return supportsNativeScrollEdgeChrome(
    Platform.OS,
    Platform.Version,
    supportsLiquidGlass()
  )
    ? undefined
    : settingsListPageColor;
}
