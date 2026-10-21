import type { BrowserViewerModalProps } from './BrowserViewerModal.types';

// Web callers open a tab directly from the click handler to retain user
// activation. Native builds resolve the embedded viewer in the .native module.
export function BrowserViewerModal(_props: BrowserViewerModalProps) {
  return null;
}
