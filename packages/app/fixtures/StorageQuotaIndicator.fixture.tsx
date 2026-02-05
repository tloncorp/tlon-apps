import { useEffect } from 'react';
import { View } from 'tamagui';

import { useConfigureUrbitClient } from '../hooks/useConfigureUrbitClient';
import {
  StorageQuotaIndicator,
  useStorageInfoQuery,
} from '../ui/components/StorageQuotaIndicator';
import { FixtureWrapper } from './FixtureWrapper';

export default function StorageQuotaIndicatorFixture() {
  const configure = useConfigureUrbitClient();
  useEffect(() => {
    configure({
      shipName: 'ravseg-nosduc',
      shipUrl: 'https://ravseg-nosduc.tlon.network',
    });
  }, [configure]);

  const storageInfoQuery = useStorageInfoQuery();

  return (
    <FixtureWrapper horizontalAlign="center" verticalAlign="center">
      <View style={{ padding: 10 }}>
        <StorageQuotaIndicator
          storageInfoQuery={storageInfoQuery}
          width={300}
          padding={12}
        />
      </View>
    </FixtureWrapper>
  );
}
