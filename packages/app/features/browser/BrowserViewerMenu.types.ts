export type BrowserViewMode = 'agent' | 'mobile';

export interface BrowserViewerMenuProps {
  topInset: number;
  rightInset: number;
  mode?: BrowserViewMode;
  ready: boolean;
  onSelect: (mode: BrowserViewMode) => void;
  browserControlsVisible?: boolean;
  onBrowserControlsChange: (visible: boolean) => void;
}
