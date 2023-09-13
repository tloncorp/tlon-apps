type Action = 'copy';

export const isNativeApp = () => !!window.ReactNativeWebView;

const postJSONToNativeApp = (obj: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));

export const postActionToNativeApp = (action: Action, value: unknown) =>
  postJSONToNativeApp({ action, value });

export const isIOSWebView = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    isNativeApp() &&
    /(iphone|ipod|ipad).*applewebkit/.test(userAgent) &&
    !/safari/.test(userAgent)
  );
};

export const useSafeAreaInsets = () =>
  // The native app injects safe area insets provided by `react-native-safe-area-context`
  // If they're not present, we assume we're running in the browser, in which case we don't have
  // to worry about 'em.
  window.safeAreaInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
