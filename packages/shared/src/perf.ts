import { useEffect } from 'react';
import create from 'zustand';

interface Trace {
  putMetric(metricName: string, value: number): void;
  stop(): Promise<null>;
}

export interface PerformanceMonitoringEndpoint {
  setEnabled: (enabled: boolean) => void;
  startTrace: (identifier: string) => Promise<Trace>;
}

type PerformanceMonitoringStore = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  endpoint: PerformanceMonitoringEndpoint | null;
  setEndpoint: (e: PerformanceMonitoringEndpoint | null) => void;
  startTrace(identifier: string): Promise<Trace> | null;
};

const usePerformanceMonitoringStore = create<PerformanceMonitoringStore>(
  (set, getState) => ({
    endpoint: null,
    setEndpoint: (e) => {
      const { enabled } = getState();

      // If we're setting an endpoint and monitoring is already enabled,
      // enable it on the new endpoint
      if (e && enabled) {
        e.setEnabled(true);
      }

      set({ endpoint: e });
    },

    setEnabled: (enabled) => {
      const { endpoint } = getState();

      // If trying to enable but endpoint is not set yet, just update the state
      // The endpoint will handle enabling when it's set
      if (enabled && endpoint === null) {
        console.warn(
          'Performance monitoring endpoint not set yet, deferring enable'
        );
        set((prev) => ({
          ...prev,
          enabled,
        }));
        return;
      }

      // If endpoint exists, propagate the enabled state to it
      endpoint?.setEnabled(enabled);

      set((prev) => ({
        ...prev,
        enabled,
      }));
    },

    enabled: false,

    startTrace(identifier) {
      const { enabled, endpoint } = getState();
      if (!enabled || endpoint == null) {
        return null;
      }
      return endpoint.startTrace(identifier);
    },
  })
);

export function useStartTraceCallback(): (
  identifier: string
) => Promise<Trace> | null {
  return usePerformanceMonitoringStore((s) => s.startTrace);
}

// For use outside of React
export function startTrace(identifier: string): Promise<Trace> | null {
  const store = usePerformanceMonitoringStore.getState();
  if (store.enabled) {
    return store.startTrace(identifier);
  } else {
    return null;
  }
}

export function InstrumentationProvider({
  endpoint,
  collectionEnabled,
  children,
}: {
  endpoint: PerformanceMonitoringEndpoint | null;
  collectionEnabled: boolean;
  children: JSX.Element;
}) {
  const { setEndpoint, setEnabled } = usePerformanceMonitoringStore();

  useEffect(() => {
    // Set endpoint first
    setEndpoint(endpoint);

    // Then enable/disable collection only if endpoint exists
    if (endpoint) {
      setEnabled(collectionEnabled);
    }

    return () => {
      setEndpoint(null);
    };
  }, [endpoint, collectionEnabled, setEndpoint, setEnabled]);

  return children;
}
