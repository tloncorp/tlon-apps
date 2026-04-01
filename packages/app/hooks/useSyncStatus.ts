import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useRef, useState } from 'react';

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
  } else if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
}

export function useSyncStatus() {
  const connectionStatus = store.useConnectionStatus();
  const session = store.useCurrentSession();
  const lastActivityAt = db.lastActivityAt.useValue();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Set up periodic refresh for time display updates
  useEffect(() => {
    const startTime = Date.now();

    const scheduleRefresh = () => {
      const elapsedTime = Date.now() - startTime;
      const fifteenMinutes = 15 * 60 * 1000;
      const threeMinutes = 3 * 60 * 1000;
      const thirtyMinutes = 30 * 60 * 1000;

      // More frequent updates in the first 15 minutes, then less frequent
      const interval =
        elapsedTime < fifteenMinutes ? threeMinutes : thirtyMinutes;

      return setTimeout(() => {
        setRefreshTrigger((prev) => prev + 1);
        scheduleRefresh();
      }, interval);
    };

    const timeoutId = scheduleRefresh();

    return () => clearTimeout(timeoutId);
  }, []);

  const mostRecentSyncTime = useMemo(() => {
    const syncTimes = [session?.startTime ?? 0, lastActivityAt].filter(
      (time) => time > 0
    );
    return syncTimes.length > 0 ? Math.max(...syncTimes) : 0;
  }, [session?.startTime, lastActivityAt]);

  const subtitle = useMemo(() => {
    // If not connected, show connection status
    if (connectionStatus !== 'Connected') {
      return `${connectionStatus}...`;
    }

    // If we're still in initial sync phases, show syncing
    if (
      session?.phase === 'init' ||
      session?.phase === 'high' ||
      session?.phase === 'low'
    ) {
      return 'Connected • Syncing with node...';
    }

    // Show most recent sync time
    if (mostRecentSyncTime > 0) {
      const formattedTime = formatTimeAgo(mostRecentSyncTime);
      return `Connected • Last sync ${formattedTime}`;
    }
    return 'Connected • Sync pending...';
    // refreshTrigger is needed to force periodic updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, session?.phase, mostRecentSyncTime, refreshTrigger]);

  // When isSyncing clears, hold loading state briefly so changes can repaint
  // the chat list with the new data before the header resolves.
  const [deferredSyncing, setDeferredSyncing] = useState(false);
  const wasSyncingRef = useRef(false);
  useEffect(() => {
    const isSyncing = session?.isSyncing ?? false;
    if (wasSyncingRef.current && !isSyncing) {
      // sync just finished — hold loading briefly so the chat list can
      // refetch from DB and repaint before the header resolves
      setDeferredSyncing(true);
      const timer = setTimeout(() => {
        setDeferredSyncing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    wasSyncingRef.current = isSyncing;
  }, [session?.isSyncing]);

  const showSyncing = (session?.isSyncing ?? false) || deferredSyncing;

  const loadingSubtitle = useMemo(() => {
    if (connectionStatus !== 'Connected') {
      return `${connectionStatus}...`;
    }
    if (showSyncing) {
      return 'Syncing with node...';
    }
    return null;
  }, [showSyncing, connectionStatus]);

  return {
    connectionStatus,
    lastSyncTime: mostRecentSyncTime,
    subtitle,
    loadingSubtitle,
  };
}
