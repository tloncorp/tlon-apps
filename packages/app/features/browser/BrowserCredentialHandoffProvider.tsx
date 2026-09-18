import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

type Handoff = {
  viewerUrl: string;
  onComplete?: () => Promise<void>;
};

type BrowserCredentialHandoffContextValue = {
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
  const handoffs = useRef(new Map<string, Handoff>());
  const sequence = useRef(0);

  const register = useCallback((handoff: Handoff) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handoffs.current.set(id, handoff);
    return id;
  }, []);

  const resolve = useCallback(
    (id: string) => handoffs.current.get(id)?.viewerUrl,
    []
  );

  const complete = useCallback(async (id: string) => {
    const handoff = handoffs.current.get(id);
    if (!handoff) {
      throw new Error('The originating conversation is no longer available.');
    }
    handoffs.current.delete(id);
    try {
      await handoff.onComplete?.();
    } catch (error) {
      handoffs.current.set(id, handoff);
      throw error;
    }
  }, []);

  const discard = useCallback((id: string) => {
    handoffs.current.delete(id);
  }, []);

  const value = useMemo(
    () => ({ register, resolve, complete, discard }),
    [complete, discard, register, resolve]
  );

  return (
    <BrowserCredentialHandoffContext.Provider value={value}>
      {children}
    </BrowserCredentialHandoffContext.Provider>
  );
}

export function useBrowserCredentialHandoff() {
  const value = useContext(BrowserCredentialHandoffContext);
  if (!value) {
    throw new Error('Browser credential handoff provider is unavailable.');
  }
  return value;
}
