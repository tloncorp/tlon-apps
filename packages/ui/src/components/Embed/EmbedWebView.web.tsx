import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'tamagui';

import { SkeletonLoader } from './SkeletonLoader';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const tweetContainerRef = useRef<HTMLDivElement>(null);

  // Setup Twitter widget effect
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

      const renderTweet = () => {
        if (window.twttr && tweetContainerRef.current) {
          // Clear previous content
          tweetContainerRef.current.innerHTML = embedHtml;

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
      };

      loadTwitterWidget()
        .then(renderTweet)
        .catch((e) => onError?.(e));
    }
  }, [provider.name, embedHtml, onError, onHeightChange]);

  if (!embedHtml && !url) {
    return null;
  }

  // For Twitter, we need to use their widget HTML
  if (provider.name === 'Twitter' && embedHtml) {
    return (
      <div
        style={{
          height: webViewHeight,
          width: provider.defaultWidth,
          backgroundColor: primaryBackground,
          overflow: 'hidden',
        }}
      >
        {isLoading && (
          <SkeletonLoader
            height={provider.defaultHeight}
            width={provider.defaultWidth}
          />
        )}
        <div
          ref={tweetContainerRef}
          dangerouslySetInnerHTML={{ __html: embedHtml }}
          style={{ visibility: isLoading ? 'hidden' : 'visible' }}
        />
      </div>
    );
  }

  // For other providers, we can use their embed URLs directly
  let embedUrl = url;
  if (provider.name === 'YouTube') {
    const videoId = provider.extractId?.(url);
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (provider.name === 'Spotify') {
    const [type, id] = url.split('/').slice(3, 5);
    embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  } else if (provider.name === 'TikTok') {
    const videoId = provider.extractId?.(url);
    embedUrl = `https://www.tiktok.com/player/v1/${videoId}`;
  }

  return (
    <div
      style={{
        height: webViewHeight,
        width: provider.defaultWidth,
        backgroundColor: primaryBackground,
        overflow: 'hidden',
      }}
    >
      {isLoading && (
        <SkeletonLoader
          height={provider.defaultHeight}
          width={provider.defaultWidth}
        />
      )}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        style={{
          border: 'none',
          height: '100%',
          width: '100%',
          visibility: isLoading ? 'hidden' : 'visible',
        }}
        onLoad={() => {
          setIsLoading(false);
          // Use the provider's default height
          setWebViewHeight(provider.defaultHeight);
          onHeightChange?.(provider.defaultHeight);
        }}
        onError={(e) => {
          setIsLoading(false);
          onError?.(e);
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      />
    </div>
  );
};
