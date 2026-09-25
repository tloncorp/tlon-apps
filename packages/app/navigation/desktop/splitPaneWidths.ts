import {
  DESKTOP_SIDEBAR_WIDTH,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
} from '@tloncorp/ui';
import { createContext, useContext } from 'react';

/** A side band of the window, below the system status cluster. */
export type RailStrip = {
  x: number;
  top: number;
  width: number;
};

export type SplitPaneWidths = {
  /** Width of the icon rail column at the leading edge, 0 when it has none. */
  railColumnWidth: number;
  /** Where the icon rail sits instead of its own column, if anywhere. */
  railStrip: RailStrip | null;
  /** Width of the list pane between the icon rail and the detail pane. */
  listPaneWidth: number;
  /** Space kept clear between the list and detail panes, such as a fold. */
  foldGap: number;
};

const defaultWidths: SplitPaneWidths = {
  railColumnWidth: DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
  railStrip: null,
  listPaneWidth: DESKTOP_SIDEBAR_WIDTH,
  foldGap: 0,
};

export const SplitPaneWidthsContext = createContext<SplitPaneWidths | null>(
  null
);

export function useSplitPaneWidths(): SplitPaneWidths {
  return useContext(SplitPaneWidthsContext) ?? defaultWidths;
}
