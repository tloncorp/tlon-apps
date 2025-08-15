import { useMemo, useEffect, useRef, useState } from 'react';
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
  const lastEventReceivedAt = db.lastEventReceivedAt.useValue();
  
  // State for forcing updates to refresh the "time ago" text
  const [refreshCounter, setRefreshCounter] = useState(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  
  // Progressive refresh schedule: 3 minutes for first 15 minutes, then 30 minutes
  useEffect(() => {
    const scheduleNextRefresh = () => {
      const elapsedTime = Date.now() - startTimeRef.current;
      const fifteenMinutes = 15 * 60 * 1000;
      const threeMinutes = 3 * 60 * 1000;
      const thirtyMinutes = 30 * 60 * 1000;
      
      const interval = elapsedTime < fifteenMinutes ? threeMinutes : thirtyMinutes;
      
      refreshTimeoutRef.current = setTimeout(() => {
        setRefreshCounter(prev => prev + 1);
        scheduleNextRefresh();
      }, interval);
    };
    
    scheduleNextRefresh();
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
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