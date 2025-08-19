import { useMemo, useEffect } from 'react';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';

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

// Global timer to ensure all instances of useSyncStatus show the same time
let globalRefreshTimeoutRef: NodeJS.Timeout | null = null;
const globalStartTimeRef: number = Date.now();
let activeHookCount = 0;

function startGlobalRefreshTimer() {
  if (globalRefreshTimeoutRef) return; // Already running
  
  const scheduleNextRefresh = () => {
    const elapsedTime = Date.now() - globalStartTimeRef;
    const fifteenMinutes = 15 * 60 * 1000;
    const threeMinutes = 3 * 60 * 1000;
    const thirtyMinutes = 30 * 60 * 1000;
    
    const interval = elapsedTime < fifteenMinutes ? threeMinutes : thirtyMinutes;
    
    globalRefreshTimeoutRef = setTimeout(() => {
      // Increment the shared counter to trigger all hooks to re-render
      db.syncStatusRefreshCounter.getValue().then(current => {
        db.syncStatusRefreshCounter.setValue(current + 1);
      });
      scheduleNextRefresh();
    }, interval);
  };
  
  scheduleNextRefresh();
}

function stopGlobalRefreshTimer() {
  if (globalRefreshTimeoutRef) {
    clearTimeout(globalRefreshTimeoutRef);
    globalRefreshTimeoutRef = null;
  }
}

export function useSyncStatus() {
  const connectionStatus = store.useConnectionStatus();
  const session = store.useCurrentSession();
  const headsSyncedAt = db.headsSyncedAt.useValue();
  const lastEventReceivedAt = db.lastEventReceivedAt.useValue();
  const refreshCounter = db.syncStatusRefreshCounter.useValue();
  
  // Track active hooks to manage global timer
  useEffect(() => {
    activeHookCount++;
    startGlobalRefreshTimer();
    
    return () => {
      activeHookCount--;
      if (activeHookCount === 0) {
        stopGlobalRefreshTimer();
      }
    };
  }, []);
  
  const subtitle = useMemo(() => {
    // If not connected, show connection status
    if (connectionStatus !== 'Connected') {
      return `${connectionStatus}...`;
    }

    // Connected case - determine the most recent sync time from multiple sources
    const sessionStartTime = session?.startTime ?? 0;
    const syncPhase = session?.phase;
    
    // If we're still in initial sync phases, show syncing
    if (syncPhase === 'init' || syncPhase === 'high' || syncPhase === 'low') {
      return 'Connected • Syncing with node...';
    }
    
    // Find the most recent sync time from available sources
    const syncTimes = [sessionStartTime, headsSyncedAt, lastEventReceivedAt].filter(time => time > 0);
    
    if (syncTimes.length > 0) {
      const mostRecentSync = Math.max(...syncTimes);
      const formattedTime = formatTimeAgo(mostRecentSync);
      return `Connected • Last sync ${formattedTime}`;
    }
    return 'Connected • Sync pending...';
    // refreshCounter is needed to force periodic updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, session, headsSyncedAt, lastEventReceivedAt, refreshCounter]);

  const mostRecentSyncTime = useMemo(() => {
    const syncTimes = [session?.startTime ?? 0, headsSyncedAt, lastEventReceivedAt].filter(time => time > 0);
    return syncTimes.length > 0 ? Math.max(...syncTimes) : 0;
  }, [session?.startTime, headsSyncedAt, lastEventReceivedAt]);

  return {
    connectionStatus,
    lastSyncTime: mostRecentSyncTime,
    subtitle,
  };
}