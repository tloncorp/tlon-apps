import { LoadingSpinner } from '@tloncorp/ui';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Linking,
  Platform,
  ViewStyle,
} from 'react-native';
import WebView from 'react-native-webview';
import { View, getTokenValue, useTheme } from 'tamagui';

import { useIsDarkTheme } from '../../utils';
import { EmbedProviderConfig } from './providers';

const IS_ANDROID = Platform.OS === 'android';
const ANDROID_LAYER_TYPE = IS_ANDROID ? 'hardware' : undefined;
const ANDROID_OVERSCROLL_MODE = IS_ANDROID ? 'never' : undefined;
const SCROLL_ENABLED = IS_ANDROID;
const MAX_HEIGHT_PERCENT = 0.6;

interface EmbedWebViewProps {
  url: string;
  provider: EmbedProviderConfig;
  embedHtml?: string;
  onHeightChange?: (height: number) => void;
  onError?: (error: any) => void;
}

interface WebViewMessageData {
  height?: number;
  loaded?: boolean;
}

export const EmbedWebView = memo<EmbedWebViewProps>(
  ({ url, provider, embedHtml, onError }) => {
    const primaryBackground = useTheme().background.val;
    const [isLoading, setIsLoading] = useState(true);
    const [hideTweetMedia, setHideTweetMedia] = useState(false);
    const [webViewHeight, setWebViewHeight] = useState(provider.defaultHeight);
    const webViewRef = useRef<WebView>(null);
    const lastHeightRef = useRef(provider.defaultHeight);
    const heightUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDark = useIsDarkTheme();
    const borderRadiusVal = getTokenValue('$s');

    const maxAllowedHeight = useMemo(() => {
      const { height: screenHeight } = Dimensions.get('window');
      const maxHeight = screenHeight * MAX_HEIGHT_PERCENT;

      return Math.max(maxHeight, provider.defaultHeight);
    }, [provider.defaultHeight]);

    const setDebouncedWebViewHeight = useCallback(
      (height: number) => {
        if (heightUpdateTimerRef.current) {
          clearTimeout(heightUpdateTimerRef.current);
        }

        heightUpdateTimerRef.current = setTimeout(() => {
          const heightDiff = Math.abs(height - webViewHeight);
          if (heightDiff > 25) {
            setWebViewHeight(height);
          }
        }, 100);
      },
      [webViewHeight]
    );

    useEffect(() => {
      return () => {
        if (heightUpdateTimerRef.current) {
          clearTimeout(heightUpdateTimerRef.current);
        }
      };
    }, []);

    const html = useMemo(() => {
      if (!embedHtml || !url) {
        return '';
      }
      const baseHtml = provider.generateHtml(
        url,
        embedHtml,
        isDark,
        hideTweetMedia
      );
      return baseHtml.replace(
        '<style>',
        `<style>
        :root { background-color: ${primaryBackground} !important; }
        html, body { background-color: ${primaryBackground} !important; }`
      );
    }, [url, embedHtml, isDark, primaryBackground, provider, hideTweetMedia]);

    const containerStyle = useMemo(
      () => (IS_ANDROID ? [{ minHeight: provider.defaultHeight }] : []),
      [provider.defaultHeight]
    );

    const webViewStyle = useMemo(
      (): ViewStyle => ({
        width: '100%',
        height: '100%',
        opacity: isLoading ? 0 : 1,
        backgroundColor: primaryBackground,
        borderRadius: borderRadiusVal,
      }),
      [isLoading, primaryBackground, borderRadiusVal]
    );

    const onLayoutHandler = useCallback(
      (event: LayoutChangeEvent) => {
        if (!IS_ANDROID) return;
        const { height } = event.nativeEvent.layout;
        if (height !== webViewHeight) {
          requestAnimationFrame(() => {
            setWebViewHeight(height);
          });
        }
      },
      [webViewHeight]
    );

    const onMessageHandler = useCallback(
      (event: any) => {
        try {
          const data = JSON.parse(event.nativeEvent.data) as WebViewMessageData;
          if (data.height) {
            if (provider.name === 'Twitter') {
              if (data.loaded) {
                if (data.height > 0) {
                  if (data.height > maxAllowedHeight) {
                    setHideTweetMedia(true);
                  }
                  lastHeightRef.current = data.height;
                  setDebouncedWebViewHeight(data.height);
                  setIsLoading(false);
                }
              }
              // For height updates, use more conservative approach to avoid loops
              else {
                const heightDiff = Math.abs(
                  data.height - lastHeightRef.current
                );
                // Only update height if it's a significant change, non-zero,
                // and different from the last reported height
                if (
                  heightDiff > 25 &&
                  data.height > 0 &&
                  data.height !== lastHeightRef.current
                ) {
                  lastHeightRef.current = data.height;
                  setDebouncedWebViewHeight(data.height);
                }
              }
            } else {
              // For other providers, use the simple approach
              setDebouncedWebViewHeight(data.height);
              setIsLoading(false);
            }
          }
        } catch (e) {
          console.warn('Failed to parse WebView message:', e);
        }
      },
      [provider.name, setDebouncedWebViewHeight, maxAllowedHeight]
    );

    const onErrorHandler = useCallback(
      (event: any) => {
        setIsLoading(false);
        const { nativeEvent } = event;
        console.warn('WebView error: ', nativeEvent);
        onError?.(nativeEvent);
      },
      [onError]
    );

    const onHttpErrorHandler = useCallback((event: any) => {
      const { nativeEvent } = event;
      console.warn(
        `WebView received error status code: ${nativeEvent.statusCode}`
      );
    }, []);

    const onNavigationStateChangeHandler = useCallback(
      (navState: { url: string }) => {
        if (navState.url !== 'about:blank') {
          webViewRef.current?.stopLoading();
          Linking.openURL(navState.url);
          return false;
        }
        return true;
      },
      []
    );

    if (!embedHtml || !url) {
      return null;
    }

    return (
      <>
        {isLoading && (
          <View
            width={provider.defaultWidth}
            height={provider.defaultHeight}
            backgroundColor="$secondaryBackground"
            justifyContent="center"
            alignItems="center"
            borderRadius="$s"
          >
            <LoadingSpinner />
          </View>
        )}
        <View
          width={provider.defaultWidth}
          height={webViewHeight}
          backgroundColor={primaryBackground}
          borderRadius="$s"
          style={containerStyle}
          onLayout={onLayoutHandler}
        >
          <WebView
            style={webViewStyle}
            source={{ html }}
            androidLayerType={ANDROID_LAYER_TYPE}
            overScrollMode={ANDROID_OVERSCROLL_MODE}
            onMessage={onMessageHandler}
            automaticallyAdjustContentInsets={false}
            scrollEnabled={SCROLL_ENABLED}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            onError={onErrorHandler}
            onHttpError={onHttpErrorHandler}
            onNavigationStateChange={onNavigationStateChangeHandler}
            ref={webViewRef}
          />
        </View>
      </>
    );
  }
);

EmbedWebView.displayName = 'EmbedWebView';
