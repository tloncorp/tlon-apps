import { firebase } from '@react-native-firebase/perf';
import { useFeatureFlag } from '@tloncorp/app/lib/featureFlags';
import { FirebasePerformanceMonitoringEndpoint } from '@tloncorp/app/utils/perf';
import { InstrumentationProvider } from '@tloncorp/shared/dist';
import { useMemo } from 'react';

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
