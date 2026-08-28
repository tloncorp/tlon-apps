import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

type CompletionHandler = () => Promise<void>;

type BrowserCredentialHandoffCompletionContextValue = {
  register: (handler: CompletionHandler) => string;
  complete: (id: string) => Promise<void>;
  discard: (id: string) => void;
};

const BrowserCredentialHandoffCompletionContext =
  createContext<BrowserCredentialHandoffCompletionContextValue | null>(null);

export function BrowserCredentialHandoffCompletionProvider({
  children,
}: PropsWithChildren) {
  const handlers = useRef(new Map<string, CompletionHandler>());
  const sequence = useRef(0);

  const register = useCallback((handler: CompletionHandler) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handlers.current.set(id, handler);
    return id;
  }, []);

  const complete = useCallback(async (id: string) => {
    const handler = handlers.current.get(id);
    if (!handler) {
      throw new Error('The originating conversation is no longer available.');
    }
    handlers.current.delete(id);
    try {
      await handler();
    } catch (error) {
      handlers.current.set(id, handler);
      throw error;
    }
  }, []);

  const discard = useCallback((id: string) => {
    handlers.current.delete(id);
  }, []);

  const value = useMemo(
    () => ({ register, complete, discard }),
    [complete, discard, register]
  );

  return (
    <BrowserCredentialHandoffCompletionContext.Provider value={value}>
      {children}
    </BrowserCredentialHandoffCompletionContext.Provider>
  );
}

export function useBrowserCredentialHandoffCompletion() {
  const value = useContext(BrowserCredentialHandoffCompletionContext);
  if (!value) {
    throw new Error(
      'Browser credential handoff completion provider is unavailable.'
    );
  }
  return value;
}
