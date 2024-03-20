import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { WebView } from 'react-native-webview';

import { useWebviewPositionContext } from '../contexts/webview/position';
import { useWebView } from '../hooks/useWebView';
import type { WebViewStackParamList } from '../types';

type Props = NativeStackScreenProps<WebViewStackParamList, 'ExternalWebView'>;

export const ExternalWebViewScreen = ({
  route: {
    params: { uri, headers, injectedJavaScript },
  },
}: Props) => {
  const webViewProps = useWebView();
  const webviewPosition = useWebviewPositionContext();

  useEffect(() => {
    webviewPosition.setVisibility(false);
    return () => {
      webviewPosition.setVisibility(true);
    };
  }, []);

  return (
    <WebView
      {...webViewProps}
      source={{
        uri,
        headers,
      }}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
    />
  );
};
