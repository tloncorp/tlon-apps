type Action = 'copy';

export const isNativeApp = () => !!window.ReactNativeWebView;

const postJSONToNativeApp = (obj: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(obj));

export const postActionToNativeApp = (action: Action, value: unknown) =>
  postJSONToNativeApp({ action, value });
