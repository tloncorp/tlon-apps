import { DESKTOP_TOPLEVEL_SIDEBAR_WIDTH } from '@tloncorp/ui';
import { type ReactNode, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  ReservedRegionsProvider,
  useReservedRegions,
} from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SplitPaneWidthsContext } from './desktop/splitPaneWidths';

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
  const { left: leftInset } = useSafeAreaInsets();
  const divisions = regions.filter((region) => region.kind === 'division');
  const fold =
    divisions.length === 1 &&
    divisions[0].frame.height > divisions[0].frame.width
      ? divisions[0].frame
      : null;
  const foldStart = fold?.x;
  const foldWidth = fold?.width;
  const widths = useMemo(
    () =>
      foldStart === undefined || foldWidth === undefined
        ? null
        : {
            listPaneWidth:
              foldStart - DESKTOP_TOPLEVEL_SIDEBAR_WIDTH - leftInset,
            foldGap: foldWidth,
          },
    [foldStart, foldWidth, leftInset]
  );
  return (
    <SplitPaneWidthsContext.Provider value={widths}>
      {children}
    </SplitPaneWidthsContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
