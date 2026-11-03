import { createContext, useContext } from 'react';
import type { BrowserCredentialHandoffParams } from '../../navigation/types';

export type Handoff = {
  viewerUrl: string;
};

type BrowserCredentialHandoffContextValue = {
  viewerOpen: boolean;
  openForm: (
    viewerUrl: string,
    loginApproval?: BrowserCredentialHandoffParams['loginApproval']
  ) => void;
  openViewer: (viewerUrl: string) => Promise<void>;
  register: (handoff: Handoff) => string;
  resolve: (id: string) => string | undefined;
  discard: (id: string) => void;
};

export const BrowserCredentialHandoffContext =
  createContext<BrowserCredentialHandoffContextValue | null>(null);

export function useOptionalBrowserCredentialHandoff() {
  return useContext(BrowserCredentialHandoffContext);
}

export function useBrowserCredentialHandoff() {
  const value = useOptionalBrowserCredentialHandoff();
  if (!value) {
    throw new Error('Browser credential handoff provider is unavailable.');
  }
  return value;
}
