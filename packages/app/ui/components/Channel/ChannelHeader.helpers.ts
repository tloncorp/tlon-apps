import type * as db from '@tloncorp/shared/db';

export function isHostedChannelType(channelType: db.Channel['type']): boolean {
  return channelType !== 'dm' && channelType !== 'groupDm';
}

export function getChannelConnectionStatusText(
  connectionStatus: string,
  isChannelHostOffline: boolean
): string | null {
  if (
    connectionStatus === 'Connecting' ||
    connectionStatus === 'Reconnecting'
  ) {
    return 'Connecting...';
  }

  if (connectionStatus === 'Connected') {
    return isChannelHostOffline ? 'Channel host offline' : null;
  }

  return connectionStatus === 'Idle' ? 'Initializing...' : 'Disconnected';
}

export function getChannelHeaderLoadingSubtitle({
  channelConnectionStatusText,
  loadingSubtitle,
  registeredLoadingSubtitle,
  showSpinner,
}: {
  channelConnectionStatusText: string | null;
  loadingSubtitle: string | null;
  registeredLoadingSubtitle: string | null;
  showSpinner: boolean | undefined;
}): string | null {
  return (
    registeredLoadingSubtitle ??
    channelConnectionStatusText ??
    (showSpinner ? loadingSubtitle : null)
  );
}
