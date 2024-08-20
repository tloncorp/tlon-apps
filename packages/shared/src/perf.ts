import { firebase } from '@react-native-firebase/perf';
import { useEffect } from 'react';
import create from 'zustand';

interface Trace {
  putMetric(metricName: string, value: number): void;
  stop(): Promise<null>;
}

type PerformanceMonitoringStore = { setEnabled: (enabled: boolean) => void } & (
  | { enabled: false }
  | { enabled: true; startTrace(identifier: string): Promise<Trace> }
);

const usePerformanceMonitoringStore = create<PerformanceMonitoringStore>(
  (set) => ({
    setEnabled: (enabled) => {
      // instrumentationEnabled = automatic measurement of HTTP requests, other things?
      firebase.perf().instrumentationEnabled = false;

      // dataCollectionEnabled = sending any data to server
      firebase.perf().dataCollectionEnabled = enabled;

      set((prev) => ({
        ...prev,
        enabled,
        ...(enabled
          ? {
              startTrace(identifier) {
                return firebase.perf().startTrace(identifier);
              },
            }
          : {}),
      }));
    },
    enabled: false,
  })
);

export function useStartTraceCallback():
  | undefined
  | ((identifier: string) => Promise<Trace>) {
  return usePerformanceMonitoringStore((s) =>
    s.enabled ? s.startTrace : undefined
  );
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
  collectionEnabled,
  children,
}: {
  collectionEnabled: boolean;
  children: JSX.Element;
}) {
  const setMonitoringEnabled = usePerformanceMonitoringStore(
    (s) => s.setEnabled
  );

  useEffect(() => {
    setMonitoringEnabled(collectionEnabled);
  }, [collectionEnabled, setMonitoringEnabled]);

  return children;
}
