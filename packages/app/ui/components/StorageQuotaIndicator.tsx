import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { getStorageQuota } from '@tloncorp/shared';
import { getObjectStorageMethod } from '@tloncorp/shared/store';
import { convert } from '@tloncorp/shared/utils';
import { ForwardingProps, Pressable, Text, View } from '@tloncorp/ui';
import { clamp } from 'lodash';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
}

namespace StorageInfo {
  export const empty: StorageInfo = {
    totalBytes: 0,
    usedBytes: 0,
  };
}

/** @returns null when we don't have storage info (e.g. using custom-s3 or no storage), otherwise `StorageInfo` */
export function useStorageInfoQuery() {
  return useQuery({
    queryKey: ['storage-info'],
    queryFn: async (): Promise<StorageInfo | null> => {
      switch (await getObjectStorageMethod()) {
        // if using custom-s3 or no storage, we don't have quota info
        case null:
        case 'custom-s3':
          return null;

        case 'hosting':
          return await getStorageQuota();
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
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
            width:
              ratio === -Infinity
                ? 0
                : `${clamp(ratio * 100, 0, 100).toFixed(5)}%`,
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

export function StorageQuotaIndicator({
  style,
  storageInfoQuery,
  ...forwardedProps
}: ForwardingProps<
  typeof View,
  {
    storageInfoQuery: UseQueryResult<StorageInfo | null>;
  }
>) {
  const successContentOpacity =
    // hide content if we don't have data or we're showing an error
    storageInfoQuery.data == null || storageInfoQuery.isError
      ? 0
      : // dim content if we're showing the loading indicator
        storageInfoQuery.isFetching
        ? 0.1
        : 1;

  return (
    <Pressable
      gap={10}
      position="relative"
      onPress={() => storageInfoQuery.refetch()}
      style={style}
      {...forwardedProps}
    >
      <StorageQuotaTextualProgress
        storageInfo={storageInfoQuery.data ?? StorageInfo.empty}
        opacity={successContentOpacity}
      />
      <StorageQuotaLinearProgress
        storageInfo={storageInfoQuery.data ?? StorageInfo.empty}
        opacity={successContentOpacity}
      />

      {storageInfoQuery.isFetching && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.statusBox}
        >
          <ActivityIndicator />
        </Animated.View>
      )}
      {storageInfoQuery.isError && !storageInfoQuery.isFetching && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.statusBox}
        >
          <View alignItems="center" gap="$xs">
            <Text>Could not fetch storage availability</Text>
            {storageInfoQuery.error instanceof Error && (
              <Text opacity={0.5} numberOfLines={2}>
                Error: {storageInfoQuery.error.message}
              </Text>
            )}
          </View>
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
