import { LoadingSpinner } from '@tloncorp/ui';
import React, {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, useTheme } from 'tamagui';

import { useIsDarkTheme } from '../../utils';
import { EmbedProviderConfig } from './providers';

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: () => void;
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options: any
        ) => Promise<HTMLElement>;
      };
      events: {
        bind: (event: string, callback: (element: HTMLElement) => void) => void;
      };
    };
  }
}

interface EmbedWebViewProps {
  url: string;
  provider: EmbedProviderConfig;
  embedHtml?: string;
  embedHeight?: number;
  onHeightChange?: (height: number) => void;
  onError?: (error: any) => void;
}

export const EmbedWebView = memo<EmbedWebViewProps>(
  ({ url, provider, embedHtml, embedHeight, onHeightChange, onError }) => {
    const primaryBackground = useTheme().background.val;
    const isDark = useIsDarkTheme();
    const [isLoading, setIsLoading] = useState(true);

    // Use explicit height if provided, otherwise use default
    const calculatedHeight = useMemo(() => {
      return embedHeight || provider.defaultHeight;
    }, [provider.defaultHeight, embedHeight]);

    const [webViewHeight, setWebViewHeight] = useState(calculatedHeight);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const tweetContainerRef = useRef<HTMLDivElement>(null);

    const twitterContainerStyle = useMemo(
      (): CSSProperties => ({
        height: webViewHeight,
        width: '100%',
        backgroundColor: primaryBackground,
        overflow: 'hidden',
      }),
      [webViewHeight, primaryBackground]
    );

    const tweetVisibilityStyle = useMemo(
      (): CSSProperties => ({
        visibility: isLoading ? 'hidden' : ('visible' as const),
      }),
      [isLoading]
    );

    const iframeStyle = useMemo(
      (): CSSProperties => ({
        border: 'none',
        height: '100%',
        width: '100%',
        visibility: isLoading ? 'hidden' : ('visible' as const),
        ...(provider.aspectRatio && {
          aspectRatio:
            provider.aspectRatio === 16 / 9
              ? '16 / 9'
              : `${provider.aspectRatio}`,
        }),
      }),
      [isLoading, provider.aspectRatio]
    );

    const onIframeLoad = useCallback(() => {
      setIsLoading(false);
      setWebViewHeight(calculatedHeight);
      onHeightChange?.(calculatedHeight);
    }, [calculatedHeight, onHeightChange]);

    const onIframeError = useCallback(
      (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
        setIsLoading(false);
        onError?.(e);
      },
      [onError]
    );

    const renderTweet = useCallback(() => {
      if (!embedHtml) return;

      if (window.twttr && tweetContainerRef.current) {
        // Clear previous content
        // Add dark theme to the blockquote element if in dark mode
        const themedHtml = isDark
          ? embedHtml.replace(
              '<blockquote class="twitter-tweet"',
              '<blockquote class="twitter-tweet" data-theme="dark"'
            )
          : embedHtml;
        tweetContainerRef.current.innerHTML = themedHtml;

        // Bind to tweet render event
        window.twttr.events.bind('rendered', () => {
          setIsLoading(false);
          // Find the tweet iframe and get its height
          if (tweetContainerRef.current) {
            const tweetIframe = tweetContainerRef.current.querySelector(
              'iframe'
            ) as HTMLIFrameElement | null;
            if (tweetIframe) {
              // Add a small buffer to prevent scrollbars
              const height = tweetIframe.offsetHeight + 20;
              setWebViewHeight(height);
              onHeightChange?.(height);

              // Setup resize observer for dynamic height changes
              const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                  const iframe = entry.target as HTMLIFrameElement;
                  const newHeight = iframe.offsetHeight + 20;
                  setWebViewHeight(newHeight);
                  onHeightChange?.(newHeight);
                }
              });

              resizeObserver.observe(tweetIframe);
              return () => resizeObserver.disconnect();
            }
          }
        });

        window.twttr.widgets.load();
      }
    }, [embedHtml, isDark, onHeightChange]);

    useEffect(() => {
      if (provider.name === 'Twitter' && embedHtml) {
        const loadTwitterWidget = async () => {
          if (!window.twttr) {
            return new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://platform.twitter.com/widgets.js';
              script.async = true;
              script.onload = () => resolve();
              script.onerror = (e) => reject(e);
              document.body.appendChild(script);
            });
          }
          return Promise.resolve();
        };

        loadTwitterWidget()
          .then(renderTweet)
          .catch((e) => onError?.(e));
      }
    }, [provider.name, embedHtml, renderTweet, onError]);

    const embedUrl = useMemo(() => {
      let processedUrl = url;
      if (provider.name === 'YouTube') {
        const videoId = provider.extractId?.(url);
        processedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (provider.name === 'Spotify') {
        const [type, id] = url.split('/').slice(3, 5);
        processedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      } else if (provider.name === 'TikTok') {
        const videoId = provider.extractId?.(url);
        processedUrl = `https://www.tiktok.com/player/v1/${videoId}`;
      }
      return processedUrl;
    }, [url, provider]);

    if (!embedHtml && !url) {
      return null;
    }

    const loadingSpinner = isLoading && (
      <View
        width="100%"
        backgroundColor="$secondaryBackground"
        justifyContent="center"
        alignItems="center"
        borderRadius="$s"
        {...(provider.aspectRatio
          ? { aspectRatio: provider.aspectRatio }
          : { height: calculatedHeight })}
      >
        <LoadingSpinner color="$primaryText" />
      </View>
    );

    // For Twitter, we need to use their widget HTML
    if (provider.name === 'Twitter' && embedHtml) {
      return (
        <div style={twitterContainerStyle}>
          {loadingSpinner}
          <div
            ref={tweetContainerRef}
            dangerouslySetInnerHTML={{ __html: embedHtml }}
            style={tweetVisibilityStyle}
          />
        </div>
      );
    }

    // For other providers, we can use their embed URLs directly
    return (
      <View
        width="100%"
        backgroundColor={primaryBackground}
        borderRadius="$s"
        overflow="hidden"
        {...(provider.aspectRatio && {
          aspectRatio: provider.aspectRatio,
        })}
      >
        {loadingSpinner}
        <iframe
          ref={iframeRef}
          src={embedUrl}
          style={iframeStyle}
          onLoad={onIframeLoad}
          onError={onIframeError}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-popups-to-escape-sandbox"
        />
      </View>
    );
  }
);

EmbedWebView.displayName = 'EmbedWebView';
