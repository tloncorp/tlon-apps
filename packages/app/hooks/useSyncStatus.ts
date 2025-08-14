import { useMemo } from 'react';
import * as db from '@tloncorp/shared/db';
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
  const headsSyncedAt = db.headsSyncedAt.useValue();

  const subtitle = useMemo(() => {
    if (connectionStatus === 'Connected') {
      const lastSyncTime = formatTimeAgo(headsSyncedAt);
      return `Connected • Last synced ${lastSyncTime}`;
    } else {
      // Show connection status when not connected (Connecting, Reconnecting, etc.)
      return `${connectionStatus}...`;
    }
  }, [connectionStatus, headsSyncedAt]);

  return {
    connectionStatus,
    lastSyncTime: headsSyncedAt,
    subtitle,
  };
}