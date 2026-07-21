import { describe, expect, it } from 'vitest';

import {
  getChannelConnectionStatusText,
  getChannelHeaderLoadingSubtitle,
} from './ChannelHeader.helpers';

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
