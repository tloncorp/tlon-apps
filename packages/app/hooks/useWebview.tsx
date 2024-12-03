import { type Ref } from 'react';
import type WebView from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

export const useWebView = ():
  | (WebViewProps & {
      ref: Ref<WebView>;
    })
  | null => {
  return null;
};
