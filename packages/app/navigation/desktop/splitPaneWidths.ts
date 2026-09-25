import { DESKTOP_SIDEBAR_WIDTH } from '@tloncorp/ui';
import { createContext, useContext } from 'react';

export type SplitPaneWidths = {
  /** Width of the list pane between the icon rail and the detail pane. */
  listPaneWidth: number;
  /** Space kept clear between the list and detail panes, such as a fold. */
  foldGap: number;
};

const defaultWidths: SplitPaneWidths = {
  listPaneWidth: DESKTOP_SIDEBAR_WIDTH,
  foldGap: 0,
};

export const SplitPaneWidthsContext = createContext<SplitPaneWidths | null>(
  null
);

export function useSplitPaneWidths(): SplitPaneWidths {
  return useContext(SplitPaneWidthsContext) ?? defaultWidths;
}
