import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Query, useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { formatCount, formatMemorySize } from '@tloncorp/shared/utils';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import {
  StorageInfo,
  useStorageInfoQuery,
} from '../../ui/components/StorageQuotaIndicator';
import { RETRY_INTERVAL_MS } from './bot/constants';
import { useBotSettingsIds } from './bot/useBotSettingsData';
import { useHostingSession } from './bot/useHostingSession';

/**
 * Values for the Settings usage rows: hosted storage, and the tokens the bot
 * has used this month. A row whose label is undefined is left out.
 */
export function useSettingsUsageLabels() {
  const isHostedUser = api.getCurrentUserIsHosted();
  const storageInfoQuery = useStorageInfoQuery();

  const { ship } = useBotSettingsIds();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const hostingSession = useHostingSession();
  // Token usage comes from the hosting API, which web has no session for.
  const showsTokenUsage =
    Platform.OS !== 'web' &&
    isHostedUser &&
    hostingBotEnabled &&
    hostingSession === 'valid' &&
    Boolean(ship);
  const isFocused = useIsFocused();
  const tokenUsageQuery = useQuery({
    queryKey: ['tlonbot', 'token-usage', ship],
    queryFn: () => api.getTlawnTokenUsage(ship),
    enabled: showsTokenUsage,
    retry: false,
    refetchInterval: pollUnfinishedTokenUsage(isFocused),
  });

  // Settings stays mounted, so each visit asks again rather than showing
  // what the first one found. refetch ignores `enabled`, hence the checks.
  const { refetch: refetchStorage } = storageInfoQuery;
  const { refetch: refetchTokenUsage } = tokenUsageQuery;
  useFocusEffect(
    useCallback(() => {
      if (isHostedUser) void refetchStorage({ cancelRefetch: false });
      if (showsTokenUsage) void refetchTokenUsage({ cancelRefetch: false });
    }, [isHostedUser, refetchStorage, refetchTokenUsage, showsTokenUsage])
  );

  return {
    storageLabel: isHostedUser ? getStorageLabel(storageInfoQuery) : undefined,
    tokenUsageLabel: showsTokenUsage
      ? getTokenUsageLabel(tokenUsageQuery)
      : undefined,
  };
}

export function getStorageLabel(query: {
  data?: StorageInfo | null;
  isError: boolean;
}): string | undefined {
  if (query.isError) {
    return 'Unavailable';
  }
  if (query.data === undefined) {
    return 'Checking…';
  }
  // Null: uploads go to the user's own S3 bucket, or nowhere.
  if (!query.data) {
    return undefined;
  }
  if (query.data.totalBytes === 0) {
    return 'None';
  }
  return `${formatStorageSize(query.data.usedBytes)} of ${formatStorageSize(query.data.totalBytes)}`;
}

// formatMemorySize picks the unit ("40mb"); this row writes it as "40 MB".
function formatStorageSize(bytes: number) {
  return formatMemorySize(bytes).replace(
    /[a-z]+$/,
    (unit) => ` ${unit.toUpperCase()}`
  );
}

// OpenClaw finishes an unfinished count in the background, so Settings asks
// again until it is fresh. A busy bot's sessions can keep it unfinished, and
// then this polls for as long as Settings is on screen. A failed read stops
// it until the next visit.
export function pollUnfinishedTokenUsage(isFocused: boolean) {
  return (query: Query<api.TlawnTokenUsage, Error>) =>
    isFocused &&
    query.state.status === 'success' &&
    !isCounted(query.state.data?.cacheStatus)
      ? RETRY_INTERVAL_MS
      : false;
}

function isCounted(cacheStatus: api.TlawnTokenUsage['cacheStatus']) {
  return (cacheStatus?.status ?? 'fresh') === 'fresh';
}

export function getTokenUsageLabel(query: {
  data?: api.TlawnTokenUsage;
  error: unknown;
}): string | undefined {
  if (query.data) {
    // A session that changed since OpenClaw last read it still counts at its
    // old total, so an unfinished count is close. One that was never read
    // counts nothing, so a zero is only real once the count is fresh.
    const { totals, cacheStatus } = query.data;
    return totals.totalTokens === 0 && !isCounted(cacheStatus)
      ? 'Counting…'
      : formatCount(totals.totalTokens).text;
  }
  if (query.error) {
    // 404: hosting predates the endpoint. 409: the bot doesn't run on
    // OpenClaw, the only runtime that records usage.
    const status =
      query.error instanceof api.HostingError
        ? query.error.details.status
        : null;
    return status === 404 || status === 409 ? undefined : 'Unavailable';
  }
  return 'Checking…';
}
