import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BrowserViewerModal } from './BrowserViewerModal';
import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

type Handoff = {
  viewerUrl: string;
  onComplete?: () => Promise<void>;
};

type RegisteredHandoff = Handoff & { completing?: boolean };

type BrowserCredentialHandoffContextValue = {
  openViewer: (viewerUrl: string) => void;
  register: (handoff: Handoff) => string;
  resolve: (id: string) => string | undefined;
  complete: (id: string) => Promise<void>;
  discard: (id: string) => void;
};

const BrowserCredentialHandoffContext =
  createContext<BrowserCredentialHandoffContextValue | null>(null);

export function BrowserCredentialHandoffProvider({
  children,
}: PropsWithChildren) {
  const [viewerUrl, setViewerUrl] = useState<string>();
  const openViewer = useCallback((url: string) => {
    setViewerUrl(trustedBrowserViewerUrl(url));
  }, []);
  const handoffs = useRef(new Map<string, RegisteredHandoff>());
  const sequence = useRef(0);

  const register = useCallback((handoff: Handoff) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handoffs.current.set(id, { ...handoff });
    return id;
  }, []);

  const resolve = useCallback((id: string) => {
    const handoff = handoffs.current.get(id);
    return handoff?.completing ? undefined : handoff?.viewerUrl;
  }, []);

  const complete = useCallback(async (id: string) => {
    const handoff = handoffs.current.get(id);
    if (!handoff || handoff.completing) {
      throw new Error('The originating conversation is no longer available.');
    }
    handoff.completing = true;
    try {
      await handoff.onComplete?.();
      handoffs.current.delete(id);
    } catch (error) {
      // A dismissed screen removes the entry even while completion is pending.
      handoff.completing = false;
      throw error;
    }
  }, []);

  const discard = useCallback((id: string) => {
    handoffs.current.delete(id);
  }, []);

  const value = useMemo(
    () => ({ register, resolve, complete, discard, openViewer }),
    [complete, discard, register, resolve, openViewer]
  );

  return (
    <BrowserCredentialHandoffContext.Provider value={value}>
      {children}
      {viewerUrl ? (
        <BrowserViewerModal
          viewerUrl={viewerUrl}
          onClose={() => setViewerUrl(undefined)}
        />
      ) : null}
    </BrowserCredentialHandoffContext.Provider>
  );
}

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
