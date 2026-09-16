import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext } from 'react';
import { Platform } from 'react-native';

import { supportsLiquidGlass } from '../ui/components/GlassSurface';
import { supportsNativeScrollEdgeChrome } from './nativeHeaderOptions';

/**
 * Height a floating header occludes at the top of the screen, or 0 when the
 * header is opaque and content already starts beneath it.
 *
 * Scrolling content under the glass is the point, so this belongs on a scroll
 * view's content inset — never as layout padding on the screen itself.
 */
export function useFloatingHeaderHeight(enabled = true) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const floating =
    enabled &&
    supportsNativeScrollEdgeChrome(
      Platform.OS,
      Platform.Version,
      supportsLiquidGlass()
    );

  return floating ? headerHeight : 0;
}
