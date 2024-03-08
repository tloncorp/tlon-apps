import {
  MobileNavTab,
  NativeCommand,
  WebAppAction,
  WebAppCommand,
  parseActiveTab,
} from '@tloncorp/shared';
import _, { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSafeAreaContext } from './SafeAreaContext';

export const isNativeApp = () => !!window.ReactNativeWebView;

const postJSONToNativeApp = (obj: Record<string, unknown>) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
};

export const postActionToNativeApp = (action: WebAppAction, value?: unknown) =>
  postJSONToNativeApp({ action, value });

export const postCommandToNativeApp = (command: WebAppCommand) => {
  postJSONToNativeApp({ action: command.action, value: command.value });
};

export const isIOSWebView = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    isNativeApp() &&
    /(iphone|ipod|ipad).*applewebkit/.test(userAgent) &&
    !/safari/.test(userAgent)
  );
};

export const isSafari = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /^((?!chrome|android).)*safari/i.test(userAgent);
};

export const isAndroidWebView = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return isNativeApp() && /android/.test(userAgent);
};

export const useSafeAreaInsets = () => useSafeAreaContext().safeAreaInsets;

export function useNativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  const [activeNativeTab, setActiveNativeTab] = useState<MobileNavTab>(
    parseActiveTab(location.pathname) ?? 'Groups'
  );

  const debouncedSaveLastPath = useMemo(
    () =>
      debounce((parsedTab, path) => {
        postCommandToNativeApp({
          action: 'saveLastPath',
          value: { tab: parsedTab, path },
        });
      }, 400),
    []
  );

  // Handle any events passed in from the native app
  const messageHandler = window.addEventListener('message', (event) => {
    if (!isNativeApp()) return;
    const message = JSON.parse(event.data) as NativeCommand;
    if (message.action === 'goto') {
      const activeTab = parseActiveTab(message.path);
      setActiveNativeTab(activeTab ?? 'Groups');
      navigate(message.path);
    }

    if (message.action === 'nativeTabChange') {
      setActiveNativeTab(message.tab);
    }
  });

  // Send any relevant location changes to the native app
  useEffect(() => {
    if (!isNativeApp()) return;

    // Signal if the active tab was changed within the webview itself
    const hasBackgroundLocation = location.state?.backgroundLocation;
    const parsedTab = hasBackgroundLocation
      ? parseActiveTab(location.state.backgroundLocation.pathname)
      : parseActiveTab(location.pathname);
    if (parsedTab !== activeNativeTab) {
      postActionToNativeApp('activeTabChange', parsedTab);
    }

    // Signal if the last Groups or Messages path changed for use when navigating back to a tab
    if (
      location.pathname !== lastPath &&
      !hasBackgroundLocation &&
      (parsedTab === 'Groups' || parsedTab === 'Messages')
    ) {
      debouncedSaveLastPath(parsedTab, location.pathname);
      setLastPath(location.pathname);
    }
  }, [activeNativeTab, debouncedSaveLastPath, lastPath, location]);

  return messageHandler;
}
