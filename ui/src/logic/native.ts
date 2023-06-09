export const isNativeApp = () => !!window.ReactNativeWebView;

export const postJSONToNativeApp = (obj: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));
