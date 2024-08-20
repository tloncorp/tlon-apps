import { useFeatureFlag } from '@tloncorp/app/lib/featureFlags';
import { InstrumentationProvider } from '@tloncorp/shared/dist';

export function FeatureFlagConnectedInstrumentationProvider({
  children,
}: {
  children: JSX.Element;
}) {
  const [isPerformanceCollectionEnabled] = useFeatureFlag(
    'instrumentationEnabled'
  );

  return (
    <InstrumentationProvider collectionEnabled={isPerformanceCollectionEnabled}>
      {children}
    </InstrumentationProvider>
  );
}
