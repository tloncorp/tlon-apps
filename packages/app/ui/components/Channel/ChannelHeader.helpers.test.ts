import { describe, expect, it } from 'vitest';

import {
  getChannelConnectionStatusText,
  getChannelHeaderLoadingSubtitle,
  isHostedChannelType,
} from './ChannelHeader.helpers';

describe('isHostedChannelType', () => {
  it.each(['dm', 'groupDm'] as const)(
    'does not treat %s conversations as hosted channels',
    (channelType) => {
      expect(isHostedChannelType(channelType)).toBe(false);
    }
  );

  it.each(['chat', 'notebook', 'notes', 'gallery'] as const)(
    'treats %s channels as hosted channels',
    (channelType) => {
      expect(isHostedChannelType(channelType)).toBe(true);
    }
  );
});

describe('getChannelConnectionStatusText', () => {
  it.each(['Connecting', 'Reconnecting'] as const)(
    'shows Connecting while the client is %s regardless of host reachability',
    (connectionStatus) => {
      expect(getChannelConnectionStatusText(connectionStatus, true)).toBe(
        'Connecting...'
      );
      expect(getChannelConnectionStatusText(connectionStatus, false)).toBe(
        'Connecting...'
      );
    }
  );

  it('shows Channel host offline when the connected server cannot reach the channel host', () => {
    expect(getChannelConnectionStatusText('Connected', true)).toBe(
      'Channel host offline'
    );
  });

  it('returns no connection status when both connection legs are available', () => {
    expect(getChannelConnectionStatusText('Connected', false)).toBeNull();
  });

  it('does not replace the local disconnected status with the channel host status', () => {
    expect(getChannelConnectionStatusText('Disconnected', true)).toBe(
      'Disconnected'
    );
  });
});

describe('getChannelHeaderLoadingSubtitle', () => {
  it('preserves registered loading text ahead of connection status', () => {
    expect(
      getChannelHeaderLoadingSubtitle({
        channelConnectionStatusText: 'Channel host offline',
        loadingSubtitle: 'Loading messages…',
        registeredLoadingSubtitle: 'Syncing...',
        showSpinner: true,
      })
    ).toBe('Syncing...');
  });

  it('prioritizes an end-to-end connection status over message loading', () => {
    expect(
      getChannelHeaderLoadingSubtitle({
        channelConnectionStatusText: 'Connecting...',
        loadingSubtitle: 'Loading messages…',
        registeredLoadingSubtitle: null,
        showSpinner: true,
      })
    ).toBe('Connecting...');
  });
});
