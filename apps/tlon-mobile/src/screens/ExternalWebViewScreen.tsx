import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';

import { useWebView } from '../hooks/useWebView';
import type { MainStackParamList } from '../types';

type Props = NativeStackScreenProps<MainStackParamList, 'ExternalWebView'>;

export const ExternalWebViewScreen = ({
  route: {
    params: { uri, headers, injectedJavaScript },
  },
}: Props) => {
  const webViewProps = useWebView();

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
