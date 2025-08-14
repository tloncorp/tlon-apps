import { useMemo } from 'react';
import * as store from '@tloncorp/shared/store';

function formatTimeAgo(timestamp: number): string {
  if (timestamp === 0) {
    return 'Never synced';
  }

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} mins ago`;
  } else if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
}

export function useSyncStatus() {
  const connectionStatus = store.useConnectionStatus();
  const session = store.useCurrentSession();
  
  // Use session start time as the "last sync" time since that's when we 
  // established the current connection and started receiving live data
  const lastSyncTime = session?.startTime ?? 0;

  const subtitle = useMemo(() => {
    if (connectionStatus === 'Connected') {
      if (lastSyncTime === 0) {
        return 'Connected • Sync pending...';
      }
      const formattedTime = formatTimeAgo(lastSyncTime);
      return `Connected • Last sync ${formattedTime}`;
    } else {
      // Show connection status when not connected (Connecting, Reconnecting, etc.)
      return `${connectionStatus}...`;
    }
  }, [connectionStatus, lastSyncTime]);

  return {
    connectionStatus,
    lastSyncTime,
    subtitle,
  };
}