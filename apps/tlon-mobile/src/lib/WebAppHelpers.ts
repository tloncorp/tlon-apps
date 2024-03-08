import type { NativeCommand } from '@tloncorp/shared';
import type React from 'react';
import type WebView from 'react-native-webview';

import type { TabName } from '../types';

export default {
  sendCommand,
};

export function getInitialPath(tab: TabName): string {
  if (tab === 'Groups') {
    return '/';
  }

  if (tab === 'Messages') {
    return '/messages';
  }

  if (tab === 'Activity') {
    return '/notifications';
  }

  if (tab === 'Profile') {
    return '/profile';
  }

  return '/';
}

function sendCommand(ref: React.RefObject<WebView>, command: NativeCommand) {
  ref.current?.postMessage(JSON.stringify(command));
}
