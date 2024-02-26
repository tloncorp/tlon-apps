import {
  MobileNavTab,
  NativeCommand,
  WebAppAction,
  parseActiveTab,
} from '@tloncorp/shared';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSafeAreaContext } from './SafeAreaContext';

export const isNativeApp = () => !!window.ReactNativeWebView;

const postJSONToNativeApp = (obj: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));

export const postActionToNativeApp = (action: WebAppAction, value?: unknown) =>
  postJSONToNativeApp({ action, value });

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
  const [activeTab, setActiveTab] = useState<MobileNavTab>(
    parseActiveTab(location.pathname)
  );

  // Handle any events passed in from the native app
  const messageHandler = window.addEventListener('message', (event) => {
    const message = JSON.parse(event.data) as NativeCommand;
    if (message.action === 'goto') {
      navigate(message.path);
    }
  });

  // Signal any changes in the active tab to the native app
  useEffect(() => {
    const parsedTab = parseActiveTab(location.pathname);
    if (parsedTab !== activeTab) {
      setActiveTab(parsedTab);
      postActionToNativeApp('activeTabChange', parsedTab);
    }
  }, [activeTab, location]);

  return messageHandler;
}
