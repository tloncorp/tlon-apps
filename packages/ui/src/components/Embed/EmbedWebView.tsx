import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from 'tamagui';

import { SkeletonLoader } from './SkeletonLoader';
import { EmbedProviderConfig } from './providers';

interface EmbedWebViewProps {
  url: string;
  provider: EmbedProviderConfig;
  embedHtml?: string;
  onHeightChange?: (height: number) => void;
  onError?: (error: any) => void;
}

export const EmbedWebView: React.FC<EmbedWebViewProps> = ({
  url,
  provider,
  embedHtml,
  onHeightChange,
  onError,
}) => {
  const primaryBackground = useTheme().background.val;
  const [isLoading, setIsLoading] = useState(true);
  const [webViewHeight, setWebViewHeight] = useState(provider.defaultHeight);
  const webViewRef = useRef<WebView>(null);

  if (!embedHtml || !url) {
    return null;
  }
  const html = provider.generateHtml(url, embedHtml);

  return (
    <>
      {isLoading && (
        <SkeletonLoader
          height={provider.defaultHeight}
          width={provider.defaultWidth}
        />
      )}
      <WebView
        style={[
          {
            height: webViewHeight,
            width: provider.defaultWidth,
            backgroundColor: primaryBackground,
          },
          isLoading && {
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
          },
        ]}
        source={{ html }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height) {
              setWebViewHeight(data.height);
              onHeightChange?.(data.height);
              setIsLoading(false);
            }
          } catch (e) {
            console.warn('Failed to parse WebView message:', e);
          }
        }}
        automaticallyAdjustContentInsets={false}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        onError={(syntheticEvent) => {
          setIsLoading(false);
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
          onError?.(nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn(
            `WebView received error status code: ${nativeEvent.statusCode}`
          );
        }}
        onNavigationStateChange={(navState) => {
          if (navState.url !== 'about:blank') {
            webViewRef.current?.stopLoading();
            Linking.openURL(navState.url);
            return false;
          }
          return true;
        }}
        ref={webViewRef}
      />
    </>
  );
};
