import { useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from 'tamagui';

import { useIsDarkTheme } from '../../utils';
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
  onError,
}) => {
  const primaryBackground = useTheme().background.val;
  const [isLoading, setIsLoading] = useState(true);
  const [webViewHeight, setWebViewHeight] = useState(provider.defaultHeight);
  const webViewRef = useRef<WebView>(null);
  const lastHeightRef = useRef(provider.defaultHeight);
  const isDark = useIsDarkTheme();
  if (!embedHtml || !url) {
    return null;
  }

  // Inject background color into the HTML
  const baseHtml = provider.generateHtml(url, embedHtml, isDark);
  const html = baseHtml.replace(
    '<style>',
    `<style>
      :root { background-color: ${primaryBackground} !important; }
      html, body { background-color: ${primaryBackground} !important; }`
  );

  return (
    <>
      {isLoading && (
        <SkeletonLoader
          height={provider.defaultHeight}
          width={provider.defaultWidth}
        />
      )}
      <View
        style={[
          {
            width: provider.defaultWidth,
            height: webViewHeight,
            backgroundColor: primaryBackground,
          },
          Platform.OS === 'android' && {
            minHeight: provider.defaultHeight,
          },
        ]}
        onLayout={
          Platform.OS === 'android'
            ? (event) => {
                const { height } = event.nativeEvent.layout;
                if (height !== webViewHeight) {
                  requestAnimationFrame(() => {
                    setWebViewHeight(height);
                  });
                }
              }
            : undefined
        }
      >
        <WebView
          key={`webview-${webViewHeight}`}
          style={{
            width: '100%',
            height: '100%',
            opacity: isLoading ? 0 : 1,
            backgroundColor: primaryBackground,
          }}
          source={{ html }}
          androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
          overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.height) {
                const heightDiff = Math.abs(
                  data.height - lastHeightRef.current
                );
                // Only update twitter height if height difference is more than 5 pixels
                // This is to prevent infinite loop of height changes that can apparently happen
                // with Twitter embeds
                if (provider.name === 'Twitter' && heightDiff > 5) {
                  lastHeightRef.current = data.height;
                  setWebViewHeight(data.height);
                  setIsLoading(false);
                } else if (provider.name !== 'Twitter') {
                  setWebViewHeight(data.height);
                  setIsLoading(false);
                }
              }
            } catch (e) {
              console.warn('Failed to parse WebView message:', e);
            }
          }}
          automaticallyAdjustContentInsets={false}
          scrollEnabled={Platform.select({
            ios: false,
            android: true,
          })}
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
      </View>
    </>
  );
};
