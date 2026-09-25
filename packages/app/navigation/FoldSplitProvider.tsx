import {
  DESKTOP_SIDEBAR_WIDTH,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
} from '@tloncorp/ui';
import { type ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import {
  type ReservedRegion,
  ReservedRegionsProvider,
  useReservedRegions,
} from 'react-native-reserved-regions';
import {
  type EdgeInsets,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  type RailStrip,
  type SplitPaneWidths,
  SplitPaneWidthsContext,
} from './desktop/splitPaneWidths';

/**
 * Lines the split layout up with a vertical fold: the list pane ends where the
 * fold starts and the detail pane starts where it ends. On the iPhone Duo,
 * UIKit reports the fold as a division only while the device is partially
 * folded, so a fully open device keeps the default widths. A horizontal fold,
 * as in a tabletop posture, also keeps them.
 *
 * The fold is assumed to sit near the middle of a full-screen window, as on
 * the Duo; a window that meets a fold near one of its edges would get a very
 * narrow list or detail pane.
 *
 * Where the system reserves a side strip below its status cluster, as on the
 * Duo, the icon rail moves into that strip instead of taking its own column.
 */
export function FoldSplitProvider({ children }: { children: ReactNode }) {
  return (
    <ReservedRegionsProvider style={styles.fill}>
      <FoldSplitWidths>{children}</FoldSplitWidths>
    </ReservedRegionsProvider>
  );
}

function FoldSplitWidths({ children }: { children: ReactNode }) {
  const regions = useReservedRegions();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const divisions = regions.filter((region) => region.kind === 'division');
  const fold =
    divisions.length === 1 &&
    divisions[0].frame.height > divisions[0].frame.width
      ? divisions[0].frame
      : null;
  const strip = getRailStrip(regions, insets, windowWidth);
  const foldStart = fold?.x;
  const foldWidth = fold?.width;
  const stripX = strip?.x;
  const stripTop = strip?.top;
  const stripWidth = strip?.width;
  const widths = useMemo((): SplitPaneWidths => {
    const railStrip =
      stripX === undefined || stripTop === undefined || stripWidth === undefined
        ? null
        : { x: stripX, top: stripTop, width: stripWidth };
    const railColumnWidth = railStrip
      ? 0
      : DESKTOP_TOPLEVEL_SIDEBAR_WIDTH + insets.left;
    return {
      railColumnWidth,
      railStrip,
      listPaneWidth:
        foldStart === undefined
          ? DESKTOP_SIDEBAR_WIDTH
          : foldStart - railColumnWidth,
      foldGap: foldWidth ?? 0,
    };
  }, [foldStart, foldWidth, stripX, stripTop, stripWidth, insets.left]);
  return (
    <SplitPaneWidthsContext.Provider value={widths}>
      {children}
    </SplitPaneWidthsContext.Provider>
  );
}

// The iPhone Duo reserves a band along the right edge of the window, as a
// safe-area inset, below the status cluster that UIKit reports as an
// occlusion at the top of that band. UIKit places its own bar items there.
function getRailStrip(
  regions: readonly ReservedRegion[],
  insets: EdgeInsets,
  windowWidth: number
): RailStrip | null {
  if (Platform.OS !== 'ios' || insets.right === 0) {
    return null;
  }
  const stripX = windowWidth - insets.right;
  const cluster = regions.find(
    (region) =>
      region.kind === 'occlusion' &&
      region.frame.x >= stripX - 1 &&
      region.frame.x + region.frame.width >= windowWidth - 1
  );
  return cluster
    ? {
        x: stripX,
        top: cluster.frame.y + cluster.frame.height,
        width: insets.right,
      }
    : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
