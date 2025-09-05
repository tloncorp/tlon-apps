import { useMemo, useEffect, useState } from 'react';
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


export function useSyncStatus() {
  const connectionStatus = store.useConnectionStatus();
  const session = store.useCurrentSession();
  const headsSyncedAt = db.headsSyncedAt.useValue();
  const changesSyncedAt = db.changesSyncedAt.useValue();
  const lastEventReceivedAt = db.lastEventReceivedAt.useValue();
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
      const interval = elapsedTime < fifteenMinutes ? threeMinutes : thirtyMinutes;
      
      return setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
        scheduleRefresh();
      }, interval);
    };
    
    const timeoutId = scheduleRefresh();
    
    return () => clearTimeout(timeoutId);
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
    const syncTimes = [sessionStartTime, headsSyncedAt, changesSyncedAt ?? 0, lastEventReceivedAt].filter(time => time > 0);
    
    if (syncTimes.length > 0) {
      const mostRecentSync = Math.max(...syncTimes);
      const formattedTime = formatTimeAgo(mostRecentSync);
      return `Connected • Last sync ${formattedTime}`;
    }
    return 'Connected • Sync pending...';
    // refreshTrigger is needed to force periodic updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, session, headsSyncedAt, changesSyncedAt, lastEventReceivedAt, refreshTrigger]);

  const mostRecentSyncTime = useMemo(() => {
    const syncTimes = [session?.startTime ?? 0, headsSyncedAt, changesSyncedAt ?? 0, lastEventReceivedAt].filter(time => time > 0);
    return syncTimes.length > 0 ? Math.max(...syncTimes) : 0;
  }, [session?.startTime, headsSyncedAt, changesSyncedAt, lastEventReceivedAt]);

  return {
    connectionStatus,
    lastSyncTime: mostRecentSyncTime,
    subtitle,
  };
}