import { useEffect } from 'react';
import { useFixtureInput } from 'react-cosmos/client';

import { useFeatureFlag } from '../lib/featureFlags';

/**
 * Manage a feature flag using Cosmos fixture input (right sidebar).
 */
export function useFixtureFeatureFlag<
  FlagName extends Parameters<typeof useFeatureFlag>[0],
>(flagName: FlagName) {
  const [value, setValue] = useFeatureFlag(flagName);
  const [fixtureValue] = useFixtureInput(flagName, value);
  useEffect(() => {
    setValue(fixtureValue);
  }, [fixtureValue, setValue]);
}
