import { firebase } from '@react-native-firebase/perf';
import { InstrumentationProvider } from '@tloncorp/shared/dist';
import { PerformanceMonitoringEndpoint } from '@tloncorp/shared/dist/perf';
import { useMemo } from 'react';

import { useFeatureFlag } from '../lib/featureFlags';

type Firebase = typeof firebase;

class FirebasePerformanceMonitoringEndpoint
  implements PerformanceMonitoringEndpoint
{
  static shared = new FirebasePerformanceMonitoringEndpoint(firebase);

  constructor(private firebase: Firebase) {
    // instrumentationEnabled = automatic measurement of HTTP requests, other stuff?
    // Let's disable this until we need it to avoid overhead
    this.firebase.perf().instrumentationEnabled = false;
  }

  setEnabled(enabled: boolean) {
    firebase.perf().dataCollectionEnabled = enabled;
  }

  async startTrace(identifier: string) {
    return firebase.perf().startTrace(identifier);
  }
}

export function FeatureFlagConnectedInstrumentationProvider({
  children,
}: {
  children: JSX.Element;
}) {
  const [isPerformanceCollectionEnabled] = useFeatureFlag(
    'instrumentationEnabled'
  );
  const endpoint = useMemo(
    () => new FirebasePerformanceMonitoringEndpoint(firebase),
    []
  );

  return (
    <InstrumentationProvider
      collectionEnabled={isPerformanceCollectionEnabled}
      endpoint={endpoint}
    >
      {children}
    </InstrumentationProvider>
  );
}
