import { useEmbed, validOembedCheck } from '@tloncorp/shared';
import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import WebView from 'react-native-webview';
import { Text, YStack } from 'tamagui';

import { Embed } from './Embed';
import { SkeletonLoader } from './SkeletonLoader';

const GenericEmbed = ({
  provider,
  title,
  author,
  embedHtml,
  openLink,
  height,
  width,
}: {
  provider: string;
  title: string;
  author?: string;
  embedHtml: string;
  openLink: () => void;
  height?: number;
  width?: number;
}) => {
  const [showModal, setShowModal] = useState(false);
  return (
    <Embed onPress={openLink}>
      <Embed.Header onPress={openLink}>
        <Embed.Title>{provider}</Embed.Title>
        <Embed.PopOutIcon type="ArrowRef" />
      </Embed.Header>
      <Embed.Preview onPress={openLink}>
        <YStack>
          <Text>{title}</Text>
          {author && <Text>{author}</Text>}
        </YStack>
      </Embed.Preview>
      <Embed.Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        height={height ? height + 12 : undefined}
        width={width ? width + 12 : undefined}
      >
        <WebView
          bounces={false}
          style={{ width, height }}
          source={{ html: embedHtml }}
          automaticallyAdjustContentInsets={false}
        />
      </Embed.Modal>
    </Embed>
  );
};

const GenericEmbedFallback = ({
  provider,
  title,
  author,
  openLink,
}: {
  provider: string;
  title: string;
  author?: string;
  openLink: () => void;
}) => {
  return (
    <Embed>
      <Embed.Header onPress={openLink}>
        <Embed.Title>{provider}</Embed.Title>
        <Embed.PopOutIcon type="ArrowRef" />
      </Embed.Header>
      <Embed.Preview onPress={openLink}>
        <YStack>
          <Text>{title}</Text>
          {author && <Text>{author}</Text>}
        </YStack>
      </Embed.Preview>
    </Embed>
  );
};

export default function OutsideEmbed({ url }: { url: string }) {
  const { embed } = useEmbed(url);
  const initialWebViewHeight = 300;
  const [webViewHeight, setWebViewHeight] = useState(initialWebViewHeight);
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const isValid = validOembedCheck(embed, url);
  const fallBackProvider = url.split('/')[2].split('.')[1];
  const fallBackProviderName =
    fallBackProvider.charAt(0).toUpperCase() + fallBackProvider.slice(1);
  const fallBackTitle = `Open in ${fallBackProviderName}`;
  const openLink = async () => {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  if (isValid) {
    const {
      title,
      // TODO: Maybe use thumbnail?
      // thumbnail_url: thumbnail,
      provider_name: provider,
      url: embedUrl,
      author_name: author,
      html: embedHtmlReturned,
    } = embed;

    let embedHtml = '';
    let height = 120;
    let width = undefined;

    if (provider === 'YouTube') {
      height = 240;
      width = 320;
      const videoId = embedUrl.split('v=')[1];
      embedHtml = `
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${videoId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
        </iframe>`;
    }

    if (provider === 'Spotify') {
      const playlistOrTrack = url.split('/')[3];
      const id = url.split('/')?.pop()?.split('?')[0];
      width = 330;
      embedHtml = `
        <iframe
          style="width: 100%; height: 100%;"
          src="https://open.spotify.com/embed/${playlistOrTrack}/${id}"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      `;
    }

    if (provider === 'Twitter') {
      // Get initial height based on estimated tweet content size
      const wrappedHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <style>
              html, body { 
                margin: 0; 
                padding: 0; 
                background: transparent;
              }
              .twitter-tweet { 
                margin: 0 !important;
              }
              iframe {
                width: 100% !important;
                margin: 0 !important;
              }
            </style>
            <script>
              function checkForTwitterWidget() {
                const tweetFrame = document.querySelector('iframe[id^="twitter-widget"]');
                if (tweetFrame) {
                  // Create resize observer to track iframe size changes
                  const resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                      const height = entry.contentRect.height;
                      window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
                    }
                  });
                  
                  resizeObserver.observe(tweetFrame);
                  
                  // Also send initial height
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    height: tweetFrame.offsetHeight 
                  }));
                } else {
                  // Keep checking until Twitter widget appears
                  setTimeout(checkForTwitterWidget, 100);
                }
              }
              
              // Start checking once page loads
              window.addEventListener('load', checkForTwitterWidget);
            </script>
          </head>
          <body>
            ${embedHtmlReturned}
          </body>
        </html>
      `;

      return (
        <>
          {isLoading && (
            <SkeletonLoader height={initialWebViewHeight} width={300} />
          )}
          <WebView
            style={[
              {
                height: webViewHeight,
                width: 300,
              },
              isLoading && {
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
              }
            ]}
          source={{ html: wrappedHtml }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.height) {
                setWebViewHeight(data.height);
                // Once we get the real height, we can show the content
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
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn(
              `WebView received error status code: ${nativeEvent.statusCode}`
            );
          }}
          onNavigationStateChange={(navState) => {
            // If trying to navigate to a new URL
            if (navState.url !== 'about:blank') {
              // Prevent WebView navigation
              webViewRef.current?.stopLoading();
              // Open URL externally
              Linking.openURL(navState.url);
              return false;
            }
            return true;
          }}
          ref={webViewRef}
        />
        </>
      );
    }

    return (
      <GenericEmbed
        provider={provider}
        title={title}
        author={author}
        embedHtml={embedHtml}
        openLink={openLink}
        height={height}
        width={width}
      />
    );
  }

  return (
    <GenericEmbedFallback
      provider={fallBackProviderName}
      title={fallBackTitle}
      openLink={openLink}
    />
  );
}
