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
      set({ endpoint: e });
    },

    setEnabled: (enabled) => {
      const { endpoint } = getState();
      if (enabled && endpoint == null) {
        throw new Error('Performance monitoring endpoint not set');
      }
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
    setEnabled(collectionEnabled);
  }, [collectionEnabled, setEnabled]);

  useEffect(() => {
    setEndpoint(endpoint);
  }, [setEndpoint, endpoint]);

  return children;
}
