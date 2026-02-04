import { useQuery } from '@tanstack/react-query';
import { convert } from '@tloncorp/shared/utils';
import { ForwardingProps, Pressable, Text, View } from '@tloncorp/ui';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
}

interface StorageInfoResponse {
  availableBytes: number;
  availableGigabytes: string;
  totalBytes: number;
  totalGigabytes: string;
  usedBytes: number;
  usedGigabytes: string;
}

async function requestStorageInfo(): Promise<StorageInfoResponse> {
  // TODO: this is a stub
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    availableBytes: 1065956322,
    availableGigabytes: '0.9927',
    totalGigabytes: '1.0000',
    totalBytes: convert(10, 'gb').to('b'),
    usedBytes: convert(10 * Math.random(), 'gb').to('b'),
    usedGigabytes: '0.0073',
  };
}

function useStorageInfoQuery() {
  return useQuery({
    queryKey: ['storage-info'],
    queryFn: async (): Promise<StorageInfo> => {
      const response = await requestStorageInfo();
      return response;
    },
  });
}

function StorageQuotaLinearProgress({
  storageInfo,
  ...forwardedProps
}: ForwardingProps<
  typeof View,
  {
    storageInfo: StorageInfo;
  }
>) {
  const ratio = useMemo(
    () =>
      storageInfo.totalBytes === 0
        ? -Infinity // avoid division by zero
        : storageInfo.usedBytes / storageInfo.totalBytes,
    [storageInfo]
  );

  return (
    <View
      {...forwardedProps}
      backgroundColor="$secondaryBackground"
      style={[styles.linearProgressBar, forwardedProps.style]}
    >
      <View
        backgroundColor="$positiveActionText"
        style={[
          styles.linearProgressUsed,
          {
            width: ratio === -Infinity ? 0 : `${(ratio * 100).toFixed(5)}%`,
          },
        ]}
      />
    </View>
  );
}

function StorageQuotaTextualProgress({
  storageInfo,
  ...forwardedProps
}: ForwardingProps<
  typeof View,
  {
    storageInfo: StorageInfo;
  }
>) {
  const labelText = useMemo(() => {
    if (storageInfo.totalBytes === 0) {
      return 'No storage available';
    }

    const usedGb = convert(storageInfo.usedBytes, 'b').to('gb');
    const totalGb = convert(storageInfo.totalBytes, 'b').to('gb');
    return `${usedGb.toFixed(2)} GB of ${totalGb.toFixed(2)} GB used`;
  }, [storageInfo]);

  return (
    <View {...forwardedProps}>
      <Text fontSize={16} textAlign="center">
        {labelText}
      </Text>
    </View>
  );
}

// when we don't have data, use this so we can hold space
const emptyStorageInfo: StorageInfo = {
  totalBytes: 0,
  usedBytes: 0,
};

export function StorageQuotaIndicator({
  style,
  ...forwardedProps
}: ForwardingProps<typeof View>) {
  const storageInfoQuery = useStorageInfoQuery();

  return (
    <Pressable
      gap={10}
      onPress={() => storageInfoQuery.refetch()}
      style={[{ position: 'relative' }, style]}
      {...forwardedProps}
    >
      <StorageQuotaTextualProgress
        storageInfo={storageInfoQuery.data ?? emptyStorageInfo}
        opacity={storageInfoQuery.data ? 1 : 0}
      />
      <StorageQuotaLinearProgress
        storageInfo={storageInfoQuery.data ?? emptyStorageInfo}
        opacity={storageInfoQuery.data ? 1 : 0}
      />

      {(storageInfoQuery.isFetching || storageInfoQuery.isError) && (
        <Animated.View
          entering={
            // delay animation so it doesn't flash on quick loads
            FadeIn.delay(200)
          }
          exiting={FadeOut}
          style={styles.statusBox}
        >
          {storageInfoQuery.isFetching ? (
            <ActivityIndicator />
          ) : (
            storageInfoQuery.isError ||
            (storageInfoQuery.data == null && (
              <Text>Error loading storage info</Text>
            ))
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

const LINEAR_PROGRESS_HEIGHT = 5;
const styles = StyleSheet.create({
  statusBox: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'hsla(0, 0%, 100%, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  linearProgressBar: {
    height: LINEAR_PROGRESS_HEIGHT,
    width: '100%',
    borderRadius: 5,
    overflow: 'hidden',
  },
  linearProgressUsed: {
    height: '100%',
    borderTopRightRadius: LINEAR_PROGRESS_HEIGHT / 2,
    borderBottomRightRadius: LINEAR_PROGRESS_HEIGHT / 2,
  },
});
