import type {
  BrowserTelemetryContext,
  BrowserLifecycleInput,
} from '@tloncorp/api';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

import { trackBrowserLifecycle } from './browserTelemetry';

type Handoff = {
  viewerUrl: string;
  telemetry?: BrowserTelemetryContext;
  onComplete?: () => Promise<void>;
};

type RegisteredHandoff = Handoff & {
  completing?: boolean;
  startedAt: number;
  opened?: boolean;
};
type HandoffEvent = Omit<
  BrowserLifecycleInput,
  'source' | 'browserSessionId' | 'browserHandoffId'
>;

type BrowserCredentialHandoffContextValue = {
  register: (handoff: Handoff) => string;
  resolve: (id: string) => string | undefined;
  complete: (id: string) => Promise<void>;
  discard: (id: string) => void;
  report: (id: string, event: HandoffEvent) => void;
};

const BrowserCredentialHandoffContext =
  createContext<BrowserCredentialHandoffContextValue | null>(null);

export function BrowserCredentialHandoffProvider({
  children,
}: PropsWithChildren) {
  const handoffs = useRef(new Map<string, RegisteredHandoff>());
  const sequence = useRef(0);

  const report = useCallback((id: string, event: HandoffEvent) => {
    const handoff = handoffs.current.get(id);
    if (!handoff) return;
    if (event.phase === 'form_opened') {
      if (handoff.opened) return;
      handoff.opened = true;
      handoff.startedAt = Date.now();
    }
    trackBrowserLifecycle({
      ...event,
      ...handoff.telemetry,
      source: 'client',
      elapsedMs: Math.max(0, Date.now() - handoff.startedAt),
    });
  }, []);

  const register = useCallback((handoff: Handoff) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handoffs.current.set(id, { ...handoff, startedAt: Date.now() });
    return id;
  }, []);

  const resolve = useCallback((id: string) => {
    const handoff = handoffs.current.get(id);
    return handoff?.completing ? undefined : handoff?.viewerUrl;
  }, []);

  const complete = useCallback(
    async (id: string) => {
      const handoff = handoffs.current.get(id);
      if (!handoff || handoff.completing) {
        throw new Error('The originating conversation is no longer available.');
      }
      handoff.completing = true;
      try {
        await handoff.onComplete?.();
        report(id, { phase: 'form_closed', outcome: 'unknown' });
        handoffs.current.delete(id);
      } catch (error) {
        // A dismissed screen removes the entry even while completion is pending.
        handoff.completing = false;
        throw error;
      }
    },
    [report]
  );

  const discard = useCallback(
    (id: string) => {
      report(id, { phase: 'form_closed', outcome: 'unknown' });
      handoffs.current.delete(id);
    },
    [report]
  );

  const value = useMemo(
    () => ({ register, resolve, complete, discard, report }),
    [complete, discard, register, resolve, report]
  );

  return (
    <BrowserCredentialHandoffContext.Provider value={value}>
      {children}
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
