import { createDevLogger } from '@tloncorp/shared';
import { LoadingSpinner } from '@tloncorp/ui';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
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

const logger = createDevLogger('EmbedWebView', false);

const IS_ANDROID = Platform.OS === 'android';
const ANDROID_LAYER_TYPE = IS_ANDROID ? 'hardware' : undefined;
const ANDROID_OVERSCROLL_MODE = IS_ANDROID ? 'never' : undefined;
const SCROLL_ENABLED = IS_ANDROID;
const MAX_HEIGHT_PERCENT = 0.6;

interface EmbedWebViewProps {
  url: string;
  provider: EmbedProviderConfig;
  embedHtml?: string;
  embedHeight?: number;
  onHeightChange?: (height: number) => void;
  onError?: (error: any) => void;
}

interface WebViewMessageData {
  height?: number;
  loaded?: boolean;
}

type WebViewState = {
  isLoading: boolean;
  hideTweetMedia: boolean;
  webViewHeight: number;
};

type WebViewAction =
  | { type: 'HIDE_MEDIA' }
  | { type: 'SET_HEIGHT'; height: number }
  | { type: 'LOADING_COMPLETE' }
  | { type: 'HIDE_MEDIA_AND_UPDATE_HEIGHT'; height: number }
  | { type: 'UPDATE_HEIGHT_AND_COMPLETE'; height: number };

function webViewReducer(
  state: WebViewState,
  action: WebViewAction
): WebViewState {
  switch (action.type) {
    case 'HIDE_MEDIA':
      return { ...state, isLoading: false, hideTweetMedia: true };
    case 'SET_HEIGHT':
      return { ...state, webViewHeight: action.height };
    case 'LOADING_COMPLETE':
      return { ...state, isLoading: false };
    case 'HIDE_MEDIA_AND_UPDATE_HEIGHT':
      return {
        ...state,
        hideTweetMedia: true,
        webViewHeight: action.height,
      };
    case 'UPDATE_HEIGHT_AND_COMPLETE':
      return {
        ...state,
        isLoading: false,
        webViewHeight: action.height,
      };
    default:
      return state;
  }
}

export const EmbedWebView = memo<EmbedWebViewProps>(
  ({ url, provider, embedHtml, embedHeight, onError }) => {
    const theme = useTheme();
    const primaryBackground = useMemo(() => theme.background.val, [theme]);

    // Calculate height based on aspect ratio if available
    const calculatedHeight = useMemo(() => {
      // If we have an aspect ratio and no explicit height, calculate based on screen width
      if (provider.aspectRatio && !embedHeight) {
        const { width: screenWidth } = Dimensions.get('window');
        // Use screen width to maintain aspect ratio
        return screenWidth / provider.aspectRatio;
      }
      return embedHeight || provider.defaultHeight;
    }, [provider.aspectRatio, provider.defaultHeight, embedHeight]);

    const initialState: WebViewState = {
      isLoading: true,
      hideTweetMedia: false,
      webViewHeight: calculatedHeight,
    };

    const [state, dispatch] = useReducer(webViewReducer, initialState);
    const { isLoading, hideTweetMedia, webViewHeight } = state;

    const webViewRef = useRef<WebView>(null);
    const lastHeightRef = useRef(provider.defaultHeight);
    const isDark = useIsDarkTheme();
    const borderRadiusVal = getTokenValue('$s');

    const maxAllowedHeight = useMemo(() => {
      const { height: screenHeight } = Dimensions.get('window');
      const maxHeight = screenHeight * MAX_HEIGHT_PERCENT;

      return Math.max(maxHeight, provider.defaultHeight);
    }, [provider.defaultHeight]);

    const baseHtml = useMemo(() => {
      if (!embedHtml || !url) return '';
      return provider.generateHtml(url, embedHtml, isDark, hideTweetMedia, calculatedHeight);
    }, [url, embedHtml, isDark, provider, hideTweetMedia, calculatedHeight]);

    const html = useMemo(() => {
      if (!baseHtml) return '';
      return baseHtml.replace(
        '<style>',
        `<style>
        :root { background-color: ${primaryBackground} !important; }
        html, body { background-color: ${primaryBackground} !important; }`
      );
    }, [baseHtml, primaryBackground]);

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
    const webViewProps = useMemo(
      () => ({
        style: webViewStyle,
        source: { html },
        automaticallyAdjustContentInsets: false,
        scrollEnabled: SCROLL_ENABLED,
        javaScriptEnabled: true,
        domStorageEnabled: true,
      }),
      [webViewStyle, html]
    );

    const currentHeightRef = useRef(webViewHeight);

    useEffect(() => {
      currentHeightRef.current = webViewHeight;
    }, [webViewHeight]);

    useEffect(() => {
      const webView = webViewRef.current;
      return () => {
        if (webView) {
          webView.stopLoading();
          webView.clearHistory?.();
          webView.clearCache?.(true);
        }
      };
    }, []);

    const onLayoutHandler = useCallback((event: LayoutChangeEvent) => {
      if (!IS_ANDROID) return;
      const { height } = event.nativeEvent.layout;
      if (height !== currentHeightRef.current) {
        requestAnimationFrame(() => {
          dispatch({ type: 'SET_HEIGHT', height });
        });
      }
    }, []);

    const onMessageHandler = useCallback(
      (event: any) => {
        try {
          const data = JSON.parse(event.nativeEvent.data) as WebViewMessageData;
          logger.log('onMessageHandler', data);
          if (data.height && data.height > 0) {
            // For Twitter's initial load
            if (provider.name === 'Twitter' && data.loaded) {
              // For tall tweets that need media hiding
              if (data.height > maxAllowedHeight) {
                logger.log(
                  'Twitter height update, loaded, too tall',
                  data.height
                );
                // Just set the flag, don't update height yet
                dispatch({ type: 'HIDE_MEDIA' });
              } else {
                // For normal sized tweets, update height and complete loading in one action
                logger.log('Twitter height update, loaded', data.height);
                lastHeightRef.current = data.height;
                dispatch({
                  type: 'UPDATE_HEIGHT_AND_COMPLETE',
                  height: data.height,
                });
              }
            }
            // For height updates from Twitter after media hiding
            else if (provider.name === 'Twitter' && !data.loaded) {
              const heightDiff = Math.abs(data.height - lastHeightRef.current);
              logger.log(
                'Twitter height update, not yet loaded, get diff',
                heightDiff
              );
              if (heightDiff > 25 && data.height !== lastHeightRef.current) {
                logger.log(
                  'Twitter height update, not yet loaded',
                  data.height
                );
                lastHeightRef.current = data.height;
                dispatch({ type: 'SET_HEIGHT', height: data.height });
              }
            }
            // For other providers
            else {
              dispatch({
                type: 'UPDATE_HEIGHT_AND_COMPLETE',
                height: data.height,
              });
            }
          }
        } catch (e) {
          logger.crumb('Failed to parse WebView message:', e);
        }
      },
      [provider.name, maxAllowedHeight]
    );

    const onErrorHandler = useCallback(
      (event: any) => {
        logger.log('onErrorHandler', event);
        dispatch({ type: 'LOADING_COMPLETE' });
        const { nativeEvent } = event;
        logger.crumb('WebView error: ', nativeEvent);
        onError?.(nativeEvent);
      },
      [onError]
    );

    const onHttpErrorHandler = useCallback((event: any) => {
      const { nativeEvent } = event;
      logger.crumb(
        `WebView received error status code: ${nativeEvent.statusCode}`
      );
    }, []);

    const onNavigationStateChangeHandler = useCallback(
      (navState: { url: string }) => {
        if (navState.url !== 'about:blank') {
          webViewRef.current?.stopLoading();
          setTimeout(() => {
            Linking.openURL(navState.url).catch((err) =>
              logger.crumb('Failed to open URL:', err)
            );
          }, 50);
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
            width="100%"
            height={calculatedHeight}
            backgroundColor="$secondaryBackground"
            justifyContent="center"
            alignItems="center"
            borderRadius="$s"
          >
            <LoadingSpinner />
          </View>
        )}
        <View
          width="100%"
          height={isLoading ? 0 : webViewHeight}
          backgroundColor={primaryBackground}
          borderRadius="$s"
          style={containerStyle}
          onLayout={onLayoutHandler}
        >
          <WebView
            {...webViewProps}
            androidLayerType={ANDROID_LAYER_TYPE}
            overScrollMode={ANDROID_OVERSCROLL_MODE}
            onMessage={onMessageHandler}
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
