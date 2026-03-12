import {
  Deferred,
  convert,
  createDeferred,
  useMockedQuery,
} from '@tloncorp/shared';
import { useCallback, useState } from 'react';
import { View, YStack } from 'tamagui';

import { Button } from '../ui';
import {
  StorageInfo,
  StorageQuotaIndicator,
} from '../ui/components/StorageQuotaIndicator';
import { FixtureWrapper } from './FixtureWrapper';

export default function StorageQuotaIndicatorFixture() {
  return (
    <FixtureWrapper horizontalAlign="center" verticalAlign="center">
      <Content />
    </FixtureWrapper>
  );
}

// wrapper is necessary for react-query `useQuery`, which needs the provider
function Content() {
  const [storageInfoQuery, setStorageInfoQuery] =
    useMockedQuery<StorageInfo | null>({
      initial: async () => null,
      queryOptions: {
        queryKey: ['mocked-storageInfo'],
      },
    });
  const [resolver, setResolver] = useState<(() => void) | null>(null);

  const startResponse = useCallback(
    (resolve: (deferred: Deferred<StorageInfo | null>) => void) => {
      const deferredResponse = createDeferred<StorageInfo | null>();
      setStorageInfoQuery(deferredResponse.promise);
      setResolver(() => () => resolve(deferredResponse));

      // wait to refetch until state update
      setImmediate(() => {
        storageInfoQuery.refetch();
      });
    },
    [storageInfoQuery, setStorageInfoQuery]
  );

  return (
    <View style={{ padding: 10, alignItems: 'center', gap: 24 }}>
      <StorageQuotaIndicator
        storageInfoQuery={storageInfoQuery}
        width={300}
        padding={12}
      />

      <YStack>
        {resolver ? (
          <Button
            label="Resolve pending response"
            onPress={() => {
              resolver();
              setResolver(null);
            }}
          />
        ) : (
          <YStack>
            <Button
              label="Start response with random storage info"
              onPress={() => {
                startResponse((deferred) => {
                  const totalBytes = convert(10, 'gb').to('b');
                  deferred.resolve({
                    totalBytes,
                    usedBytes: Math.floor(Math.random() * totalBytes),
                  });
                });
              }}
            />
            <Button
              label="Start null response (custom object storage)"
              onPress={() => {
                startResponse((deferred) => {
                  deferred.resolve(null);
                });
              }}
            />
            <Button
              label="Start error response"
              onPress={() => {
                startResponse((deferred) => {
                  deferred.reject(new Error('This is an example error'));
                });
              }}
            />
          </YStack>
        )}
      </YStack>
    </View>
  );
}
