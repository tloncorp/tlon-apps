import { useSafeAreaContext } from './SafeAreaContext';

type Action = 'copy' | 'logout' | 'manageAccount' | 'appLoaded';

export const isNativeApp = () => !!window.ReactNativeWebView;

const postJSONToNativeApp = (obj: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));

export const postActionToNativeApp = (action: Action, value?: unknown) =>
  postJSONToNativeApp({ action, value });

export const isIOSWebView = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    isNativeApp() &&
    /(iphone|ipod|ipad).*applewebkit/.test(userAgent) &&
    !/safari/.test(userAgent)
  );
};

export const useSafeAreaInsets = () => useSafeAreaContext().safeAreaInsets;
