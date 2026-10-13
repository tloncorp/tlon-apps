import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext } from 'react';
import { Platform } from 'react-native';

import { supportsLiquidGlass } from '../ui/components/GlassSurface';
import { supportsNativeScrollEdgeChrome } from './nativeHeaderOptions';

/**
 * Height a floating header occludes at the top of the screen, or 0 when the
 * header is opaque and content already starts beneath it.
 *
 * For a scroll view this belongs on the content inset, so content still runs
 * under the glass. For content that must not — a filter row above a list, an
 * absolutely positioned tooltip — it is layout on that content instead.
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
